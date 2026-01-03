/**
 * Game Event Listeners
 *
 * Handles automatic statistics updates and achievement checking
 * when game events are emitted.
 */

import { gameEventEmitter, type GameEvent } from './GameEventEmitter';
import { useGameState } from '../GameState';
import { StatisticsManager } from '../statistics/StatisticsManager';
import { DungeonManager } from '../dungeon/DungeonManager';
import { getDataLoader } from '@/data';

// Debounce achievement checking to prevent excessive calls
let achievementCheckTimeout: NodeJS.Timeout | null = null;
const ACHIEVEMENT_CHECK_DEBOUNCE_MS = 100;

/**
 * Initialize event listeners for statistics and achievements
 */
export function initializeEventListeners(): () => void {
  console.log('Initializing event listeners for statistics and achievements');

  // Statistics listener - updates statistics when events occur
  const statisticsListener = (event: GameEvent) => {
    console.log(`[Event Listener] Event received: ${event.type}`, event);
    const state = useGameState.getState();
    if (!state.character) {
      console.warn('[Event Listener] No character found, skipping statistics update');
      return;
    }

    // Always get the latest statistics from state to avoid stale data
    const statistics = state.character.statistics || StatisticsManager.initializeStatistics();
    console.log(`[Event Listener] Current statistics:`, {
      totalCombats: statistics.totalCombats,
      monsterKills: Object.keys(statistics.monsterKills || {}).length,
      totalExperienceEarned: statistics.totalExperienceEarned,
      lastPlayed: statistics.lastPlayed,
    });

    let updatedStatistics = statistics;
    let statisticsWereUpdated = false;

    switch (event.type) {
      case 'monster_killed':
        updatedStatistics = StatisticsManager.recordMonsterKill(statistics, event.monsterId);
        statisticsWereUpdated = true;
        console.log(`[Event Listener] Updated statistics for monster_killed:`, {
          monsterId: event.monsterId,
          before: statistics.monsterKills?.[event.monsterId] || 0,
          after: updatedStatistics.monsterKills?.[event.monsterId] || 0,
        });
        break;

      case 'item_collected':
        updatedStatistics = StatisticsManager.recordItemCollected(
          statistics,
          event.itemId,
          event.quantity
        );
        statisticsWereUpdated = true;
        break;

      case 'combat_won':
        updatedStatistics = StatisticsManager.updateCombatStats(
          statistics,
          true,
          event.gold,
          event.experience
        );
        statisticsWereUpdated = true;
        break;

      case 'combat_lost':
        updatedStatistics = StatisticsManager.updateCombatStats(statistics, false, 0, 0);
        statisticsWereUpdated = true;
        break;

      case 'skill_action':
        updatedStatistics = StatisticsManager.recordSkillAction(statistics, event.skillId);
        statisticsWereUpdated = true;
        // Also update skill experience if provided
        if (event.experience !== undefined && event.experience > 0) {
          updatedStatistics = {
            ...updatedStatistics,
            totalSkillExperience: updatedStatistics.totalSkillExperience + event.experience,
            lastPlayed: Date.now(),
          };
        }
        break;

      case 'play_time_updated':
        updatedStatistics = StatisticsManager.updatePlayTime(statistics, event.deltaSeconds);
        statisticsWereUpdated = true;
        break;

      default:
        // Other events don't directly update statistics
        console.debug(
          `[Event Listener] Event ${event.type} doesn't update statistics, returning early`
        );
        return;
    }

    // Safety check: if we didn't update statistics, something went wrong
    if (!statisticsWereUpdated) {
      console.error(
        `[Event Listener] Event ${event.type} should have updated statistics but didn't!`
      );
      return;
    }

    // StatisticsManager methods always create new objects, so if we got here,
    // statistics were updated. Always proceed with the update.
    // We don't need to check if statistics changed because:
    // 1. StatisticsManager methods always return new objects
    // 2. We've already verified statisticsWereUpdated is true
    // 3. Even if values are the same, we need to update to ensure Zustand detects the change

    console.log(`[Event Listener] Proceeding with statistics update for ${event.type}:`, {
      before: {
        totalCombats: statistics.totalCombats,
        monsterKills: Object.keys(statistics.monsterKills || {}).length,
        totalExperienceEarned: statistics.totalExperienceEarned,
        lastPlayed: statistics.lastPlayed,
      },
      after: {
        totalCombats: updatedStatistics.totalCombats,
        monsterKills: Object.keys(updatedStatistics.monsterKills || {}).length,
        totalExperienceEarned: updatedStatistics.totalExperienceEarned,
        lastPlayed: updatedStatistics.lastPlayed,
      },
    });

    console.log(`[Event Listener] Statistics changed for ${event.type}:`, {
      before: {
        totalCombats: statistics.totalCombats,
        monsterKills: Object.keys(statistics.monsterKills || {}).length,
        totalExperienceEarned: statistics.totalExperienceEarned,
      },
      after: {
        totalCombats: updatedStatistics.totalCombats,
        monsterKills: Object.keys(updatedStatistics.monsterKills || {}).length,
        totalExperienceEarned: updatedStatistics.totalExperienceEarned,
      },
    });

    // Update character with new statistics
    // IMPORTANT: We must create a completely new character object to ensure Zustand detects the change
    // We also need to deeply copy nested objects like monsterKills, itemsCollected, etc.
    const updatedCharacter = {
      ...state.character,
      statistics: {
        ...updatedStatistics,
        // Deep copy nested objects to ensure Zustand detects changes
        monsterKills: { ...updatedStatistics.monsterKills },
        itemsCollected: { ...updatedStatistics.itemsCollected },
        skillActions: { ...updatedStatistics.skillActions },
      },
    };

    // Use setCharacter to update state - this will trigger React re-renders
    // This must be called to ensure Zustand detects the state change
    state.setCharacter(updatedCharacter);

    // Verify the update was applied by getting fresh state after a brief delay
    // This ensures we're reading the state after Zustand has processed the update
    setTimeout(() => {
      const latestState = useGameState.getState();
      console.log(`[Event Listener] After setCharacter:`, {
        totalCombats: latestState.character?.statistics?.totalCombats,
        monsterKills: Object.keys(latestState.character?.statistics?.monsterKills || {}).length,
        totalExperienceEarned: latestState.character?.statistics?.totalExperienceEarned,
      });
    }, 0);

    // Debug: Log statistics update
    console.debug(`Event ${event.type}: Statistics updated`, {
      totalCombats: updatedStatistics.totalCombats,
      totalExperienceEarned: updatedStatistics.totalExperienceEarned,
      totalSkillExperience: updatedStatistics.totalSkillExperience,
      monsterKills: Object.keys(updatedStatistics.monsterKills || {}).length,
    });
  };

  // Achievement listener - checks achievements after relevant events
  const achievementListener = (event: GameEvent) => {
    // Only check achievements for events that might trigger them
    const relevantEvents: GameEvent['type'][] = [
      'monster_killed',
      'item_collected',
      'combat_won',
      'skill_action',
      'level_up',
      'quest_completed',
    ];

    if (!relevantEvents.includes(event.type)) {
      return;
    }

    // Debounce achievement checking to prevent excessive calls
    if (achievementCheckTimeout) {
      clearTimeout(achievementCheckTimeout);
    }

    achievementCheckTimeout = setTimeout(() => {
      const state = useGameState.getState();
      if (state.character) {
        state.checkAchievements();
      }
      achievementCheckTimeout = null;
    }, ACHIEVEMENT_CHECK_DEBOUNCE_MS);
  };

  // Dungeon unlocking listener - unlocks dungeons when player levels up
  const dungeonUnlockListener = (event: GameEvent) => {
    if (event.type !== 'level_up') {
      return;
    }

    console.log(`[Dungeon Unlock] Level up event received: level ${event.newLevel}`);
    const state = useGameState.getState();
    if (!state.character) {
      console.warn('[Dungeon Unlock] No character found, skipping dungeon unlock check');
      return;
    }

    // Use event.newLevel instead of state.character.level because the event is emitted
    // before the state is updated with the new level
    const characterLevel = event.newLevel;
    const completedDungeonIds = state.dungeonProgress
      .filter((dp) => dp.completed)
      .map((dp) => dp.dungeonId);

    // Get all dungeons and check which ones should be unlocked
    const dataLoader = getDataLoader();
    const allDungeons = dataLoader.getAllDungeons();

    console.log(
      `[Dungeon Unlock] Checking dungeons for level ${characterLevel}, completed dungeons:`,
      completedDungeonIds
    );
    console.log(`[Dungeon Unlock] Current dungeonProgress entries:`, state.dungeonProgress.length);

    let unlockedCount = 0;
    for (const dungeon of allDungeons) {
      // Check if dungeon is already unlocked
      const existingProgress = state.dungeonProgress.find((dp) => dp.dungeonId === dungeon.id);
      if (existingProgress?.unlocked) {
        console.log(`[Dungeon Unlock] Skipping ${dungeon.name} (${dungeon.id}) - already unlocked`);
        continue; // Already unlocked
      }

      // Check if dungeon should be unlocked based on current level and completed dungeons
      const shouldUnlock = DungeonManager.isDungeonUnlocked(
        dungeon,
        characterLevel,
        completedDungeonIds
      );

      if (shouldUnlock) {
        // Unlock the dungeon
        state.unlockDungeon(dungeon.id);
        unlockedCount++;
        console.log(
          `[Dungeon Unlock] ✓ Unlocked dungeon: ${dungeon.name} (${dungeon.id}) at level ${characterLevel}`
        );
      } else {
        // Log why dungeon isn't unlocking for debugging
        const reasons: string[] = [];
        if (dungeon.requiredLevel && characterLevel < dungeon.requiredLevel) {
          reasons.push(`level requirement (need ${dungeon.requiredLevel}, have ${characterLevel})`);
        }
        if (dungeon.requiredDungeonId && !completedDungeonIds.includes(dungeon.requiredDungeonId)) {
          reasons.push(`prerequisite dungeon not completed (need ${dungeon.requiredDungeonId})`);
        }
        if (dungeon.unlockConditions?.level && characterLevel < dungeon.unlockConditions.level) {
          reasons.push(
            `unlock condition level (need ${dungeon.unlockConditions.level}, have ${characterLevel})`
          );
        }
        if (
          dungeon.unlockConditions?.dungeonId &&
          !completedDungeonIds.includes(dungeon.unlockConditions.dungeonId)
        ) {
          reasons.push(`unlock condition dungeon (need ${dungeon.unlockConditions.dungeonId})`);
        }
        if (reasons.length > 0) {
          console.log(
            `[Dungeon Unlock] ✗ Cannot unlock ${dungeon.name} (${dungeon.id}) at level ${characterLevel}: ${reasons.join(', ')}`
          );
        }
      }
    }

    if (unlockedCount > 0) {
      console.log(
        `[Dungeon Unlock] Successfully unlocked ${unlockedCount} dungeon(s) at level ${characterLevel}`
      );

      // Verify state was updated and get the updated progress
      const updatedState = useGameState.getState();
      const updatedProgress = updatedState.dungeonProgress;
      console.log(
        `[Dungeon Unlock] Updated dungeonProgress entries:`,
        updatedProgress.length,
        updatedProgress
      );

      // Emit a custom window event to notify components that dungeonProgress has changed
      // This ensures React components can react to the state change
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('dungeonProgressUpdated', {
            detail: {
              unlockedCount,
              level: characterLevel,
              dungeonProgress: updatedProgress,
            },
          })
        );
        console.log(`[Dungeon Unlock] Emitted dungeonProgressUpdated event`);
      }
    } else {
      console.log(`[Dungeon Unlock] No new dungeons unlocked at level ${characterLevel}`);
      // Still emit event to notify components that a level up occurred and dungeon checks were performed
      // This ensures components can re-check their state
      if (typeof window !== 'undefined') {
        const currentState = useGameState.getState();
        window.dispatchEvent(
          new CustomEvent('dungeonProgressUpdated', {
            detail: {
              unlockedCount: 0,
              level: characterLevel,
              dungeonProgress: currentState.dungeonProgress,
              checked: true, // Indicates checks were performed even if nothing unlocked
            },
          })
        );
        console.log(
          `[Dungeon Unlock] Emitted dungeonProgressUpdated event (no unlocks, but checks performed)`
        );
      }
    }
  };

  // Subscribe to events
  const unsubscribeStatistics = gameEventEmitter.on(statisticsListener);
  const unsubscribeAchievements = gameEventEmitter.on(achievementListener);
  const unsubscribeDungeonUnlock = gameEventEmitter.on(dungeonUnlockListener);

  // Return cleanup function
  return () => {
    unsubscribeStatistics();
    unsubscribeAchievements();
    unsubscribeDungeonUnlock();
    if (achievementCheckTimeout) {
      clearTimeout(achievementCheckTimeout);
      achievementCheckTimeout = null;
    }
  };
}
