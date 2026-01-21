// Client → Server Events
export const CLIENT_EVENTS = {
  JOIN: 'labyrinth:join',
  CREATE_PARTY: 'labyrinth:create_party',
  JOIN_PARTY: 'labyrinth:join_party',
  LEAVE_PARTY: 'labyrinth:leave_party',
  MOVE: 'labyrinth:move',
  INITIATE_COMBAT: 'labyrinth:initiate_combat',
  JOIN_COMBAT: 'labyrinth:join_combat',
  COMBAT_ACTION: 'labyrinth:combat_action',
  CLAIM_REWARDS: 'labyrinth:claim_rewards',
} as const;

// Server → Client Events
export const SERVER_EVENTS = {
  JOINED: 'labyrinth:joined',
  PLAYER_JOINED: 'labyrinth:player_joined',
  PLAYER_LEFT: 'labyrinth:player_left',
  FLOOR_CHANGED: 'labyrinth:floor_changed',
  PLAYER_DISCOVERED: 'labyrinth:player_discovered',
  COMBAT_PREPARED: 'labyrinth:combat_prepared',
  COMBAT_INITIATED: 'labyrinth:combat_initiated',
  COMBAT_UPDATE: 'labyrinth:combat_update',
  COMBAT_STATE: 'labyrinth:combat_state',
  COMBAT_ENDED: 'labyrinth:combat_ended',
  ELIMINATED: 'labyrinth:eliminated',
  COMPLETED: 'labyrinth:completed',
  REWARD_EARNED: 'labyrinth:reward_earned',
  ERROR: 'labyrinth:error',
} as const;
