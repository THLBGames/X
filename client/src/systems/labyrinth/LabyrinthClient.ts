import { io, Socket } from 'socket.io-client';
import { CLIENT_EVENTS, SERVER_EVENTS } from './events';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export interface LabyrinthClientCallbacks {
  onJoined?: (data: any) => void;
  onPlayerJoined?: (data: any) => void;
  onPlayerLeft?: (data: any) => void;
  onFloorChanged?: (data: any) => void;
  onPlayerDiscovered?: (data: any) => void;
  onCombatPrepared?: (data: any) => void;
  onCombatInitiated?: (data: any) => void;
  onCombatUpdate?: (data: any) => void;
  onCombatState?: (data: any) => void;
  onCombatEnded?: (data: any) => void;
  onEliminated?: (data: any) => void;
  onCompleted?: (data: any) => void;
  onRewardEarned?: (data: any) => void;
  onMapData?: (data: any) => void;
  onMapUpdate?: (data: any) => void;
  onVisibilityUpdate?: (data: any) => void;
  onBossRoomLocked?: (data: any) => void;
  onError?: (data: any) => void;
}

export class LabyrinthClient {
  private socket: Socket | null = null;
  private callbacks: LabyrinthClientCallbacks = {};
  private connected: boolean = false;

  constructor(callbacks: LabyrinthClientCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Connect to the labyrinth server
   */
  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('Connected to labyrinth server');
      this.connected = true;
      this.setupEventListeners();
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from labyrinth server');
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.callbacks.onError?.({ message: 'Failed to connect to server' });
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Join a labyrinth
   */
  joinLabyrinth(labyrinth_id: string, character_id: string): void {
    if (!this.socket?.connected) {
      this.callbacks.onError?.({ message: 'Not connected to server' });
      return;
    }

    this.socket.emit(CLIENT_EVENTS.JOIN, { labyrinth_id, character_id });
  }

  /**
   * Create a party
   */
  createParty(labyrinth_id: string, leader_character_id: string, name?: string): void {
    if (!this.socket?.connected) {
      this.callbacks.onError?.({ message: 'Not connected to server' });
      return;
    }

    this.socket.emit(CLIENT_EVENTS.CREATE_PARTY, { labyrinth_id, leader_character_id, name });
  }

  /**
   * Join an existing party
   */
  joinParty(party_id: string, character_id: string): void {
    if (!this.socket?.connected) {
      this.callbacks.onError?.({ message: 'Not connected to server' });
      return;
    }

    this.socket.emit(CLIENT_EVENTS.JOIN_PARTY, { party_id, character_id });
  }

  /**
   * Leave a party
   */
  leaveParty(party_id: string, character_id: string): void {
    if (!this.socket?.connected) {
      this.callbacks.onError?.({ message: 'Not connected to server' });
      return;
    }

    this.socket.emit(CLIENT_EVENTS.LEAVE_PARTY, { party_id, character_id });
  }

  /**
   * Update player position
   */
  updatePosition(participant_id: string, position: { x: number; y: number }): void {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit(CLIENT_EVENTS.MOVE, { participant_id, position });
  }

  /**
   * Request movement to a node
   */
  requestMove(participant_id: string, target_node_id: string, confirm: boolean = false): void {
    if (!this.socket?.connected) {
      this.callbacks.onError?.({ message: 'Not connected to server' });
      return;
    }

    if (confirm) {
      this.socket.emit(CLIENT_EVENTS.MOVEMENT_CONFIRMED, { participant_id, target_node_id });
    } else {
      this.socket.emit(CLIENT_EVENTS.MOVEMENT_REQUEST, { participant_id, target_node_id });
    }
  }

  /**
   * Request map data
   */
  requestMapData(labyrinth_id: string, character_id: string): void {
    if (!this.socket?.connected) {
      this.callbacks.onError?.({ message: 'Not connected to server' });
      return;
    }

    this.socket.emit(CLIENT_EVENTS.REQUEST_MAP_DATA, { labyrinth_id, character_id });
  }

  /**
   * Initiate combat (PvE or PvP)
   */
  initiateCombat(
    participant_id: string,
    combat_instance_id?: string,
    target_participant_id?: string,
    combat_type: 'pvp' | 'pve' = 'pve',
    character_data?: any
  ): void {
    if (!this.socket?.connected) {
      this.callbacks.onError?.({ message: 'Not connected to server' });
      return;
    }

    this.socket.emit(CLIENT_EVENTS.INITIATE_COMBAT, {
      participant_id,
      combat_instance_id,
      target_participant_id,
      combat_type,
      character_data,
    });
  }

  /**
   * Join combat (for party members)
   */
  joinCombat(participant_id: string, combat_instance_id: string, character_data?: any): void {
    if (!this.socket?.connected) {
      this.callbacks.onError?.({ message: 'Not connected to server' });
      return;
    }

    this.socket.emit(CLIENT_EVENTS.JOIN_COMBAT, {
      participant_id,
      combat_instance_id,
      character_data,
    });
  }

  /**
   * Send combat action
   */
  sendCombatAction(
    participant_id: string,
    combat_instance_id: string,
    action_type: 'skill' | 'item' | 'attack',
    skill_id?: string,
    item_id?: string
  ): void {
    if (!this.socket?.connected) {
      this.callbacks.onError?.({ message: 'Not connected to server' });
      return;
    }

    this.socket.emit(CLIENT_EVENTS.COMBAT_ACTION, {
      participant_id,
      combat_instance_id,
      action_type,
      skill_id,
      item_id,
    });
  }

  /**
   * Claim rewards
   */
  claimRewards(character_id: string, reward_ids: string[]): void {
    if (!this.socket?.connected) {
      this.callbacks.onError?.({ message: 'Not connected to server' });
      return;
    }

    this.socket.emit(CLIENT_EVENTS.CLAIM_REWARDS, { character_id, reward_ids });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on(SERVER_EVENTS.JOINED, (data) => {
      this.callbacks.onJoined?.(data);
    });

    this.socket.on(SERVER_EVENTS.PLAYER_JOINED, (data) => {
      this.callbacks.onPlayerJoined?.(data);
    });

    this.socket.on(SERVER_EVENTS.PLAYER_LEFT, (data) => {
      this.callbacks.onPlayerLeft?.(data);
    });

    this.socket.on(SERVER_EVENTS.FLOOR_CHANGED, (data) => {
      this.callbacks.onFloorChanged?.(data);
    });

    this.socket.on(SERVER_EVENTS.PLAYER_DISCOVERED, (data) => {
      this.callbacks.onPlayerDiscovered?.(data);
    });

    this.socket.on(SERVER_EVENTS.COMBAT_PREPARED, (data) => {
      this.callbacks.onCombatPrepared?.(data);
    });

    this.socket.on(SERVER_EVENTS.COMBAT_INITIATED, (data) => {
      this.callbacks.onCombatInitiated?.(data);
    });

    this.socket.on(SERVER_EVENTS.COMBAT_UPDATE, (data) => {
      this.callbacks.onCombatUpdate?.(data);
    });

    this.socket.on(SERVER_EVENTS.COMBAT_STATE, (data) => {
      this.callbacks.onCombatState?.(data);
    });

    this.socket.on(SERVER_EVENTS.COMBAT_ENDED, (data) => {
      this.callbacks.onCombatEnded?.(data);
    });

    this.socket.on(SERVER_EVENTS.ELIMINATED, (data) => {
      this.callbacks.onEliminated?.(data);
    });

    this.socket.on(SERVER_EVENTS.COMPLETED, (data) => {
      this.callbacks.onCompleted?.(data);
    });

    this.socket.on(SERVER_EVENTS.REWARD_EARNED, (data) => {
      this.callbacks.onRewardEarned?.(data);
    });

    this.socket.on(SERVER_EVENTS.MAP_DATA, (data) => {
      this.callbacks.onMapData?.(data);
    });

    this.socket.on(SERVER_EVENTS.MAP_UPDATE, (data) => {
      this.callbacks.onMapUpdate?.(data);
    });

    this.socket.on(SERVER_EVENTS.VISIBILITY_UPDATE, (data) => {
      this.callbacks.onVisibilityUpdate?.(data);
    });

    this.socket.on(SERVER_EVENTS.BOSS_ROOM_LOCKED, (data) => {
      this.callbacks.onBossRoomLocked?.(data);
    });

    this.socket.on(SERVER_EVENTS.ERROR, (data) => {
      this.callbacks.onError?.(data);
    });
  }
}
