import { create } from 'zustand';
import type {
  Character,
  Inventory,
  DungeonProgress,
  GameSettings,
  SaveData,
  ActiveCombatState,
  CombatAction,
  Monster,
  ActiveAction,
  ActivePlayerPartyMember,
} from '@idle-rpg/shared';
import { QuestManager } from '../systems/quest/QuestManager';
import { MercenaryManager } from '../systems/mercenary/MercenaryManager';
import { UpgradeManager } from '../systems/upgrade/UpgradeManager';
import { StatisticsManager } from '../systems/statistics/StatisticsManager';
import { AchievementManager } from '../systems/achievements/AchievementManager';
import { InventoryManager } from '../systems/inventory';
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

  // Actions - Mercenaries
  rentMercenary: (mercenaryId: string) => void;
  removeMercenary: (mercenaryId: string) => void;
  consumeMercenaryBattle: (mercenaryId: string) => void;
  consumeMercenaryAction: (mercenaryId: string) => void;

  // Actions - Upgrades
  purchaseUpgrade: (upgradeId: string) => void;
  activateConsumable: (upgradeId: string) => void;
  consumeUpgradeAction: (skillId: string) => void;

  // Actions - Statistics
  recordMonsterKill: (monsterId: string) => void;
  recordItemCollected: (itemId: string, quantity: number) => void;
  recordSkillAction: (skillId: string) => void;
  updateCombatStats: (victory: boolean, gold: number, experience: number) => void;
  checkAchievements: () => void;
  claimAchievementRewards: (achievementId: string) => void;

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
  soundVolume: 100,
  musicVolume: 100,
  theme: 'dark',
  fontSize: 'medium',
  animationsEnabled: true,
  showTooltips: true,
  confirmItemDrop: true,
  confirmItemSell: false,
  showNotifications: true,
  autoSaveInterval: 30, // 30 seconds
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
          if (
            quest.type === 'item_collection' &&
            quest.requirements.itemId === itemId &&
            updatedCharacter
          ) {
            updatedCharacter = QuestManager.updateQuestProgress(
              updatedCharacter,
              quest.id,
              quantity
            );
          }
        }

        // Record item collection in statistics
        if (updatedCharacter) {
          const statistics =
            updatedCharacter.statistics || StatisticsManager.initializeStatistics();
          const updatedStatistics = StatisticsManager.recordItemCollected(
            statistics,
            itemId,
            quantity
          );
          updatedCharacter = {
            ...updatedCharacter,
            statistics: updatedStatistics,
          };
        }
      }

      // Use InventoryManager to properly stack items
      const inventory = InventoryManager.addItem(state.inventory, itemId, quantity);

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

  // Mercenary actions
  rentMercenary: (mercenaryId) =>
    set((state) => {
      if (!state.character) return {};

      const result = MercenaryManager.rentMercenary(state.inventory, state.character, mercenaryId);

      if (result.success && result.newInventory) {
        const dataLoader = getDataLoader();
        const mercenary = dataLoader.getMercenary(mercenaryId);
        if (mercenary) {
          const activeMercenary = MercenaryManager.createActiveMercenary(mercenary);
          const updatedCharacter = {
            ...state.character,
            activeMercenaries: [...(state.character.activeMercenaries || []), activeMercenary],
          };

          return {
            character: updatedCharacter,
            inventory: result.newInventory,
          };
        }
      }

      return {};
    }),

  removeMercenary: (mercenaryId) =>
    set((state) => {
      if (!state.character) return {};

      const updatedCharacter = MercenaryManager.removeMercenary(state.character, mercenaryId);

      return { character: updatedCharacter };
    }),

  consumeMercenaryBattle: (mercenaryId) =>
    set((state) => {
      if (!state.character) return {};

      const updatedCharacter = MercenaryManager.consumeBattle(state.character, mercenaryId);

      return { character: updatedCharacter };
    }),

  consumeMercenaryAction: (mercenaryId) =>
    set((state) => {
      if (!state.character) return {};

      const updatedCharacter = MercenaryManager.consumeAction(state.character, mercenaryId);

      return { character: updatedCharacter };
    }),

  // Upgrade actions
  purchaseUpgrade: (upgradeId) =>
    set((state) => {
      if (!state.character) return {};

      const result = UpgradeManager.purchaseUpgrade(state.inventory, state.character, upgradeId);

      if (result.success && result.newInventory) {
        const dataLoader = getDataLoader();
        const upgrade = dataLoader.getUpgrade(upgradeId);
        if (upgrade && upgrade.type === 'permanent') {
          const existingUpgrade = (state.character.activeUpgrades || []).find(
            (au) => au.upgradeId === upgradeId
          );

          if (existingUpgrade && result.upgradeTier) {
            // Upgrading existing upgrade
            const updatedUpgrades = (state.character.activeUpgrades || []).map((au) =>
              au.upgradeId === upgradeId ? { ...au, tier: result.upgradeTier as any } : au
            );
            return {
              character: {
                ...state.character,
                activeUpgrades: updatedUpgrades,
              },
              inventory: result.newInventory,
            };
          } else if (result.upgradeTier) {
            // Purchasing new upgrade
            const newUpgrade = {
              upgradeId: upgradeId,
              tier: result.upgradeTier as any,
              purchasedAt: Date.now(),
            };
            return {
              character: {
                ...state.character,
                activeUpgrades: [...(state.character.activeUpgrades || []), newUpgrade],
              },
              inventory: result.newInventory,
            };
          }
        }
      }

      return {};
    }),

  activateConsumable: (upgradeId) =>
    set((state) => {
      if (!state.character) return {};

      const result = UpgradeManager.activateConsumable(state.inventory, state.character, upgradeId);

      if (result.success && result.newInventory && result.actionDuration) {
        const newConsumable = {
          upgradeId: upgradeId,
          tier: 'I' as any, // Consumables don't have tiers, but required by interface
          purchasedAt: Date.now(),
          remainingActions: result.actionDuration,
        };
        return {
          character: {
            ...state.character,
            consumableUpgrades: [...(state.character.consumableUpgrades || []), newConsumable],
          },
          inventory: result.newInventory,
        };
      }

      return {};
    }),

  consumeUpgradeAction: (skillId) =>
    set((state) => {
      if (!state.character) return {};

      const updatedCharacter = UpgradeManager.consumeAction(state.character, skillId);

      return { character: updatedCharacter };
    }),

  // Statistics actions
  recordMonsterKill: (monsterId: string) =>
    set((state) => {
      if (!state.character) return {};

      const statistics = state.character.statistics || StatisticsManager.initializeStatistics();
      const updatedStatistics = StatisticsManager.recordMonsterKill(statistics, monsterId);

      return {
        character: {
          ...state.character,
          statistics: updatedStatistics,
        },
      };
    }),

  recordItemCollected: (itemId: string, quantity: number) =>
    set((state) => {
      if (!state.character) return {};

      const statistics = state.character.statistics || StatisticsManager.initializeStatistics();
      const updatedStatistics = StatisticsManager.recordItemCollected(statistics, itemId, quantity);

      return {
        character: {
          ...state.character,
          statistics: updatedStatistics,
        },
      };
    }),

  recordSkillAction: (skillId: string) =>
    set((state) => {
      if (!state.character) return {};

      const statistics = state.character.statistics || StatisticsManager.initializeStatistics();
      const updatedStatistics = StatisticsManager.recordSkillAction(statistics, skillId);

      return {
        character: {
          ...state.character,
          statistics: updatedStatistics,
        },
      };
    }),

  updateCombatStats: (victory: boolean, gold: number, experience: number) =>
    set((state) => {
      if (!state.character) return {};

      const statistics = state.character.statistics || StatisticsManager.initializeStatistics();
      const updatedStatistics = StatisticsManager.updateCombatStats(
        statistics,
        victory,
        gold,
        experience
      );

      return {
        character: {
          ...state.character,
          statistics: updatedStatistics,
        },
      };
    }),

  checkAchievements: () =>
    set((state) => {
      if (!state.character) return {};

      // Ensure statistics exists
      const statistics = state.character.statistics || StatisticsManager.initializeStatistics();

      // Ensure completedAchievements exists
      const existingCompleted = state.character.completedAchievements || [];
      const existingCompletedIds = new Set(existingCompleted.map((ca) => ca.achievementId));

      // Check for newly completed achievements
      // Pass character with current completedAchievements to avoid duplicates
      const characterWithCompleted = {
        ...state.character,
        completedAchievements: existingCompleted,
      };
      const newlyCompleted = AchievementManager.checkAchievements(
        characterWithCompleted,
        statistics
      );

      // Filter out any achievements that are already completed (prevent duplicates)
      const trulyNew = newlyCompleted.filter(
        (achievement) => !existingCompletedIds.has(achievement.achievementId)
      );

      if (trulyNew.length > 0) {
        const updatedCompleted = [...existingCompleted, ...trulyNew];

        // Show notification for each newly completed achievement
        for (const achievement of trulyNew) {
          const dataLoader = getDataLoader();
          const achievementData = dataLoader.getAchievement(achievement.achievementId);
          if (achievementData) {
            console.log(`Achievement unlocked: ${achievementData.name}`);
            // Show UI notification
            if (typeof window !== 'undefined' && state.settings.showNotifications !== false) {
              const event = new CustomEvent('showNotification', {
                detail: {
                  message: `Achievement Unlocked: ${achievementData.name}`,
                  type: 'achievement',
                  duration: 6000,
                },
              });
              window.dispatchEvent(event);
            }
          }
        }

        // Update both character and ensure statistics is persisted
        return {
          character: {
            ...state.character,
            completedAchievements: updatedCompleted,
            statistics: statistics, // Ensure statistics is persisted
          },
        };
      }

      // Even if no new achievements, ensure statistics is persisted
      if (!state.character.statistics) {
        return {
          character: {
            ...state.character,
            statistics: statistics,
          },
        };
      }

      return {};
    }),

  claimAchievementRewards: (achievementId: string) =>
    set((state) => {
      if (!state.character) return {};

      try {
        const result = AchievementManager.claimAchievementRewards(
          state.character,
          state.inventory,
          achievementId
        );

        return {
          character: result.character,
          inventory: result.inventory,
        };
      } catch (error) {
        console.error('Failed to claim achievement rewards:', error);
        alert(error instanceof Error ? error.message : 'Failed to claim rewards');
        return {};
      }
    }),

  // Settings actions
  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),

  // Game state actions
  initialize: (saveData) => {
    if (saveData) {
      // Consolidate inventory to fix any stacking issues
      const consolidatedInventory = InventoryManager.consolidateInventory(saveData.inventory);

      set({
        character: {
          ...saveData.character,
          activeUpgrades: saveData.character.activeUpgrades || [],
          consumableUpgrades: saveData.character.consumableUpgrades || [],
        },
        inventory: consolidatedInventory,
        dungeonProgress: saveData.dungeonProgress,
        settings: saveData.settings,
        isInitialized: true,
        currentDungeonId: saveData.currentDungeonId,
        combatRoundNumber: 0,
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
    // Get the latest state to ensure we have the most up-to-date character with mercenaries
    const state = get();
    const character = state.character;

    if (!character) {
      console.error('Cannot start combat: no character');
      return;
    }

    // Debug: Log character's active mercenaries
    console.log('Character activeMercenaries:', character.activeMercenaries);

    const monsterStates = monsters.map((monster) => ({
      monster,
      currentHealth: monster.stats.health || monster.stats.maxHealth,
      maxHealth: monster.stats.maxHealth || monster.stats.health,
    }));
    // Create player party member from character
    const playerPartyMember: ActivePlayerPartyMember = {
      id: 'player',
      name: character.name || 'Player',
      isSummoned: false,
      currentHealth: playerHealth,
      maxHealth: playerMaxHealth,
      currentMana: playerMana,
      maxMana: playerMaxMana,
      level: character.level,
    };

    // Add combat mercenaries to party - ensure we're using the latest character state
    const combatMercenaries = MercenaryManager.getCombatMercenaries(character);
    console.log(
      'Starting combat with mercenaries:',
      combatMercenaries.map((m) => m.name)
    );
    const mercenaryPartyMembers: ActivePlayerPartyMember[] = combatMercenaries
      .filter((mercenary) => {
        if (!mercenary.stats) {
          console.error(`Mercenary ${mercenary.id} has no stats!`);
          return false;
        }
        return true;
      })
      .map((mercenary, index) => ({
        id: `mercenary_${mercenary.id}_${index}`,
        name: mercenary.name,
        isSummoned: true, // Mercenaries are treated as summoned
        currentHealth: mercenary.stats!.health,
        maxHealth: mercenary.stats!.maxHealth,
        currentMana: mercenary.stats!.mana,
        maxMana: mercenary.stats!.maxMana,
        level: undefined,
      }));

    const newCombatState: ActiveCombatState = {
      playerParty: [playerPartyMember, ...mercenaryPartyMembers], // Player + mercenaries
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

    console.log(
      'Setting combat state with playerParty:',
      newCombatState.playerParty.map((p) => p.name)
    );
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
          // Preserve existing playerParty if not explicitly updated
          playerParty:
            updates.playerParty !== undefined
              ? updates.playerParty
              : state.currentCombatState.playerParty,
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
    set({
      combatRoundNumber: round,
    }),

  setActiveAction: (action) => set({ activeAction: action }),

  setMaxOfflineHours: (hours) => set({ maxOfflineHours: Math.max(8, hours) }), // Minimum 8 hours
}));
