import { create } from 'zustand';
import type { Labyrinth, LabyrinthParticipant, LabyrinthParty, LabyrinthReward } from '@idle-rpg/shared';

import type { FloorNode, FloorConnection, ParticipantPosition } from '@idle-rpg/shared';

interface LabyrinthState {
  currentLabyrinth: Labyrinth | null;
  currentParticipant: LabyrinthParticipant | null;
  currentParty: LabyrinthParty | null;
  floorPlayers: LabyrinthParticipant[];
  rewards: LabyrinthReward[];
  inCombat: boolean;
  combatId: string | null;
  combatPrepared: boolean;
  preparedCombatId: string | null;
  combatState: any | null;
  mapNodes: FloorNode[];
  mapConnections: FloorConnection[];
  visibleNodes: string[];
  currentPosition: ParticipantPosition | null;
  movementPoints: number;

  setCurrentLabyrinth: (labyrinth: Labyrinth | null) => void;
  setCurrentParticipant: (participant: LabyrinthParticipant | null) => void;
  setCurrentParty: (party: LabyrinthParty | null) => void;
  setFloorPlayers: (players: LabyrinthParticipant[]) => void;
  addReward: (reward: LabyrinthReward) => void;
  setInCombat: (inCombat: boolean, combatId?: string | null) => void;
  setCombatPrepared: (prepared: boolean, combatId?: string | null) => void;
  setCombatState: (state: any | null) => void;
  setMapData: (nodes: FloorNode[], connections: FloorConnection[]) => void;
  setVisibleNodes: (nodes: string[]) => void;
  setCurrentPosition: (position: ParticipantPosition | null) => void;
  setMovementPoints: (points: number) => void;
  reset: () => void;
}

export const useLabyrinthState = create<LabyrinthState>((set) => ({
  currentLabyrinth: null,
  currentParticipant: null,
  currentParty: null,
  floorPlayers: [],
  rewards: [],
  inCombat: false,
  combatId: null,
  combatPrepared: false,
  preparedCombatId: null,
  combatState: null,
  mapNodes: [],
  mapConnections: [],
  visibleNodes: [],
  currentPosition: null,
  movementPoints: 0,

  setCurrentLabyrinth: (labyrinth) => set({ currentLabyrinth: labyrinth }),
  setCurrentParticipant: (participant) => set({ currentParticipant: participant }),
  setCurrentParty: (party) => set({ currentParty: party }),
  setFloorPlayers: (players) => set({ floorPlayers: players }),
  addReward: (reward) => set((state) => ({ rewards: [...state.rewards, reward] })),
  setInCombat: (inCombat, combatId = null) => set({ inCombat, combatId }),
  setCombatPrepared: (prepared, combatId = null) => set({ combatPrepared: prepared, preparedCombatId: combatId }),
  setCombatState: (state) => set({ combatState: state }),
  setMapData: (nodes, connections) => set({ mapNodes: nodes, mapConnections: connections }),
  setVisibleNodes: (nodes) => set({ visibleNodes: nodes }),
  setCurrentPosition: (position) => set({ currentPosition: position }),
  setMovementPoints: (points) => set({ movementPoints: points }),
  reset: () =>
    set({
      currentLabyrinth: null,
      currentParticipant: null,
      currentParty: null,
      floorPlayers: [],
      rewards: [],
      inCombat: false,
      combatId: null,
      combatPrepared: false,
      preparedCombatId: null,
      combatState: null,
      mapNodes: [],
      mapConnections: [],
      visibleNodes: [],
      currentPosition: null,
      movementPoints: 0,
    }),
}));
