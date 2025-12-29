import { create } from 'zustand';
import type {
  Character,
  Inventory,
  DungeonProgress,
  QuestProgress,
  GameSettings,
  SaveData,
  ActiveCombatState,
  CombatAction,
  Monster,
  ActiveAction,
} from '@idle-rpg/shared';
import { QuestManager } from '../systems/quest/QuestManager';
import { getDataLoader } from '../data';
import { stopAllIdleSkills } from '../hooks/useIdleSkills';

interface GameState {
  // Character state
  character: Character | null;

  // Inventory state
  inventory: Inventory;

  // Progress state
  dungeonProgress: DungeonProgress[];

  // Settings
  settings: GameSettings;

  // Game state flags
  isInitialized: boolean;
  isCombatActive: boolean;
  currentDungeonId: string | null;
  currentCombatState: ActiveCombatState | null;
  queuedSkillId: string | null;
  combatRoundNumber: number;
  activeAction: ActiveAction;
  maxOfflineHours: number;

  // Actions - Character
  setCharacter: (character: Character) => void;
  updateCharacter: (updates: Partial<Character>) => void;
  updateIdleSkill: (
    skillId: string,
    skillData: { level: number; experience: number; experienceToNext: number }
  ) => void;
  updateSkillBar: (skillBar: string[]) => void;

  // Actions - Inventory
  setInventory: (inventory: Inventory) => void;
  addItem: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string, quantity: number) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  reorderInventoryItems: (fromIndex: number, toIndex: number) => void;

  // Actions - Progress
  setDungeonProgress: (progress: DungeonProgress[]) => void;
  updateDungeonProgress: (dungeonId: string, updates: Partial<DungeonProgress>) => void;
  unlockDungeon: (dungeonId: string) => void;
  completeDungeon: (dungeonId: string, time?: number) => void;

  // Actions - Quest Progress
  updateQuestProgress: (questId: string, amount?: number) => void;
  completeQuest: (questId: string) => void;

  // Actions - Settings
  updateSettings: (settings: Partial<GameSettings>) => void;

  // Actions - Game state
  initialize: (saveData?: SaveData) => void;
  reset: () => void;
  setCombatActive: (active: boolean) => void;
  setCurrentDungeon: (dungeonId: string | null) => void;
  startCombat: (dungeonId: string) => void;
  stopCombat: () => void;
  startCombatWithMonsters: (
    monsters: Monster[],
    roundNumber: number,
    isBossRound: boolean,
    playerHealth: number,
    playerMaxHealth: number,
    playerMana: number,
    playerMaxMana: number
  ) => void;
  updateCombatState: (updates: Partial<ActiveCombatState>) => void;
  addCombatAction: (action: CombatAction) => void;
  endCombat: () => void;
  queueSkill: (skillId: string | null) => void;
  setCombatRoundNumber: (round: number) => void;
  setActiveAction: (action: ActiveAction) => void;
  setMaxOfflineHours: (hours: number) => void;
}

const defaultInventory: Inventory = {
  items: [],
  maxSlots: 50,
};

const defaultSettings: GameSettings = {
  soundEnabled: true,
  musicEnabled: true,
  autoCombat: true,
  combatSpeed: 3,
  showDamageNumbers: true,
};

