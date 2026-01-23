import type { Monster, CombatParticipant, Character } from '@idle-rpg/shared';
import { MonsterSpawnService } from './MonsterSpawnService.js';
import { FloorNodeModel } from '../models/FloorNode.js';
import { LabyrinthParticipantModel } from '../models/LabyrinthParticipant.js';
import { ParticipantPositionModel } from '../models/ParticipantPosition.js';
import { LabyrinthPartyModel } from '../models/LabyrinthParty.js';

export interface PreparedCombat {
  combatInstanceId: string;
  nodeId: string;
  floorId: string;
  monsters: Monster[];
  participants: CombatParticipant[];
  preparedAt: Date;
}

export class CombatService {
  private static activeCombatInstances: Map<string, PreparedCombat> = new Map();

  /**
   * Prepare combat for a node when a player enters a combat area
   */
  static async prepareCombatForNode(
    nodeId: string,
    floorId: string,
    participantId: string
  ): Promise<PreparedCombat | null> {
    // Check if combat is already prepared for this node
    const existingCombat = Array.from(this.activeCombatInstances.values()).find(
      (c) => c.nodeId === nodeId && c.floorId === floorId
    );

    if (existingCombat) {
      // Add participant to existing combat if not already included
      const participant = await this.createCombatParticipant(participantId);
      if (participant && !existingCombat.participants.find((p) => p.id === participantId)) {
        existingCombat.participants.push(participant);
      }
      return existingCombat;
    }

    // Get node to determine combat type
    const node = await FloorNodeModel.findById(nodeId);
    if (!node) {
      return null;
    }

    // Check if node is a combat area
    // Skip if node has POI combat enabled (POI combat is handled separately)
    const hasPOICombat = node.metadata?.poi_combat?.enabled === true;
    const isCombatArea = node.node_type === 'monster_spawn' || node.node_type === 'boss';
    if (!isCombatArea || hasPOICombat) {
      return null;
    }

    // Get all players on this node
    const playersOnNode = await ParticipantPositionModel.getPlayersOnNode(nodeId);
    
    // Get character level for monster spawning (use first player's level)
    let characterLevel = 1;
    if (playersOnNode.length > 0) {
      // TODO: Get character level from participant or character data
      // For now, use default level
      characterLevel = 1; // Placeholder
    }

    // Spawn monsters for the node
    const monsters = await MonsterSpawnService.spawnMonstersForNode(
      nodeId,
      floorId,
      characterLevel
    );
    console.log(`[CombatService] Spawned ${monsters.length} monsters for node ${nodeId}`);

    // If no monsters were spawned, combat cannot proceed
    // This can happen if the floor has no monster pool configured
    if (monsters.length === 0) {
      console.log(`[CombatService] Cannot prepare combat for node ${nodeId} - no monsters spawned (floor may not have monster pool configured)`);
      return null;
    }

    // Get all participants (players on node + their party members)
    const participants: CombatParticipant[] = [];

    for (const participantId of playersOnNode) {
      const participant = await this.createCombatParticipant(participantId);
      if (participant) {
        participants.push(participant);
      }

      // Add party members on the same node
      const party = await LabyrinthPartyModel.findByParticipant(participantId);
      if (party) {
        // Get the current participant to get their character_id
        const currentParticipant = await LabyrinthParticipantModel.findById(participantId);
        if (!currentParticipant) continue;

        for (const memberCharacterId of party.members) {
          // Skip if this is the current player (already added)
          if (memberCharacterId === currentParticipant.character_id) continue;

          // Find the participant for this character_id in this labyrinth
          const memberParticipant = await LabyrinthParticipantModel.findByLabyrinthAndCharacter(
            currentParticipant.labyrinth_id,
            memberCharacterId
          );
          if (!memberParticipant) continue;

          // Check if party member is on the same node
          const memberPosition = await ParticipantPositionModel.findByParticipantAndFloor(
            memberParticipant.id,
            floorId
          );
          if (memberPosition?.current_node_id === nodeId) {
            const combatParticipant = await this.createCombatParticipant(memberParticipant.id);
            if (combatParticipant && !participants.find((p) => p.id === memberParticipant.id)) {
              participants.push(combatParticipant);
            }
          }
        }
      }
    }

    // Validate party size (max 5 players)
    if (participants.length > 5) {
      // Take first 5 participants
      participants.splice(5);
    }

    // Create combat instance
    const combatInstanceId = `combat_${nodeId}_${Date.now()}`;
    const preparedCombat: PreparedCombat = {
      combatInstanceId,
      nodeId,
      floorId,
      monsters,
      participants,
      preparedAt: new Date(),
    };

    console.log(`[CombatService] Prepared combat ${combatInstanceId} with ${monsters.length} monsters and ${participants.length} participants`);
    this.activeCombatInstances.set(combatInstanceId, preparedCombat);

    return preparedCombat;
  }

