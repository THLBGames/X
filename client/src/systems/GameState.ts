import { create } from 'zustand';
import { gameEventEmitter } from './events/GameEventEmitter';
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
  AutoSkillSetting,
  AutoConsumableSetting,
} from '@idle-rpg/shared';
import {
  MAX_INVENTORY_SLOTS,
  MAX_SKILL_BAR_SLOTS,
  MAX_CONSUMABLE_BAR_SLOTS,
} from '@idle-rpg/shared';
import { DEFAULT_SETTINGS, DEFAULT_MAX_OFFLINE_HOURS } from '../constants/defaults';
import { QuestManager } from '../systems/quest/QuestManager';
import { MercenaryManager } from '../systems/mercenary/MercenaryManager';
import { UpgradeManager } from '../systems/upgrade/UpgradeManager';
import { StatisticsManager } from '../systems/statistics/StatisticsManager';
import { AchievementManager } from '../systems/achievements/AchievementManager';
import { InventoryManager } from '../systems/inventory';
import { CombatManager } from './combat/CombatManager';
import { getDataLoader } from '../data';
import { stopAllIdleSkills } from '../hooks/useIdleSkills';

// Guard flag to prevent concurrent achievement checks
let isCheckingAchievements = false;

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
  queuedConsumableId: string | null;
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
  updateConsumableBar: (consumableBar: string[]) => void;

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
  updateAutoSkillSetting: (skillId: string, setting: AutoSkillSetting) => void;
  removeAutoSkillSetting: (skillId: string) => void;
  updateAutoConsumableSetting: (itemId: string, setting: AutoConsumableSetting) => void;
  removeAutoConsumableSetting: (itemId: string) => void;
  queueConsumable: (itemId: string | null) => void;
}

const defaultInventory: Inventory = {
  items: [],
  maxSlots: MAX_INVENTORY_SLOTS,
};