export const useGameState = create<GameState>((set, get) => ({
  // Initial state
  character: null,
  inventory: defaultInventory,
  dungeonProgress: [],
  settings: defaultSettings,
  isInitialized: false,
  isCombatActive: false,
  currentDungeonId: null,
  currentCombatState: null,
  queuedSkillId: null,
  combatRoundNumber: 0,
  activeAction: null,
  maxOfflineHours: 8, // Default 8 hours

  // Character actions
  setCharacter: (character) => set({ character }),

  updateCharacter: (updates) =>
    set((state) => ({
      character: state.character ? { ...state.character, ...updates } : null,
    })),

  updateIdleSkill: (skillId, skillData) =>
    set((state) => {
      if (!state.character || !state.character.idleSkills) {
        return {};
      }

      const idleSkills = [...state.character.idleSkills];
      const index = idleSkills.findIndex((s) => s.skillId === skillId);

      if (index !== -1) {
        idleSkills[index] = { skillId, ...skillData };
      } else {
        idleSkills.push({ skillId, ...skillData });
      }

      return {
        character: {
          ...state.character,
          idleSkills,
        },
      };
    }),

  updateSkillBar: (skillBar) =>
    set((state) => {
      if (!state.character) return {};
      // Limit to 8 skills for combat skill bar
      const limitedSkillBar = skillBar.slice(0, 8);
      return {
        character: {
          ...state.character,
          skillBar: limitedSkillBar,
        },
      };
    }),

  // Inventory actions
  setInventory: (inventory) => set({ inventory }),

  addItem: (itemId, quantity) =>
    set((state) => {
      // Update quest progress for item_collection quests
      let updatedCharacter = state.character;
      if (state.character) {
        const dataLoader = getDataLoader();
        const allQuests = dataLoader.getAllQuests();

        for (const quest of allQuests) {
          if (quest.type === 'item_collection' && quest.requirements.itemId === itemId) {
            updatedCharacter = QuestManager.updateQuestProgress(
              updatedCharacter!,
              quest.id,
              quantity
            );
          }
        }
      }
      const inventory = { ...state.inventory };
      const existingItem = inventory.items.find((item) => item.itemId === itemId);

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        inventory.items.push({ itemId, quantity });
      }

      return {
        inventory,
        character: updatedCharacter || state.character,
      };
    }),

  removeItem: (itemId, quantity) =>
    set((state) => {
      const inventory = { ...state.inventory };
      const itemIndex = inventory.items.findIndex((item) => item.itemId === itemId);

      if (itemIndex !== -1) {
        inventory.items[itemIndex].quantity -= quantity;
        if (inventory.items[itemIndex].quantity <= 0) {
          inventory.items.splice(itemIndex, 1);
        }
      }
      return { inventory };
    }),

  updateItemQuantity: (itemId, quantity) =>
    set((state) => {
      const inventory = { ...state.inventory };
      const item = inventory.items.find((i) => i.itemId === itemId);
      if (item) {
        item.quantity = quantity;
      }
      return { inventory };
    }),

  reorderInventoryItems: (fromIndex, toIndex) =>
    set((state) => {
      const inventory = { ...state.inventory };
      const items = [...inventory.items];
      const [movedItem] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, movedItem);
      return { inventory: { ...inventory, items } };
    }),

  // Progress actions
  setDungeonProgress: (progress) => set({ dungeonProgress: progress }),

  updateDungeonProgress: (dungeonId, updates) =>
    set((state) => ({
      dungeonProgress: state.dungeonProgress.map((dp) =>
        dp.dungeonId === dungeonId ? { ...dp, ...updates } : dp
      ),
    })),

  unlockDungeon: (dungeonId) =>
    set((state) => {
      if (!state.dungeonProgress.some((dp) => dp.dungeonId === dungeonId)) {
        return {
          dungeonProgress: [
            ...state.dungeonProgress,
            { dungeonId, completed: false, timesCompleted: 0 },
          ],
        };
      }
      return {};
    }),

  completeDungeon: (dungeonId, time) =>
    set((state) => {
      const updatedDungeonProgress = state.dungeonProgress.map((dp) =>
        dp.dungeonId === dungeonId
          ? { ...dp, completed: true, timesCompleted: dp.timesCompleted + 1, bestTime: time }
          : dp
      );

      // Update quest progress for dungeon_completion quests
      let updatedCharacter = state.character;
      if (state.character) {
        const dataLoader = getDataLoader();
        const allQuests = dataLoader.getAllQuests();

        for (const quest of allQuests) {
          if (quest.type === 'dungeon_completion' && quest.requirements.dungeonId === dungeonId) {
            updatedCharacter = QuestManager.updateQuestProgress(updatedCharacter!, quest.id, 1);
          }
        }
      }

      return {
        dungeonProgress: updatedDungeonProgress,
        character: updatedCharacter || state.character,
      };
    }),

  // Quest progress actions
  updateQuestProgress: (questId, amount = 1) =>
    set((state) => {
      if (!state.character) return {};

      const updatedCharacter = QuestManager.updateQuestProgress(state.character, questId, amount);

      return { character: updatedCharacter };
    }),

  completeQuest: (questId) =>
    set((state) => {
      if (!state.character) return {};

      const updatedCharacter = QuestManager.completeQuest(state.character, questId);

      return { character: updatedCharacter };
    }),

  // Settings actions
  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),

  // Game state actions
  initialize: (saveData) => {
    if (saveData) {
      set({
        character: saveData.character,
        inventory: saveData.inventory,
        dungeonProgress: saveData.dungeonProgress,
        settings: saveData.settings,
        isInitialized: true,
        currentDungeonId: saveData.currentDungeonId,
        combatRoundNumber: saveData.combatRoundNumber || 0,
        activeAction: saveData.activeAction ?? null,
        maxOfflineHours: saveData.maxOfflineHours ?? 8,
      });
    } else {
      set({ isInitialized: true, activeAction: null, maxOfflineHours: 8 });
    }
  },

  reset: () =>
    set({
      character: null,
      inventory: defaultInventory,
      dungeonProgress: [],
      isInitialized: false,
      isCombatActive: false,
      currentDungeonId: null,
      currentCombatState: null,
      queuedSkillId: null,
      combatRoundNumber: 0,
      activeAction: null,
      maxOfflineHours: 8,
    }),

  setCombatActive: (active) =>
    set((state) => ({
      isCombatActive: active,
      combatRoundNumber: active ? state.combatRoundNumber : 0, // Reset rounds when stopping
    })),

  setCurrentDungeon: (dungeonId) => set({ currentDungeonId: dungeonId }),

  startCombat: (dungeonId) => {
    // Stop all idle skills before starting combat
    stopAllIdleSkills();

    set({
      isCombatActive: true,
      currentDungeonId: dungeonId,
      combatRoundNumber: 0, // Start at round 0
      activeAction: { type: 'combat', dungeonId },
    });
  },

  stopCombat: () =>
    set({
      isCombatActive: false,
      combatRoundNumber: 0,
      activeAction: null, // Clear active action when stopping combat
    }),

  startCombatWithMonsters: (
    monsters,
    roundNumber,
    isBossRound,
    playerHealth,
    playerMaxHealth,
    playerMana,
    playerMaxMana
  ) => {
    const state = get();
    const character = state.character;

    const monsterStates = monsters.map((monster) => ({
      monster,
      currentHealth: monster.stats.health || monster.stats.maxHealth,
      maxHealth: monster.stats.maxHealth || monster.stats.health,
    }));
    // Create player party member from character
    const playerPartyMember: ActivePlayerPartyMember = {
      id: 'player',
      name: character?.name || 'Player',
      isSummoned: false,
      currentHealth: playerHealth,
      maxHealth: playerMaxHealth,
      currentMana: playerMana,
      maxMana: playerMaxMana,
      level: character?.level,
    };

    const newCombatState: ActiveCombatState = {
      playerParty: [playerPartyMember], // Start with just player, summoned entities added later
      monsters: monsterStates,
      playerHealth, // Keep for backwards compatibility
      playerMaxHealth,
      playerMana,
      playerMaxMana,
      currentActor: 'player',
      currentPlayerIndex: 0,
      currentMonsterIndex: 0,
      recentActions: [],
      turnNumber: 0,
      roundNumber,
      isBossRound,
    };

    set({
      currentCombatState: newCombatState,
      queuedSkillId: null,
    });
  },

  updateCombatState: (updates) =>
    set((state) => {
      if (!state.currentCombatState) return {};
      return {
        currentCombatState: {
          ...state.currentCombatState,
          // Preserve existing monsters if not explicitly updated
          monsters:
            updates.monsters !== undefined ? updates.monsters : state.currentCombatState.monsters,
          ...updates,
        },
      };
    }),

  addCombatAction: (action) =>
    set((state) => {
      if (!state.currentCombatState) return {};
      const recentActions = [...state.currentCombatState.recentActions, action];
      if (recentActions.length > 20) {
        recentActions.shift();
      }
      return {
        currentCombatState: {
          ...state.currentCombatState,
          recentActions,
        },
      };
    }),

  endCombat: () =>
    set({
      currentCombatState: null,
      queuedSkillId: null,
      // Keep combatRoundNumber so it persists across rounds
    }),

  queueSkill: (skillId) =>
    set({
      queuedSkillId: skillId,
    }),

  setCombatRoundNumber: (round) =>
    set((state) => ({
      combatRoundNumber: round,
    })),

  setActiveAction: (action) => set({ activeAction: action }),

  setMaxOfflineHours: (hours) => set({ maxOfflineHours: Math.max(8, hours) }), // Minimum 8 hours
}));
