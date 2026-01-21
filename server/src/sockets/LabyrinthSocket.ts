import { Server, Socket } from 'socket.io';
import { CLIENT_EVENTS, SERVER_EVENTS } from './events.js';
import { LabyrinthManager } from '../services/LabyrinthManager.js';
import { FloorManager } from '../services/FloorManager.js';
import { CombatService } from '../services/CombatService.js';
import { playerSyncService } from '../services/PlayerSyncService.js';
import { LabyrinthParticipantModel } from '../models/LabyrinthParticipant.js';
import { LabyrinthPartyModel } from '../models/LabyrinthParty.js';
import { RewardService } from '../services/RewardService.js';
import { MovementService } from '../services/MovementService.js';
import { MapService } from '../services/MapService.js';
import { FogOfWarService } from '../services/FogOfWarService.js';
import { ParticipantPositionModel } from '../models/ParticipantPosition.js';
import { LabyrinthFloorModel } from '../models/LabyrinthFloor.js';
import { FloorNodeModel } from '../models/FloorNode.js';
import { pool } from '../config/database.js';

export function setupLabyrinthSocket(io: Server, socket: Socket) {
  console.log(`Setting up labyrinth socket for ${socket.id}`);

  // Join labyrinth
  socket.on(CLIENT_EVENTS.JOIN, async (data: { labyrinth_id: string; character_id: string }) => {
    try {
      const { labyrinth_id, character_id } = data;

      // Join the labyrinth
      const participant = await LabyrinthManager.joinLabyrinth(labyrinth_id, character_id);

      // Register player in sync service
      playerSyncService.registerPlayer(socket.id, participant.id, character_id, participant.floor_number);

      // Join socket room for this labyrinth and floor
      socket.join(`labyrinth:${labyrinth_id}`);
      socket.join(`labyrinth:${labyrinth_id}:floor:${participant.floor_number}`);

      // Get floor
      const floor = await LabyrinthFloorModel.findByLabyrinthAndFloor(labyrinth_id, participant.floor_number);
      
      // Send map data if floor exists
      if (floor) {
        // Check if floor has any nodes - if not, generate a default map
        const existingNodes = await FloorNodeModel.findByFloorId(floor.id);
        if (existingNodes.length === 0) {
          // Generate a default procedural map for the floor
          const { ProceduralGenerator } = await import('../services/ProceduralGenerator.js');
          await ProceduralGenerator.generateFloorLayout({
            floor_id: floor.id,
            totalNodes: 30,
            bossCount: 2,
            safeZoneCount: 3,
            craftingCount: 2,
            stairCount: 1,
            startPointCount: 3,
            layoutType: 'maze',
            connectionDensity: 0.5,
          });
        }

        const fullMapData = await MapService.buildMapData(floor.id);
        const visibility = await FogOfWarService.calculateVisibility(
          participant.id,
          floor.id,
          null, // Character data would be needed for full fog of war
          labyrinth_id
        );

        // Filter map data to only include visible nodes and connections
        const visibleNodeIds = new Set(visibility.visibleNodes);
        const filteredMapData = MapService.filterMapDataByVisibility(
          fullMapData,
          visibleNodeIds
        );

        // Get nodes with players (filter to only visible nodes)
        const allNodesWithPlayers = await MapService.getNodesWithPlayers(floor.id);
        const visibleNodesWithPlayers = new Map<string, number>();
        for (const [nodeId, count] of allNodesWithPlayers.entries()) {
          if (visibleNodeIds.has(nodeId)) {
            visibleNodesWithPlayers.set(nodeId, count);
          }
        }

        socket.emit(SERVER_EVENTS.MAP_DATA, {
          map: filteredMapData,
          visibility: {
            visibleNodes: visibility.visibleNodes,
            exploredNodes: visibility.exploredNodes,
            adjacentNodes: visibility.adjacentNodes,
            visibilityByNode: Object.fromEntries(visibility.visibilityByNode),
          },
          nodesWithPlayers: Object.fromEntries(visibleNodesWithPlayers),
        });
      }

      // Send confirmation
      socket.emit(SERVER_EVENTS.JOINED, {
        participant_id: participant.id,
        floor_number: participant.floor_number,
        labyrinth_id,
      });

      // Notify other players on the floor
      socket.to(`labyrinth:${labyrinth_id}:floor:${participant.floor_number}`).emit(SERVER_EVENTS.PLAYER_JOINED, {
        character_id,
        floor_number: participant.floor_number,
      });
    } catch (error) {
      socket.emit(SERVER_EVENTS.ERROR, {
        message: error instanceof Error ? error.message : 'Failed to join labyrinth',
      });
    }
  });

  // Request map data
  socket.on(CLIENT_EVENTS.REQUEST_MAP_DATA, async (data: { labyrinth_id: string; character_id: string }) => {
    try {
      const { labyrinth_id, character_id } = data;

      const participant = await LabyrinthParticipantModel.findByLabyrinthAndCharacter(labyrinth_id, character_id);
      if (!participant) {
        socket.emit(SERVER_EVENTS.ERROR, {
          message: 'Participant not found',
        });
        return;
      }

      const floor = await LabyrinthFloorModel.findByLabyrinthAndFloor(labyrinth_id, participant.floor_number);
      if (!floor) {
        socket.emit(SERVER_EVENTS.ERROR, {
          message: 'Floor not found',
        });
        return;
      }

      // Check if floor has any nodes - if not, generate a default map
      const existingNodes = await FloorNodeModel.findByFloorId(floor.id);
      if (existingNodes.length === 0) {
        // Generate a default procedural map for the floor
        const { ProceduralGenerator } = await import('../services/ProceduralGenerator.js');
        await ProceduralGenerator.generateFloorLayout({
          floor_id: floor.id,
          totalNodes: 30,
          bossCount: 2,
          safeZoneCount: 3,
          craftingCount: 2,
          stairCount: 1,
          startPointCount: 3,
          layoutType: 'maze',
          connectionDensity: 0.5,
        });
      }

      const fullMapData = await MapService.buildMapData(floor.id);
      const visibility = await FogOfWarService.calculateVisibility(
        participant.id,
        floor.id,
        null,
        labyrinth_id
      );

      // Filter map data to only include visible nodes and connections
      const visibleNodeIds = new Set(visibility.visibleNodes);
      const filteredMapData = MapService.filterMapDataByVisibility(
        fullMapData,
        visibleNodeIds
      );

      // Get nodes with players (filter to only visible nodes)
      const allNodesWithPlayers = await MapService.getNodesWithPlayers(floor.id);
      const visibleNodesWithPlayers = new Map<string, number>();
      for (const [nodeId, count] of allNodesWithPlayers.entries()) {
        if (visibleNodeIds.has(nodeId)) {
          visibleNodesWithPlayers.set(nodeId, count);
        }
      }

      socket.emit(SERVER_EVENTS.MAP_DATA, {
        map: filteredMapData,
        visibility: {
          visibleNodes: visibility.visibleNodes,
          exploredNodes: visibility.exploredNodes,
          adjacentNodes: visibility.adjacentNodes,
          visibilityByNode: Object.fromEntries(visibility.visibilityByNode),
        },
        nodesWithPlayers: Object.fromEntries(visibleNodesWithPlayers),
      });
    } catch (error) {
      socket.emit(SERVER_EVENTS.ERROR, {
        message: error instanceof Error ? error.message : 'Failed to fetch map data',
      });
    }
  });

  // Create party
  socket.on(CLIENT_EVENTS.CREATE_PARTY, async (data: { labyrinth_id: string; leader_character_id: string; name?: string }) => {
    try {
      const { labyrinth_id, leader_character_id, name } = data;

      // Find participant
      const participant = await LabyrinthParticipantModel.findByLabyrinthAndCharacter(labyrinth_id, leader_character_id);
      if (!participant) {
        throw new Error('Participant not found');
      }

      // Create party
      const party = await LabyrinthPartyModel.create({
        labyrinth_id,
        leader_character_id,
        name: name || null,
        members: [leader_character_id],
      });

      // Update participant's party
      await pool.query('UPDATE labyrinth_participants SET party_id = $1 WHERE id = $2', [party.id, participant.id]);

      socket.emit('labyrinth:party_created', { party_id: party.id, party });
    } catch (error) {
      socket.emit(SERVER_EVENTS.ERROR, {
        message: error instanceof Error ? error.message : 'Failed to create party',
      });
    }
  });

  // Join party
  socket.on(CLIENT_EVENTS.JOIN_PARTY, async (data: { party_id: string; character_id: string }) => {
    try {
      const { party_id, character_id } = data;

      const party = await LabyrinthPartyModel.findById(party_id);
      if (!party) {
        throw new Error('Party not found');
      }

      // Find participant
      const participant = await LabyrinthParticipantModel.findByLabyrinthAndCharacter(party.labyrinth_id, character_id);
      if (!participant) {
        throw new Error('Participant not found');
      }

      // Add to party
      await LabyrinthPartyModel.addMember(party_id, character_id);
      await pool.query('UPDATE labyrinth_participants SET party_id = $1 WHERE id = $2', [party_id, participant.id]);

      socket.emit('labyrinth:party_joined', { party_id, party });
    } catch (error) {
      socket.emit(SERVER_EVENTS.ERROR, {
        message: error instanceof Error ? error.message : 'Failed to join party',
      });
    }
  });

  // Player movement (node-based)
  socket.on(CLIENT_EVENTS.MOVE, async (data: { participant_id: string; target_node_id: string }) => {
    try {
      const { participant_id, target_node_id } = data;

      // Get participant
      const participant = await LabyrinthParticipantModel.findById(participant_id);
      if (!participant || participant.status !== 'active') {
        throw new Error('Participant not found or not active');
      }

      // Get floor
      const floor = await LabyrinthFloorModel.findByLabyrinthAndFloor(
        participant.labyrinth_id,
        participant.floor_number
      );
      if (!floor) {
        throw new Error('Floor not found');
      }

      // Execute movement
      const result = await MovementService.moveToNode(participant_id, floor.id, target_node_id, participant.labyrinth_id);

      if (!result.success) {
        socket.emit(SERVER_EVENTS.ERROR, {
          message: result.message || 'Failed to move',
        });
        return;
      }

      // Check if combat was prepared at the target node
      const preparedCombat = CombatService.getPreparedCombat(target_node_id, floor.id);
      if (preparedCombat) {
        // Emit combat prepared event to all players on the node
        io.to(`labyrinth:${participant.labyrinth_id}:floor:${participant.floor_number}`).emit(
          SERVER_EVENTS.COMBAT_PREPARED,
          {
            combat_instance_id: preparedCombat.combatInstanceId,
            node_id: preparedCombat.nodeId,
            floor_id: preparedCombat.floorId,
            monsters: preparedCombat.monsters,
            participant_ids: preparedCombat.participants.map((p) => p.id),
          }
        );
      }

      // Update visibility and map data
      if (floor) {
        const visibility = await FogOfWarService.calculateVisibility(
          participant_id,
          floor.id,
          null,
          participant.labyrinth_id
        );
        
        // Filter nodes with players to only include visible nodes
        const visibleNodeIds = new Set(visibility.visibleNodes);
        const allNodesWithPlayers = await MapService.getNodesWithPlayers(floor.id);
        const visibleNodesWithPlayers = new Map<string, number>();
        for (const [nodeId, count] of allNodesWithPlayers.entries()) {
          if (visibleNodeIds.has(nodeId)) {
            visibleNodesWithPlayers.set(nodeId, count);
          }
        }

        // Send visibility update to player
        socket.emit(SERVER_EVENTS.VISIBILITY_UPDATE, {
          visibility: {
            visibleNodes: visibility.visibleNodes,
            exploredNodes: visibility.exploredNodes,
            adjacentNodes: visibility.adjacentNodes,
            visibilityByNode: Object.fromEntries(visibility.visibilityByNode),
          },
          nodesWithPlayers: Object.fromEntries(visibleNodesWithPlayers),
        });
      }

      // Broadcast movement to other players on the floor
      io.to(`labyrinth:${participant.labyrinth_id}:floor:${participant.floor_number}`).emit(
        SERVER_EVENTS.PLAYER_MOVED,
        {
          participant_id,
          character_id: participant.character_id,
          node_id: target_node_id,
          movement_points: result.movementPointsRemaining,
        }
      );

      // Broadcast map update to all players on floor
      io.to(`labyrinth:${participant.labyrinth_id}:floor:${participant.floor_number}`).emit(
        SERVER_EVENTS.MAP_UPDATE,
        {
          nodesWithPlayers: floor ? Object.fromEntries(await MapService.getNodesWithPlayers(floor.id)) : {},
        }
      );

      // Send movement result to player
      socket.emit(SERVER_EVENTS.MOVE_RESULT, {
        success: true,
        position: result.newPosition,
        movement_points: result.movementPointsRemaining,
        revealed_nodes: result.revealedNodes,
      });
    } catch (error) {
      socket.emit(SERVER_EVENTS.ERROR, {
        message: error instanceof Error ? error.message : 'Failed to process movement',
      });
    }
  });

  // Initiate combat (PvE - starts prepared combat, or PvP)
  socket.on(
    CLIENT_EVENTS.INITIATE_COMBAT,
    async (data: { 
      participant_id: string; 
      combat_instance_id?: string;
      target_participant_id?: string; 
      combat_type: 'pvp' | 'pve';
      character_data?: any; // Character data for combat participant creation
    }) => {
      try {
        const { participant_id, combat_instance_id, target_participant_id, combat_type, character_data } = data;

        if (combat_type === 'pve' && combat_instance_id) {
          // Start prepared PvE combat
          const preparedCombat = CombatService.getPreparedCombatById(combat_instance_id);
          if (!preparedCombat) {
            throw new Error('Combat instance not found');
          }

          // Verify participant is in the combat
          const participant = preparedCombat.participants.find((p) => p.id === participant_id);
          if (!participant) {
            throw new Error('Participant not in combat');
          }

          // Get participant data
          const labyrinthParticipant = await LabyrinthParticipantModel.findById(participant_id);
          if (!labyrinthParticipant) {
            throw new Error('Participant not found');
          }

          // Get floor
          const floor = await LabyrinthFloorModel.findByLabyrinthAndFloor(
            labyrinthParticipant.labyrinth_id,
            labyrinthParticipant.floor_number
          );
          if (!floor) {
            throw new Error('Floor not found');
          }

          // Initialize combat engine (character data should be provided by client)
          const { ServerCombatEngine } = await import('../services/ServerCombatEngine.js');
          const { ServerCombatDataProvider } = await import('../services/ServerCombatDataProvider.js');
          
          // Preload monster data
          const dataProvider = new ServerCombatDataProvider();
          for (const monster of preparedCombat.monsters) {
            await dataProvider.preloadMonster(monster.id);
          }

          const combatEngine = new ServerCombatEngine(dataProvider);
          
          // TODO: Initialize combat with character data if provided
          // For now, we'll need to get character data from the client or database
          
          // Notify all participants that combat has started
          io.to(`labyrinth:${labyrinthParticipant.labyrinth_id}:floor:${labyrinthParticipant.floor_number}`).emit(
            SERVER_EVENTS.COMBAT_INITIATED,
            {
              combat_instance_id: preparedCombat.combatInstanceId,
              combat_type: 'pve',
              participants: preparedCombat.participants.map((p) => ({ id: p.id, name: p.name })),
              monsters: preparedCombat.monsters,
            }
          );
        } else if (combat_type === 'pvp' && target_participant_id) {
          // PvP combat (existing logic)
          // TODO: Update to use new combat system if needed
          socket.emit(SERVER_EVENTS.ERROR, {
            message: 'PvP combat not yet implemented with new combat system',
          });
        } else {
          throw new Error('Invalid combat initiation parameters');
        }
      } catch (error) {
        socket.emit(SERVER_EVENTS.ERROR, {
          message: error instanceof Error ? error.message : 'Failed to initiate combat',
        });
      }
    }
  );

  // Join combat (for party members)
  socket.on(CLIENT_EVENTS.JOIN_COMBAT, async (data: { participant_id: string; combat_instance_id: string; character_data?: any }) => {
    try {
      const { participant_id, combat_instance_id, character_data } = data;

      const success = await CombatService.addPartyMemberToCombat(combat_instance_id, participant_id);
      if (!success) {
        throw new Error('Failed to join combat');
      }

      const preparedCombat = CombatService.getPreparedCombatById(combat_instance_id);
      if (!preparedCombat) {
        throw new Error('Combat instance not found');
      }

      const labyrinthParticipant = await LabyrinthParticipantModel.findById(participant_id);
      if (!labyrinthParticipant) {
        throw new Error('Participant not found');
      }

      // Notify all participants that a party member joined
      const floor = await LabyrinthFloorModel.findByLabyrinthAndFloor(
        labyrinthParticipant.labyrinth_id,
        labyrinthParticipant.floor_number
      );
      if (floor) {
        io.to(`labyrinth:${labyrinthParticipant.labyrinth_id}:floor:${labyrinthParticipant.floor_number}`).emit(
          SERVER_EVENTS.COMBAT_UPDATE,
          {
            combat_instance_id,
            type: 'participant_joined',
            participant_id,
            participants: preparedCombat.participants.map((p) => ({ id: p.id, name: p.name })),
          }
        );
      }
    } catch (error) {
      socket.emit(SERVER_EVENTS.ERROR, {
        message: error instanceof Error ? error.message : 'Failed to join combat',
      });
    }
  });

  // Combat action (turn, skill, item)
  socket.on(CLIENT_EVENTS.COMBAT_ACTION, async (data: { 
    participant_id: string; 
    combat_instance_id: string; 
    action_type: 'skill' | 'item' | 'attack';
    skill_id?: string;
    item_id?: string;
  }) => {
    try {
      const { participant_id, combat_instance_id, action_type, skill_id, item_id } = data;

      // TODO: Process combat action through combat engine
      // This will need to integrate with ServerCombatEngine.executeTurn()
      
      socket.emit(SERVER_EVENTS.ERROR, {
        message: 'Combat action handling not yet fully implemented',
      });
    } catch (error) {
      socket.emit(SERVER_EVENTS.ERROR, {
        message: error instanceof Error ? error.message : 'Failed to process combat action',
      });
    }
  });

  // Claim rewards
  socket.on(CLIENT_EVENTS.CLAIM_REWARDS, async (data: { character_id: string; reward_ids: string[] }) => {
    try {
      const { character_id, reward_ids } = data;

      for (const reward_id of reward_ids) {
        await RewardService.claimReward(reward_id);
      }

      socket.emit('labyrinth:rewards_claimed', { reward_ids });
    } catch (error) {
      socket.emit(SERVER_EVENTS.ERROR, {
        message: error instanceof Error ? error.message : 'Failed to claim rewards',
      });
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    playerSyncService.unregisterPlayer(socket.id);
  });
}