const defaultSettings: GameSettings = DEFAULT_SETTINGS;

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
  queuedConsumableId: null,
  combatRoundNumber: 0,
  activeAction: null,
  maxOfflineHours: DEFAULT_MAX_OFFLINE_HOURS,

  // Character actions
  setCharacter: (character) =>
    set((state) => {
      // CRITICAL: Check if this is a completely new character (different ID or no existing character)
      // If so, don't preserve old statistics or achievements - start fresh
      const isNewCharacter = !state.character || state.character.id !== character.id;

      if (isNewCharacter) {
        // New character - use the character's own statistics and achievements (don't preserve old ones)
        console.log(
          `[GameState] New character detected (${character.id}), starting fresh with no preserved statistics/achievements`
        );
        return {
          character: {
            ...character,
            // Use the character's own statistics (or undefined if not set)
            statistics: character.statistics ? { ...character.statistics } : character.statistics,
            // Use the character's own achievements (or empty array if not set)
            completedAchievements: character.completedAchievements || [],
          },
        };
      }

      // Same character - preserve statistics and achievements to prevent data loss
      // This prevents statistics from being reset when multiple setCharacter calls happen in quick succession
      const existingStatistics = state.character?.statistics;
      const newStatistics = character.statistics;

      // Use the new statistics if it exists and is more recent (has a later lastPlayed)
      // Otherwise, preserve existing statistics to prevent data loss
      let finalStatistics = newStatistics;
      if (existingStatistics && newStatistics) {
        // If both exist, use the one with the more recent lastPlayed timestamp
        finalStatistics =
          newStatistics.lastPlayed >= existingStatistics.lastPlayed
            ? newStatistics
            : existingStatistics;
      } else if (existingStatistics && !newStatistics) {
        // If new character doesn't have statistics, preserve existing
        finalStatistics = existingStatistics;
      } else if (!existingStatistics && newStatistics) {
        // If we have new statistics but no existing, use new
        finalStatistics = newStatistics;
      }

      // Preserve and merge completedAchievements to prevent achievements from being lost
      // This is critical - achievements should never be lost when character is updated
      // EXCEPTION: If new character explicitly has an empty array, treat it as a reset
      const newCompleted = character.completedAchievements;
      const shouldResetAchievements =
        Array.isArray(newCompleted) &&
        newCompleted.length === 0 &&
        state.character?.completedAchievements &&
        state.character.completedAchievements.length > 0;

      if (shouldResetAchievements) {
        // Explicit reset - use empty array
        console.log(
          '[GameState] Detected explicit achievement reset (empty array), clearing all achievements'
        );
        return {
          character: {
            ...character,
            completedAchievements: [],
            // Always use the preserved statistics and create a new object reference
            statistics: finalStatistics ? { ...finalStatistics } : finalStatistics,
          },
        };
      }

      if (state.character?.completedAchievements && newCompleted) {
        const existingCompleted = state.character.completedAchievements;

        // Merge: combine both arrays, removing duplicates
        const existingIds = new Set(existingCompleted.map((ca) => ca.achievementId));
        const mergedCompleted = [...existingCompleted];

        for (const achievement of newCompleted) {
          if (!existingIds.has(achievement.achievementId)) {
            mergedCompleted.push(achievement);
          }
        }

        // IMPORTANT: Create a new character object to ensure Zustand detects the change
        // This is critical for React re-renders when nested properties like statistics change
        return {
          character: {
            ...character,
            completedAchievements: mergedCompleted,
            // Always use the preserved statistics and create a new object reference
            statistics: finalStatistics ? { ...finalStatistics } : finalStatistics,
          },
        };
      }

      // Fallback: If newCompleted is undefined/null, preserve existing achievements
      // If newCompleted is an empty array but we didn't reset (e.g., character had no achievements before), use empty array
      const finalCompletedAchievements =
        newCompleted !== undefined ? newCompleted : state.character?.completedAchievements || [];

      // IMPORTANT: Always create a new character object, even if no merging is needed
      // This ensures Zustand detects changes to nested properties like statistics
      return {
        character: {
          ...character,
          completedAchievements: finalCompletedAchievements,
          // Always use the preserved statistics and create a new object reference
          statistics: finalStatistics ? { ...finalStatistics } : finalStatistics,
        },
      };
    }),

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
      // Limit to MAX_SKILL_BAR_SLOTS skills for combat skill bar
      const limitedSkillBar = skillBar.slice(0, MAX_SKILL_BAR_SLOTS);

      // Remove auto-skill settings for skills that are no longer in the skill bar
      const currentSettings = state.character.autoSkillSettings || [];
      const updatedSettings = currentSettings.filter((s) => limitedSkillBar.includes(s.skillId));

      return {
        character: {
          ...state.character,
          skillBar: limitedSkillBar,
          autoSkillSettings: updatedSettings,
        },
      };
    }),

  updateConsumableBar: (consumableBar) =>
    set((state) => {
      if (!state.character) return {};
      // Limit to MAX_CONSUMABLE_BAR_SLOTS consumables for consumable bar
      const limitedConsumableBar = consumableBar.slice(0, MAX_CONSUMABLE_BAR_SLOTS);

      // Remove auto-consumable settings for items that are no longer in the bar
      const currentSettings = state.character.autoConsumableSettings || [];
      const updatedSettings = currentSettings.filter((s) => limitedConsumableBar.includes(s.itemId));

      return {
        character: {
          ...state.character,
          consumableBar: limitedConsumableBar,
          autoConsumableSettings: updatedSettings,
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
      }

      // Use InventoryManager to properly stack items
      const inventory = InventoryManager.addItem(state.inventory, itemId, quantity);

      // Emit item_collected event (statistics will be updated by event listener)
      gameEventEmitter.emit({ type: 'item_collected', itemId, quantity });

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
      const existingIndex = state.dungeonProgress.findIndex((dp) => dp.dungeonId === dungeonId);
      if (existingIndex === -1) {
        // Add new dungeon progress entry
        const newProgress = [
          ...state.dungeonProgress,
          { dungeonId, completed: false, timesCompleted: 0, unlocked: true },
        ];
        console.log(`[GameState] unlockDungeon: Added new entry for ${dungeonId}, total entries: ${newProgress.length}`);
        return {
          dungeonProgress: newProgress,
        };
      } else {
        // Update existing entry to mark as unlocked
        const updatedProgress = [...state.dungeonProgress];
        updatedProgress[existingIndex] = {
          ...updatedProgress[existingIndex],
          unlocked: true,
        };
        console.log(`[GameState] unlockDungeon: Updated existing entry for ${dungeonId}, unlocked: true`);
        return {
          dungeonProgress: updatedProgress,
        };
      }
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

      // If combat is active, update combat state to remove dismissed mercenary from UI immediately
      if (state.isCombatActive && state.currentCombatState) {
        // Remove dismissed mercenary from playerParty
        // Mercenary IDs in playerParty are in format: mercenary_{mercenaryId}_{index}
        const updatedPlayerParty = (state.currentCombatState.playerParty || []).filter(
          (member: ActivePlayerPartyMember) => {
            // Keep player
            if (member.id === 'player') return true;
            // Mercenary IDs are in format: mercenary_{mercenaryId}_{index}
            // Extract the mercenaryId from the member ID
            const idParts = member.id.split('_');
            if (idParts.length >= 2 && idParts[0] === 'mercenary') {
              const memberMercenaryId = idParts[1];
              return memberMercenaryId !== mercenaryId;
            }
            // If ID format is unexpected, keep it (shouldn't happen)
            return true;
          }
        );

        const updatedCombatState: ActiveCombatState = {
          ...state.currentCombatState,
          playerParty: updatedPlayerParty,
        };

        // Also remove from combat engine if it exists
        // This ensures the mercenary doesn't take turns or get targeted
        const combatEngine = CombatManager.getCurrentCombat();
        if (combatEngine) {
          const allParticipants = combatEngine.getParticipants();
          // Find and remove the dismissed mercenary from participants
          const mercenaryParticipant = allParticipants.find(
            (p) => p.isPlayer && p.id.startsWith(`mercenary_${mercenaryId}_`)
          );
          if (mercenaryParticipant) {
            // Remove from combat engine participants
            combatEngine.removeParticipant(mercenaryParticipant.id);
            console.debug(`Removed mercenary ${mercenaryId} from combat state and engine`);
          }
        }

        return {
          character: updatedCharacter,
          currentCombatState: updatedCombatState,
        };
      }

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
  recordMonsterKill: (monsterId: string) => {
    // Emit monster_killed event (statistics will be updated by event listener)
    console.log(`[GameState] Emitting monster_killed event for: ${monsterId}`);
    gameEventEmitter.emit({ type: 'monster_killed', monsterId });
  },

  recordItemCollected: (itemId: string, quantity: number) => {
    // Emit item_collected event (statistics will be updated by event listener)
    // Note: addItem() already emits this event, so this is mainly for backward compatibility
    gameEventEmitter.emit({ type: 'item_collected', itemId, quantity });
  },

  recordSkillAction: (skillId: string, experience?: number) => {
    // Emit skill_action event (statistics will be updated by event listener)
    // Experience is optional - if not provided, only skill action count is updated
    gameEventEmitter.emit({ type: 'skill_action', skillId, experience });
  },

  updateCombatStats: (victory: boolean, gold: number, experience: number) => {
    // Emit combat_won or combat_lost event (statistics will be updated by event listener)
    if (victory) {
      gameEventEmitter.emit({ type: 'combat_won', gold, experience });
    } else {
      gameEventEmitter.emit({ type: 'combat_lost' });
    }
  },

  checkAchievements: () => {
    // Guard: prevent concurrent execution
    if (isCheckingAchievements) {
      console.debug('Achievement check already in progress, skipping...');
      return;
    }

    isCheckingAchievements = true;
    try {
      // Get the latest state BEFORE entering set() to ensure we have the most recent data
      const currentState = get();
      if (!currentState.character) {
        return;
      }

      set((state) => {
        // Double-check character still exists
        if (!state.character) return {};

        // Get the absolute latest state INSIDE set() to ensure we're checking against the most recent completedAchievements
        // This is critical - we need the state that includes any previous updates
        const latestState = get();
        const latestCharacter = latestState.character;
        if (!latestCharacter) return {};

        // Ensure statistics exists
        const statistics = latestCharacter.statistics || StatisticsManager.initializeStatistics();

        // Ensure completedAchievements exists - use latest state
        const existingCompleted = latestCharacter.completedAchievements || [];
        const existingCompletedIds = new Set(existingCompleted.map((ca) => ca.achievementId));

        console.debug(
          `Checking achievements. Already completed: ${existingCompleted.length}`,
          existingCompleted.map((ca) => ca.achievementId)
        );

        // Check for newly completed achievements
        // Pass character with current completedAchievements to avoid duplicates
        const characterWithCompleted = {
          ...latestCharacter,
          completedAchievements: existingCompleted,
        };
        const newlyCompleted = AchievementManager.checkAchievements(
          characterWithCompleted,
          statistics
        );

        console.debug(
          `Found ${newlyCompleted.length} newly completed achievements:`,
          newlyCompleted.map((a) => a.achievementId)
        );

        // Filter out any achievements that are already completed (prevent duplicates)
        // This is a critical safety check
        const trulyNew = newlyCompleted.filter(
          (achievement) => !existingCompletedIds.has(achievement.achievementId)
        );

        console.debug(
          `After filtering: ${trulyNew.length} truly new achievements:`,
          trulyNew.map((a) => a.achievementId)
        );

        // If no truly new achievements, don't do anything
        // CRITICAL: Don't update character if no new achievements, as this could overwrite
        // statistics that were updated by event listeners. Just return empty object.
        if (trulyNew.length === 0) {
          return {};
        }

        // Double-check: ensure we're not adding duplicates
        const finalCompleted = [...existingCompleted];
        for (const achievement of trulyNew) {
          // One more safety check - ensure it's not already in the array
          if (!finalCompleted.some((ca) => ca.achievementId === achievement.achievementId)) {
            finalCompleted.push(achievement);
          } else {
            console.warn(
              `Attempted to add duplicate achievement: ${achievement.achievementId}. Skipping.`
            );
          }
        }

        // Show notification for each newly completed achievement
        for (const achievement of trulyNew) {
          const dataLoader = getDataLoader();
          const achievementData = dataLoader.getAchievement(achievement.achievementId);
          if (achievementData) {
            console.log(`Achievement unlocked: ${achievementData.name}`);
            // Show UI notification
            if (typeof window !== 'undefined' && latestState.settings.showNotifications !== false) {
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
        // CRITICAL: Get the absolute latest statistics from state to prevent overwriting
        // statistics that were updated by event listeners after we started checking achievements
        const absoluteLatestState = get();
        const mostRecentStatistics = absoluteLatestState.character?.statistics || statistics;

        return {
          character: {
            ...latestCharacter,
            completedAchievements: finalCompleted,
            // Use the most recent statistics from state, creating a new object reference
            statistics: mostRecentStatistics ? { ...mostRecentStatistics } : mostRecentStatistics,
          },
        };
      });
    } finally {
      // Clear the guard flag after a small delay to ensure state update is processed
      // This prevents race conditions where the next call happens before React has processed the update
      setTimeout(() => {
        isCheckingAchievements = false;
      }, 0);
    }
  },

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

      // If we have an active combat action but no currentDungeonId, set it from the action
      const dungeonId =
        saveData.currentDungeonId ||
        (saveData.activeAction?.type === 'combat' ? saveData.activeAction.dungeonId : null);

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
        currentDungeonId: dungeonId,
        combatRoundNumber: 0,
        activeAction: saveData.activeAction ?? null,
        maxOfflineHours: saveData.maxOfflineHours ?? DEFAULT_MAX_OFFLINE_HOURS,
      });
    } else {
      set({ isInitialized: true, activeAction: null, maxOfflineHours: DEFAULT_MAX_OFFLINE_HOURS });
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
        maxOfflineHours: DEFAULT_MAX_OFFLINE_HOURS,
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

    // Get combat engine to retrieve participant IDs for monsters
    const combatEngine = CombatManager.getCurrentCombat();
    const monsterParticipants = combatEngine ? combatEngine.getMonsters() : [];

    // Create monster states with participant IDs
    const monsterStates = monsters.map((monster, index) => {
      // Find the corresponding participant by matching the monster ID pattern
      // Participant IDs are formatted as "monsterId_index" (e.g., "goblin_0", "goblin_1")
      const participantId = `${monster.id}_${index}`;
      const participant = monsterParticipants.find((p) => p.id === participantId);
      
      // Use participant's current health if available, otherwise use monster's max health
      const currentHealth = participant
        ? participant.currentHealth
        : monster.stats.health || monster.stats.maxHealth;
      const maxHealth = monster.stats.maxHealth || monster.stats.health;

      return {
        monster,
        participantId,
        currentHealth,
        maxHealth,
      };
    });
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
      queuedConsumableId: null,
      // Keep combatRoundNumber so it persists across rounds
    }),

  queueSkill: (skillId) =>
    set({
      queuedSkillId: skillId,
    }),

  queueConsumable: (itemId) =>
    set({
      queuedConsumableId: itemId,
    }),

  setCombatRoundNumber: (round) =>
    set({
      combatRoundNumber: round,
    }),

  setActiveAction: (action) => set({ activeAction: action }),

  setMaxOfflineHours: (hours) => set({ maxOfflineHours: Math.max(DEFAULT_MAX_OFFLINE_HOURS, hours) }),

  updateAutoSkillSetting: (skillId, setting) =>
    set((state) => {
      if (!state.character) return {};

      const currentSettings = state.character.autoSkillSettings || [];
      const existingIndex = currentSettings.findIndex((s) => s.skillId === skillId);

      let updatedSettings: AutoSkillSetting[];
      if (existingIndex >= 0) {
        // Update existing setting
        updatedSettings = [...currentSettings];
        updatedSettings[existingIndex] = setting;
      } else {
        // Add new setting
        updatedSettings = [...currentSettings, setting];
      }

      return {
        character: {
          ...state.character,
          autoSkillSettings: updatedSettings,
        },
      };
    }),

  removeAutoSkillSetting: (skillId) =>
    set((state) => {
      if (!state.character) return {};

      const currentSettings = state.character.autoSkillSettings || [];
      const updatedSettings = currentSettings.filter(
        (s: AutoSkillSetting) => s.skillId !== skillId
      );

      return {
        character: {
          ...state.character,
          autoSkillSettings: updatedSettings,
        },
      };
    }),

  updateAutoConsumableSetting: (itemId, setting) =>
    set((state) => {
      if (!state.character) return {};

      const currentSettings = state.character.autoConsumableSettings || [];
      const existingIndex = currentSettings.findIndex((s) => s.itemId === itemId);

      let updatedSettings: AutoConsumableSetting[];
      if (existingIndex >= 0) {
        // Update existing setting
        updatedSettings = [...currentSettings];
        updatedSettings[existingIndex] = setting;
      } else {
        // Add new setting
        updatedSettings = [...currentSettings, setting];
      }

      return {
        character: {
          ...state.character,
          autoConsumableSettings: updatedSettings,
        },
      };
    }),

  removeAutoConsumableSetting: (itemId) =>
    set((state) => {
      if (!state.character) return {};

      const currentSettings = state.character.autoConsumableSettings || [];
      const updatedSettings = currentSettings.filter(
        (s: AutoConsumableSetting) => s.itemId !== itemId
      );

      return {
        character: {
          ...state.character,
          autoConsumableSettings: updatedSettings,
        },
      };
    }),
}));
