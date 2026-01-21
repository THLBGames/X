import { Express } from 'express';
import { LabyrinthManager } from '../services/LabyrinthManager.js';
import { FloorManager } from '../services/FloorManager.js';
import { RewardService } from '../services/RewardService.js';
import { MovementService } from '../services/MovementService.js';
import { MapService } from '../services/MapService.js';
import { FogOfWarService } from '../services/FogOfWarService.js';
import { LabyrinthModel } from '../models/Labyrinth.js';
import { LabyrinthFloorModel } from '../models/LabyrinthFloor.js';
import { LabyrinthParticipantModel } from '../models/LabyrinthParticipant.js';
import { ParticipantPositionModel } from '../models/ParticipantPosition.js';
import { FloorNodeModel } from '../models/FloorNode.js';
import { FloorConnectionModel } from '../models/FloorConnection.js';
import { ProceduralGenerator } from '../services/ProceduralGenerator.js';
import { pool } from '../config/database.js';

export function setupLabyrinthRoutes(app: Express) {
  // Get all available labyrinths
  app.get('/api/labyrinth/list', async (req, res) => {
    try {
      const labyrinths = await LabyrinthModel.listAvailable();
      res.json({ success: true, labyrinths });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch labyrinths',
      });
    }
  });

  // Get all active labyrinths for a character
  app.get('/api/labyrinth/character/:character_id/active', async (req, res) => {
    try {
      const participants = await LabyrinthParticipantModel.findByCharacter(req.params.character_id, 'active');
      
      // Fetch labyrinth details for each participant
      const labyrinthsWithParticipants = await Promise.all(
        participants.map(async (participant) => {
          const labyrinth = await LabyrinthModel.findById(participant.labyrinth_id);
          return {
            labyrinth,
            participant,
          };
        })
      );

      // Filter out any null labyrinths
      const validLabyrinths = labyrinthsWithParticipants.filter((item) => item.labyrinth !== null);

      res.json({
        success: true,
        labyrinths: validLabyrinths.map((item) => ({
          labyrinth: item.labyrinth,
          participant: item.participant,
        })),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch active labyrinths',
      });
    }
  });

  // Get labyrinth details
  app.get('/api/labyrinth/:id', async (req, res) => {
    try {
      const labyrinth = await LabyrinthModel.findById(req.params.id);
      if (!labyrinth) {
        return res.status(404).json({ success: false, message: 'Labyrinth not found' });
      }

      const floors = await LabyrinthFloorModel.findByLabyrinthId(req.params.id);
      res.json({ success: true, labyrinth, floors });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch labyrinth',
      });
    }
  });

  // Create labyrinth (admin endpoint)
  app.post('/api/labyrinth/create', async (req, res) => {
    try {
      const { name, scheduled_start, total_floors, max_initial_players, rules_config, metadata, floors } = req.body;

      if (!name || !scheduled_start || !total_floors || !max_initial_players || !floors) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      const result = await LabyrinthManager.createLabyrinth(
        {
          name,
          scheduled_start: new Date(scheduled_start),
          total_floors,
          max_initial_players,
          rules_config: rules_config || {},
          metadata: metadata || {},
        },
        floors
      );

      res.json({ success: true, labyrinth: result.labyrinth, floors: result.floors });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create labyrinth',
      });
    }
  });

  // Get participant info
  app.get('/api/labyrinth/:id/participant/:character_id', async (req, res) => {
    try {
      const participant = await LabyrinthParticipantModel.findByLabyrinthAndCharacter(req.params.id, req.params.character_id);
      if (!participant) {
        return res.status(404).json({ success: false, message: 'Participant not found' });
      }

      res.json({ success: true, participant });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch participant',
      });
    }
  });

  // Get floor players
  app.get('/api/labyrinth/:id/floor/:floor_number/players', async (req, res) => {
    try {
      const players = await LabyrinthManager.getFloorPlayers(req.params.id, parseInt(req.params.floor_number, 10));
      res.json({ success: true, players });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch floor players',
      });
    }
  });

  // Get unclaimed rewards
  app.get('/api/labyrinth/rewards/:character_id', async (req, res) => {
    try {
      const rewards = await RewardService.getUnclaimedRewards(req.params.character_id);
      res.json({ success: true, rewards });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch rewards',
      });
    }
  });

  // Get participant position and map state
  app.get('/api/labyrinth/:id/position', async (req, res) => {
    try {
      const { id: labyrinth_id } = req.params;
      const { character_id } = req.query;

      if (!character_id) {
        return res.status(400).json({ success: false, message: 'character_id is required' });
      }

      const participant = await LabyrinthParticipantModel.findByLabyrinthAndCharacter(
        labyrinth_id,
        character_id as string
      );

      if (!participant) {
        return res.status(404).json({ success: false, message: 'Participant not found' });
      }

      // Get floor
      const floor = await LabyrinthFloorModel.findByLabyrinthAndFloor(
        labyrinth_id,
        participant.floor_number
      );

      if (!floor) {
        return res.status(404).json({ success: false, message: 'Floor not found' });
      }

      // Get position
      const position = await ParticipantPositionModel.findByParticipantAndFloor(
        participant.id,
        floor.id
      );

      if (!position) {
        // Initialize position if doesn't exist
        // MovementService will randomly select from available start points
        const maxPoints = floor.max_movement_points || 10;
        const newPosition = await MovementService.initializePosition(
          participant.id,
          floor.id,
          null, // Deprecated parameter, ignored
          maxPoints,
          labyrinth_id // Pass labyrinth_id for rules
        );
        
        const regenRate = floor.movement_regen_rate || 1.0;
        const currentPoints = await MovementService.getCurrentMovementPoints(
          participant.id,
          floor.id,
          regenRate
        );

        const visibleNodes = await MovementService.getVisibleNodes(participant.id, floor.id);
        const floorJoinedAt = new Date(participant.joined_at);
        const timeLimitMs = (floor.time_limit_hours || 120) * 60 * 60 * 1000;
        const timeRemaining = Math.max(0, timeLimitMs - (Date.now() - floorJoinedAt.getTime()));

        return res.json({
          success: true,
          position: newPosition,
          movementPoints: currentPoints,
          maxMovementPoints: maxPoints,
          regenRate: regenRate,
          visibleNodes,
          timeRemaining: timeRemaining,
          floorNumber: participant.floor_number,
        });
      }

      // Calculate current movement points with regeneration
      const regenRate = floor.movement_regen_rate || 1.0;
      const currentPoints = await MovementService.getCurrentMovementPoints(
        participant.id,
        floor.id,
        regenRate
      );

      const visibleNodes = await MovementService.getVisibleNodes(participant.id, floor.id);
      const floorJoinedAt = position.floor_joined_at || new Date(participant.joined_at);
      const timeLimitMs = (floor.time_limit_hours || 120) * 60 * 60 * 1000;
      const timeRemaining = Math.max(0, timeLimitMs - (Date.now() - floorJoinedAt.getTime()));

      res.json({
        success: true,
        position,
        movementPoints: currentPoints,
        maxMovementPoints: position.max_movement_points,
        regenRate: regenRate,
        visibleNodes,
        timeRemaining: timeRemaining,
        floorNumber: participant.floor_number,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch position',
      });
    }
  });

  // Move to a node
  app.post('/api/labyrinth/:id/move', async (req, res) => {
    try {
      const { id: labyrinth_id } = req.params;
      const { character_id, target_node_id } = req.body;

      if (!character_id || !target_node_id) {
        return res.status(400).json({
          success: false,
          message: 'character_id and target_node_id are required',
        });
      }

      const participant = await LabyrinthParticipantModel.findByLabyrinthAndCharacter(
        labyrinth_id,
        character_id
      );

      if (!participant || participant.status !== 'active') {
        return res.status(404).json({ success: false, message: 'Active participant not found' });
      }

      const floor = await LabyrinthFloorModel.findByLabyrinthAndFloor(
        labyrinth_id,
        participant.floor_number
      );

      if (!floor) {
        return res.status(404).json({ success: false, message: 'Floor not found' });
      }

      const result = await MovementService.moveToNode(
        participant.id,
        floor.id,
        target_node_id,
        labyrinth_id
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to move',
      });
    }
  });

  // Use stairs to transition to next floor
  app.post('/api/labyrinth/:id/use-stairs', async (req, res) => {
    try {
      const { id: labyrinth_id } = req.params;
      const { character_id, stair_node_id } = req.body;

      if (!character_id || !stair_node_id) {
        return res.status(400).json({
          success: false,
          message: 'character_id and stair_node_id are required',
        });
      }

      const participant = await LabyrinthParticipantModel.findByLabyrinthAndCharacter(
        labyrinth_id,
        character_id
      );

      if (!participant || participant.status !== 'active') {
        return res.status(404).json({ success: false, message: 'Active participant not found' });
      }

      const currentFloor = await LabyrinthFloorModel.findByLabyrinthAndFloor(
        labyrinth_id,
        participant.floor_number
      );

      if (!currentFloor) {
        return res.status(404).json({ success: false, message: 'Current floor not found' });
      }

      // Get position
      const position = await ParticipantPositionModel.findByParticipantAndFloor(
        participant.id,
        currentFloor.id
      );

      if (!position || position.current_node_id !== stair_node_id) {
        return res.status(400).json({
          success: false,
          message: 'You must be at the stairs to use them',
        });
      }

      // Get stair node
      const stairNode = await FloorNodeModel.findById(stair_node_id);
      if (!stairNode || stairNode.node_type !== 'stairs') {
        return res.status(400).json({ success: false, message: 'Invalid stair node' });
      }

      // Check if boss is required
      if (stairNode.required_boss_defeated) {
        // TODO: Check if boss was defeated (need to track boss defeats)
        // For now, allow if boss is not set
      }

      // Check capacity limit
      if (stairNode.capacity_limit !== null) {
        const usageCount = await pool.query(
          'SELECT COUNT(*) FROM labyrinth_stair_usage WHERE stair_node_id = $1',
          [stair_node_id]
        );
        if (parseInt(usageCount.rows[0].count) >= stairNode.capacity_limit) {
          return res.status(400).json({
            success: false,
            message: 'Stairs are at capacity',
          });
        }
      }

      const targetFloorNumber = stairNode.leads_to_floor_number || participant.floor_number + 1;

      // Get target floor
      const targetFloor = await LabyrinthFloorModel.findByLabyrinthAndFloor(
        labyrinth_id,
        targetFloorNumber
      );

      if (!targetFloor) {
        return res.status(404).json({
          success: false,
          message: `Target floor ${targetFloorNumber} not found`,
        });
      }

      // Update participant floor
      await pool.query(
        'UPDATE labyrinth_participants SET floor_number = $1 WHERE id = $2',
        [targetFloorNumber, participant.id]
      );

      // Record stair usage
      await pool.query(
        'INSERT INTO labyrinth_stair_usage (stair_node_id, participant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [stair_node_id, participant.id]
      );

      // Initialize position on new floor
      const maxPoints = targetFloor.max_movement_points || 10;
      await MovementService.initializePosition(
        participant.id,
        targetFloor.id,
        null, // Deprecated parameter, ignored - MovementService uses equal distribution
        maxPoints,
        labyrinth_id // Pass labyrinth_id for rules
      );

      // Award floor completion lootbox
      await RewardService.awardRewards(labyrinth_id, participant, {
        floor_reached: targetFloorNumber,
      });

      res.json({
        success: true,
        message: `Moved to floor ${targetFloorNumber}`,
        newFloorNumber: targetFloorNumber,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to use stairs',
      });
    }
  });

  // Get map data for a floor (with fog of war for current player)
  app.get('/api/labyrinth/:id/map', async (req, res) => {
    try {
      const { id: labyrinth_id } = req.params;
      const { character_id } = req.query;

      if (!character_id) {
        return res.status(400).json({ success: false, message: 'character_id is required' });
      }

      const participant = await LabyrinthParticipantModel.findByLabyrinthAndCharacter(
        labyrinth_id,
        character_id as string
      );

      if (!participant) {
        return res.status(404).json({ success: false, message: 'Participant not found' });
      }

      const floor = await LabyrinthFloorModel.findByLabyrinthAndFloor(
        labyrinth_id,
        participant.floor_number
      );

      if (!floor) {
        return res.status(404).json({ success: false, message: 'Floor not found' });
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

      // Ensure participant has a position - initialize if missing or invalid
      let position = await ParticipantPositionModel.findByParticipantAndFloor(
        participant.id,
        floor.id
      );
      if (!position || !position.current_node_id) {
        try {
          // Initialize position if doesn't exist or has no current_node_id
          const maxPoints = floor.max_movement_points || 10;
          position = await MovementService.initializePosition(
            participant.id,
            floor.id,
            null, // Deprecated parameter, ignored
            maxPoints,
            labyrinth_id // Pass labyrinth_id for rules
          );
          // Ensure position was created successfully with current_node_id
          if (!position || !position.current_node_id) {
            return res.status(500).json({
              success: false,
              message: 'Failed to initialize participant position: position created but current_node_id is null',
            });
          }
        } catch (error) {
          return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to initialize participant position',
          });
        }
      }

      // Build map data
      const fullMapData = await MapService.buildMapData(floor.id);

      // Calculate visibility for this player
      // TODO: Get character data for fog of war modifiers
      const visibility = await FogOfWarService.calculateVisibility(
        participant.id,
        floor.id,
        null, // Character data would be needed for full fog of war calculation
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

      res.json({
        success: true,
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
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch map data',
      });
    }
  });

  // Get visibility map for player
  app.get('/api/labyrinth/:id/visibility', async (req, res) => {
    try {
      const { id: labyrinth_id } = req.params;
      const { character_id } = req.query;

      if (!character_id) {
        return res.status(400).json({ success: false, message: 'character_id is required' });
      }

      const participant = await LabyrinthParticipantModel.findByLabyrinthAndCharacter(
        labyrinth_id,
        character_id as string
      );

      if (!participant) {
        return res.status(404).json({ success: false, message: 'Participant not found' });
      }

      const floor = await LabyrinthFloorModel.findByLabyrinthAndFloor(
        labyrinth_id,
        participant.floor_number
      );

      if (!floor) {
        return res.status(404).json({ success: false, message: 'Floor not found' });
      }

      // Calculate visibility
      // TODO: Get character data for fog of war modifiers
      const visibility = await FogOfWarService.calculateVisibility(
        participant.id,
        floor.id,
        null, // Character data would be needed for full fog of war calculation
        labyrinth_id
      );

      res.json({
        success: true,
        visibility: {
          visibleNodes: visibility.visibleNodes,
          exploredNodes: visibility.exploredNodes,
          adjacentNodes: visibility.adjacentNodes,
          visibilityByNode: Object.fromEntries(visibility.visibilityByNode),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch visibility',
      });
    }
  });

  // Get all nodes for a floor
  app.get('/api/labyrinth/:id/floor/:floor_number/nodes', async (req, res) => {
    try {
      const { id: labyrinth_id, floor_number } = req.params;
      const floor = await LabyrinthFloorModel.findByLabyrinthAndFloor(
        labyrinth_id,
        parseInt(floor_number, 10)
      );

      if (!floor) {
        return res.status(404).json({ success: false, message: 'Floor not found' });
      }

      const nodes = await FloorNodeModel.findByFloorId(floor.id);
      const connections = await FloorConnectionModel.findByFloorId(floor.id);

      res.json({
        success: true,
        nodes,
        connections,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch nodes',
      });
    }
  });
}