  /**
   * Get prepared combat for a node
   */
  static getPreparedCombat(nodeId: string, floorId: string): PreparedCombat | null {
    return Array.from(this.activeCombatInstances.values()).find(
      (c) => c.nodeId === nodeId && c.floorId === floorId
    ) || null;
  }

  /**
   * Get prepared combat by instance ID
   */
  static getPreparedCombatById(combatInstanceId: string): PreparedCombat | null {
    return this.activeCombatInstances.get(combatInstanceId) || null;
  }

  /**
   * Add party member to prepared combat
   * Returns an object with success status and error message if failed
   */
  static async addPartyMemberToCombat(
    combatInstanceId: string,
    participantId: string
  ): Promise<{ success: boolean; error?: string }> {
    const combat = this.activeCombatInstances.get(combatInstanceId);
    if (!combat) {
      return { success: false, error: 'Combat instance not found' };
    }

    // Check party size limit
    if (combat.participants.length >= 5) {
      return { success: false, error: 'Combat party is full (maximum 5 players)' };
    }

    // Check if already in combat
    if (combat.participants.find((p) => p.id === participantId)) {
      return { success: true }; // Already added
    }

    // Verify party membership
    const firstParticipantId = combat.participants[0]?.id;
    if (!firstParticipantId) {
      return { success: false, error: 'No participants in combat instance' };
    }

    const party = await LabyrinthPartyModel.findByParticipant(firstParticipantId);
    if (!party) {
      return { success: false, error: 'You must be in a party to join this combat' };
    }

    // Get character_id for the participant trying to join
    const joiningParticipant = await LabyrinthParticipantModel.findById(participantId);
    if (!joiningParticipant) {
      return { success: false, error: 'Participant not found' };
    }
    
    if (!party.members.includes(joiningParticipant.character_id)) {
      return { success: false, error: 'You must be in the same party as the combat initiator' };
    }

    // Verify participant is on the same node
    const participantPosition = await ParticipantPositionModel.findByParticipantAndFloor(
      participantId,
      combat.floorId
    );
    if (participantPosition?.current_node_id !== combat.nodeId) {
      return { success: false, error: 'You must be on the same node to join combat' };
    }

    // Add participant to combat
    const combatParticipant = await this.createCombatParticipant(participantId);
    if (combatParticipant) {
      combat.participants.push(combatParticipant);
      return { success: true };
    }

    return { success: false, error: 'Failed to create combat participant (character data required)' };
  }

  /**
   * Remove combat instance
   */
  static removeCombatInstance(combatInstanceId: string): void {
    this.activeCombatInstances.delete(combatInstanceId);
  }

  /**
   * Create a CombatParticipant from character data
   * Character data should be provided by the client when combat is prepared
   */
  static createCombatParticipantFromCharacter(
    participantId: string,
    character: Character
  ): CombatParticipant {
    return {
      id: participantId,
      name: character.name,
      isPlayer: true,
      stats: { ...character.combatStats },
      currentHealth: character.combatStats.health,
      currentMana: character.combatStats.mana,
      statusEffects: [],
      isAlive: true,
    };
  }

  /**
   * Create a CombatParticipant from a participant ID (legacy method for backward compatibility)
   */
  private static async createCombatParticipant(
    participantId: string
  ): Promise<CombatParticipant | null> {
    const participant = await LabyrinthParticipantModel.findById(participantId);
    if (!participant) {
      return null;
    }

    // This method requires character data to be provided by the client
    // For now, return null - character data should be sent when combat is prepared
    return null;
  }
}
