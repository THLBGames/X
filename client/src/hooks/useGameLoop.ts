import { useEffect, useRef, useCallback } from 'react';
import { useGameState } from '../systems';
import { CharacterManager } from '../systems/character';
import { getSaveManager } from '../systems/save';
import { CombatManager } from '../systems/combat/CombatManager';
import { DungeonManager } from '../systems/dungeon';
import { MercenaryManager } from '../systems/mercenary/MercenaryManager';
import { AutoSkillManager } from '../systems/combat/AutoSkillManager';
import { getDataLoader } from '../data';

// Global state for combat stats (shared across component instances)
const combatStatsRef = {
  combatsCompleted: 0,
  totalExperience: 0,
  totalGold: 0,
};

export function useGameLoop() {
  const character = useGameState((state) => state.character);
  const currentDungeonId = useGameState((state) => state.currentDungeonId);
  const isCombatActive = useGameState((state) => state.isCombatActive);
  const activeAction = useGameState((state) => state.activeAction);
  const settings = useGameState((state) => state.settings);
  const setCharacter = useGameState((state) => state.setCharacter);
  // const setInventory = useGameState((state) => state.setInventory);
  const addItem = useGameState((state) => state.addItem);
  const setCombatActive = useGameState((state) => state.setCombatActive);
  const startCombat = useGameState((state) => state.startCombat);
  const startCombatWithMonsters = useGameState((state) => state.startCombatWithMonsters);
  // const combatRoundNumber = useGameState((state) => state.combatRoundNumber);
  const setCombatRoundNumber = useGameState((state) => state.setCombatRoundNumber);
  const updateCombatState = useGameState((state) => state.updateCombatState);
  const addCombatAction = useGameState((state) => state.addCombatAction);
  const endCombat = useGameState((state) => state.endCombat);
  const queueSkill = useGameState((state) => state.queueSkill);

  const combatCountRef = useRef(0);
  const lastSaveTimeRef = useRef(Date.now());
  const intervalRef = useRef<number | null>(null);

  // Resume combat if there's an active combat action after offline progress
  // This runs when activeAction changes to a combat action (e.g., after offline progress is processed)
  useEffect(() => {
    const currentActiveAction = activeAction;
    const currentCharacter = character;

    // Only proceed if we have a valid combat action and combat is not already active
    if (
      !currentActiveAction ||
      currentActiveAction.type !== 'combat' ||
      !currentCharacter ||
      isCombatActive
    ) {
      return;
    }

    const dungeonId = currentActiveAction.dungeonId;

    // Resume combat by calling startCombat
    // This will set isCombatActive to true and the combat loop will start
    console.log('Resuming combat after offline progress:', dungeonId);
    startCombat(dungeonId);
  }, [activeAction, character, isCombatActive, startCombat]);

  // Reset combat stats when combat starts
  useEffect(() => {
    if (isCombatActive) {
      combatStatsRef.combatsCompleted = 0;
      combatStatsRef.totalExperience = 0;
      combatStatsRef.totalGold = 0;
      CombatManager.endCombat(); // Clear any existing combat
    } else {
      CombatManager.endCombat();
    }
  }, [isCombatActive]);

  // @ts-expect-error - Function kept for future use
  const _processCombatResult = useCallback(
    async (combatResult: { combatLog: any; updatedCharacter: any; rewards: any }) => {
      if (!combatResult) return;

      const { updatedCharacter, rewards } = combatResult;

      // Update character
      setCharacter(updatedCharacter);

      // Add gold
      if (rewards.gold > 0) {
        addItem('gold', rewards.gold);
        combatStatsRef.totalGold += rewards.gold;
      }

      // Add items
      for (const item of rewards.items || []) {
        addItem(item.itemId, item.quantity || 1);
      }

      // Update combat stats
      combatCountRef.current += 1;
      combatStatsRef.combatsCompleted += 1;
      combatStatsRef.totalExperience += rewards.experience || 0;

      // Dispatch custom event for combat stats update
      window.dispatchEvent(
        new CustomEvent('combatStatsUpdate', {
          detail: { ...combatStatsRef },
        })
      );

      // Auto-save every 10 combats or every 30 seconds
      const now = Date.now();
      if (combatCountRef.current % 10 === 0 || now - lastSaveTimeRef.current > 30000) {
        try {
          const saveManager = getSaveManager();
          const currentState = useGameState.getState();

          if (currentState.character) {
            const saveData = {
              version: '1.0.0',
              character: currentState.character,
              inventory: currentState.inventory,
              dungeonProgress: currentState.dungeonProgress,
              settings: currentState.settings,
              lastSaved: now,
              lastOfflineTime: now,
              activeAction: currentState.activeAction ?? null,
              maxOfflineHours: currentState.maxOfflineHours ?? 8,
            };
            await saveManager.save(saveData);
            lastSaveTimeRef.current = now;
          }
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    },
    [setCharacter, addItem]
  );

  const startCombatTurn = useCallback(async () => {
    const state = useGameState.getState();
    if (!state.character || !state.currentDungeonId || !state.isCombatActive) {
      return;
    }

    let combatEngine = CombatManager.getCurrentCombat();

    // Start new combat/round if needed
    if (!combatEngine) {
      try {
        const dataLoader = getDataLoader();
        const dungeon = dataLoader.getDungeon(state.currentDungeonId);
        if (!dungeon) {
          console.error('No dungeon found for ID:', state.currentDungeonId);
          return;
        }

        // Determine if this is a boss round (every 10 rounds)
        const roundNum = state.combatRoundNumber || 0;
        const isBossRound = roundNum > 0 && roundNum % 10 === 0;

        // Get current player health/mana from previous combat state (if exists)
        // This preserves health/mana between rounds
        const previousCombatState = state.currentCombatState;
        const currentPlayerHealth =
          previousCombatState?.playerParty?.[0]?.currentHealth ??
          state.character.combatStats.health;
        const currentPlayerMana =
          previousCombatState?.playerParty?.[0]?.currentMana ?? state.character.combatStats.mana;

        // Spawn 1-5 monsters for this round
        const monsters = DungeonManager.spawnMonsterWave(
          dungeon,
          state.character.level,
          isBossRound
        );
        if (monsters.length === 0) {
          console.error('No monsters spawned for dungeon:', dungeon.id);
          return;
        }

        combatEngine = CombatManager.startCombat(
          state.character,
          monsters,
          state.settings.autoCombat,
          state.currentDungeonId || undefined,
          currentPlayerHealth,
          currentPlayerMana
        );

        // Initialize combat state
        const player = combatEngine.getPlayer();
        if (player && monsters.length > 0) {
          startCombatWithMonsters(
            monsters,
            roundNum,
            isBossRound,
            player.currentHealth,
            player.stats.maxHealth,
            player.currentMana,
            player.stats.maxMana
          );
        } else {
          console.error('Failed to get player from combat engine or no monsters spawned');
        }
      } catch (error) {
        console.error('Error initializing combat:', error);
        setCombatActive(false);
        return;
      }
    }

    // Check for auto-skill usage if no manual skill is queued
    let queuedSkillId = state.queuedSkillId;
    if (!queuedSkillId && state.character) {
      const player = combatEngine.getPlayer();
      const monsters = combatEngine.getMonsters();
      const firstAliveMonster = monsters.find((m) => m.isAlive);

      if (player && firstAliveMonster) {
        const autoSkillId = AutoSkillManager.selectAutoSkill(
          state.character,
          player.currentHealth,
          player.stats.maxHealth,
          player.currentMana,
          player.stats.maxMana,
          firstAliveMonster.currentHealth,
          firstAliveMonster.stats.maxHealth
        );

        if (autoSkillId) {
          queuedSkillId = autoSkillId;
          queueSkill(autoSkillId);
        }
      }
    }

    // Clear queue after getting the skill (or use the queued one)
    const skillToUse = queuedSkillId;
    queueSkill(null); // Clear queue

    const combatLog = combatEngine.executeTurn(skillToUse);

    // Update combat state
    const player = combatEngine.getPlayer();
    const monsters = combatEngine.getMonsters();
    const currentActor = combatEngine.getCurrentActor();

    if (player && currentActor) {
      const recentActions = combatEngine.getRecentActions(20);
      const currentState = state.currentCombatState;

      // Update player party (player + mercenaries)
      // If playerParty doesn't exist or is empty, initialize it from combat engine
      let updatedPlayerParty = currentState?.playerParty || [];
      if (updatedPlayerParty.length === 0) {
        // Initialize playerParty from combat engine participants
        const allParticipants = combatEngine.getParticipants();
        const playerParticipants = allParticipants.filter((p) => p.isPlayer);
        updatedPlayerParty = playerParticipants.map((participant) => {
          const isPlayer = participant.id === 'player';
          return {
            id: participant.id,
            name: participant.name,
            isSummoned: !isPlayer,
            currentHealth: participant.currentHealth,
            maxHealth: participant.stats.maxHealth,
            currentMana: participant.currentMana,
            maxMana: participant.stats.maxMana,
            level: isPlayer ? state.character?.level : undefined,
          };
        });
      }

      if (updatedPlayerParty.length > 0) {
        const playerPartyMember = updatedPlayerParty[0];
        if (playerPartyMember && playerPartyMember.id === 'player') {
          // Update player's health/mana, but preserve mercenaries
          // Ensure health/mana don't exceed max values and are never negative
          // If player is dead, ensure health is 0
          const health = player.isAlive ? player.currentHealth : 0;
          const clampedHealth = Math.min(Math.max(0, health), playerPartyMember.maxHealth);
          const clampedMana = Math.min(Math.max(0, player.currentMana), playerPartyMember.maxMana);
          updatedPlayerParty = [
            {
              ...playerPartyMember,
              currentHealth: clampedHealth,
              currentMana: clampedMana,
            },
            ...updatedPlayerParty.slice(1), // Preserve mercenaries (all members after player)
          ];
        }
      }

      // Update mercenary health/mana from combat engine participants
      const allParticipants = combatEngine.getParticipants();
      updatedPlayerParty = updatedPlayerParty.map((partyMember) => {
        if (partyMember.id === 'player') {
          return partyMember; // Already updated above
        }
        // Find corresponding mercenary participant in combat engine
        const mercenaryParticipant = allParticipants.find(
          (p) => p.id === partyMember.id && p.isPlayer
        );
        if (mercenaryParticipant) {
          // Ensure health/mana don't exceed max values and are never negative
          // If participant is dead, ensure health is 0
          const health = mercenaryParticipant.isAlive ? mercenaryParticipant.currentHealth : 0;
          const clampedHealth = Math.min(Math.max(0, health), partyMember.maxHealth);
          const clampedMana = Math.min(
            Math.max(0, mercenaryParticipant.currentMana),
            partyMember.maxMana
          );
          return {
            ...partyMember,
            currentHealth: clampedHealth,
            currentMana: clampedMana,
          };
        }
        // If participant not found (shouldn't happen, but handle gracefully)
        // Keep current health but ensure it's valid
        return {
          ...partyMember,
          currentHealth: Math.min(Math.max(0, partyMember.currentHealth), partyMember.maxHealth),
          currentMana: Math.min(Math.max(0, partyMember.currentMana), partyMember.maxMana),
        };
      });

      // Determine current actor type and index
      const currentActorType: 'player' | 'monster' | 'summoned' = currentActor.isPlayer
        ? currentActor.id === 'player'
          ? 'player'
          : 'summoned'
        : 'monster';
      let currentPlayerIndex: number | undefined = undefined;
      let currentMonsterIndex = currentState?.currentMonsterIndex || 0;

      if (currentActor.isPlayer) {
        // Find the index of the current actor in the player party
        const actorIndex = updatedPlayerParty.findIndex((p) => p.id === currentActor.id);
        currentPlayerIndex = actorIndex >= 0 ? actorIndex : 0; // Default to 0 if not found
      } else if (!currentActor.isPlayer && monsters.length > 0) {
        // Find which monster is currently acting
        const actingMonsterIndex = monsters.findIndex((m) => m.id === currentActor.id);
        if (actingMonsterIndex >= 0) {
          currentMonsterIndex = actingMonsterIndex;
        }
      }

      // Only update monsters if we have a current state with monsters
      if (currentState && currentState.monsters && currentState.monsters.length > 0) {
        // Update monster states - match by index since we spawn them in order
        const updatedMonsters = currentState.monsters.map((monsterState, index) => {
          // Find corresponding monster participant by matching the original monster ID
          // Monster IDs in engine are formatted as "monsterId_index"
          const monsterParticipant = monsters.find((m) => {
            const parts = m.id.split('_');
            const baseId = parts.slice(0, -1).join('_');
            return (
              baseId === monsterState.monster.id || m.id === `${monsterState.monster.id}_${index}`
            );
          });
          if (monsterParticipant && monsterParticipant.isAlive) {
            return {
              ...monsterState,
              currentHealth: monsterParticipant.currentHealth,
            };
          }
          // Monster is dead, mark as 0 health
          return {
            ...monsterState,
            currentHealth: 0,
          };
        });

        updateCombatState({
          playerParty: updatedPlayerParty,
          monsters: updatedMonsters,
          playerHealth: player.currentHealth, // Keep for backwards compatibility
          playerMana: player.currentMana,
          currentActor: currentActorType,
          currentPlayerIndex,
          currentMonsterIndex,
          recentActions,
          turnNumber: combatEngine.getTurnNumber(),
          skillCooldowns: combatEngine.getSkillCooldowns(),
        });
      } else {
        // No monsters in state yet, just update player stats (don't touch monsters)
        updateCombatState({
          playerParty: updatedPlayerParty,
          playerHealth: player.currentHealth, // Keep for backwards compatibility
          playerMana: player.currentMana,
          currentActor: currentActorType,
          currentPlayerIndex,
          recentActions,
          turnNumber: combatEngine.getTurnNumber(),
          skillCooldowns: combatEngine.getSkillCooldowns(),
        });
      }

      // Add latest action to log
      if (recentActions.length > 0) {
        addCombatAction(recentActions[recentActions.length - 1]);
      }
    }

    // Check if combat is over - do this BEFORE processing any results
    // to ensure we don't continue if player is dead
    if (combatLog) {
      if (combatLog.result === 'defeat') {
        // Stop combat immediately to prevent any new combat from starting
        setCombatActive(false);
        CombatManager.endCombat();
        endCombat();

        // Dispatch combat complete event (for animations/UI)
        window.dispatchEvent(
          new CustomEvent('combatComplete', {
            detail: { result: 'defeat' },
          })
        );
        return; // Exit early - don't process any further turns
      }

      if (combatLog.result === 'victory' && combatLog.rewards) {
        // IMPORTANT: Get defeated monsters from combat engine BEFORE clearing it
        // This ensures we capture ALL defeated monsters, including those killed by mercenaries
        const currentCombatEngine = CombatManager.getCurrentCombat();
        const defeatedMonsterIds: string[] = [];

        if (currentCombatEngine) {
          // Get all defeated monsters directly from combat engine participants
          // This is the most reliable source as it has the actual combat state
          const allParticipants = currentCombatEngine.getParticipants();
          const defeatedMonsterParticipants = allParticipants.filter(
            (p) => !p.isPlayer && !p.isAlive
          );

          console.debug(
            `Recording ${defeatedMonsterParticipants.length} defeated monsters from combat engine (including mercenary kills)`
          );

          for (const monsterParticipant of defeatedMonsterParticipants) {
            // Extract base monster ID (remove index suffix like "_0", "_1", etc.)
            // If ID doesn't have underscore, use the original ID
            const idParts = monsterParticipant.id.split('_');
            const baseMonsterId =
              idParts.length > 1 ? idParts.slice(0, -1).join('_') : monsterParticipant.id;

            // Validate that we have a valid monster ID
            if (!baseMonsterId || baseMonsterId.trim() === '') {
              console.warn(
                `[useGameLoop] Invalid monster ID extracted from: ${monsterParticipant.id}`
              );
              continue;
            }

            defeatedMonsterIds.push(baseMonsterId);
          }
        } else {
          // Fallback: use combat state if combat engine is not available
          const combatState = state.currentCombatState;
          if (combatState) {
            const defeatedMonsters = combatState.monsters.filter((m) => m.currentHealth <= 0);
            console.debug(
              `Fallback: Recording ${defeatedMonsters.length} defeated monsters from combat state`
            );
            for (const monsterState of defeatedMonsters) {
              // Extract base monster ID (remove index suffix like "_0", "_1", etc.)
              // If ID doesn't have underscore, use the original ID
              const idParts = monsterState.monster.id.split('_');
              const baseMonsterId =
                idParts.length > 1 ? idParts.slice(0, -1).join('_') : monsterState.monster.id;

              // Validate that we have a valid monster ID
              if (!baseMonsterId || baseMonsterId.trim() === '') {
                console.warn(
                  `[useGameLoop] Invalid monster ID extracted from: ${monsterState.monster.id}`
                );
                continue;
              }

              defeatedMonsterIds.push(baseMonsterId);
            }
          }
        }

        // Clear current combat engine (but don't clear state yet - we'll start a new round)
        CombatManager.endCombat();

        const dataLoader = getDataLoader();
        const dungeon = dataLoader.getDungeon(state.currentDungeonId);
        if (!dungeon) {
          console.warn('No dungeon found for currentDungeonId:', state.currentDungeonId);
          return;
        }

        // Add experience
        const baseExperience = combatLog.rewards.experience || 0;
        const calculatedExperience = DungeonManager.calculateExperienceReward(
          baseExperience,
          dungeon
        );
        console.log(
          'Combat XP - Base:',
          baseExperience,
          'Calculated:',
          calculatedExperience,
          'Dungeon:',
          dungeon.id
        );

        // Track the character with experience added - this will be used later for mercenary consumption
        let characterWithExperience = state.character;
        if (calculatedExperience > 0 && state.character) {
          const { character: updatedCharacter } = CharacterManager.addExperience(
            state.character,
            calculatedExperience
          );
          characterWithExperience = updatedCharacter;
          setCharacter(updatedCharacter);
        } else {
          console.warn(
            'No experience to award - baseExperience:',
            baseExperience,
            'calculatedExperience:',
            calculatedExperience
          );
        }

        // Add gold
        const goldReward = DungeonManager.calculateGoldReward(combatLog.rewards.gold, dungeon);
        if (goldReward > 0) {
          addItem('gold', goldReward);
          combatStatsRef.totalGold += goldReward;
        }

        // Record monster kills from combat engine (BEFORE it was cleared)
        // Use the defeatedMonsterIds we collected earlier
        // This ensures we capture ALL defeated monsters, including those killed by mercenaries
        for (const baseMonsterId of defeatedMonsterIds) {
          const recordMonsterKill = useGameState.getState().recordMonsterKill;
          recordMonsterKill(baseMonsterId); // This emits a monster_killed event
          console.debug(`Recorded monster kill: ${baseMonsterId}`);
        }

        // Fallback: if we didn't get any from combat engine, try combat state
        if (defeatedMonsterIds.length === 0) {
          const combatState = state.currentCombatState;
          if (combatState) {
            const defeatedMonsters = combatState.monsters.filter((m) => m.currentHealth <= 0);
            console.debug(
              `Fallback: Recording ${defeatedMonsters.length} defeated monsters from combat state`
            );
            for (const monsterState of defeatedMonsters) {
              // Extract base monster ID (remove index suffix like "_0", "_1", etc.)
              // If ID doesn't have underscore, use the original ID
              const idParts = monsterState.monster.id.split('_');
              const baseMonsterId =
                idParts.length > 1 ? idParts.slice(0, -1).join('_') : monsterState.monster.id;

              // Validate that we have a valid monster ID
              if (!baseMonsterId || baseMonsterId.trim() === '') {
                console.warn(
                  `[useGameLoop] Invalid monster ID extracted from: ${monsterState.monster.id}`
                );
                continue;
              }

              const recordMonsterKill = useGameState.getState().recordMonsterKill;
              recordMonsterKill(baseMonsterId); // This emits a monster_killed event
            }
          }
        }

        // Update combat statistics
        const experienceReward = DungeonManager.calculateExperienceReward(
          combatLog.rewards.experience,
          dungeon
        );
        const updateCombatStats = useGameState.getState().updateCombatStats;
        updateCombatStats(true, goldReward, experienceReward);

        // Debug: Log statistics update
        const stateAfterStats = useGameState.getState();
        if (stateAfterStats.character?.statistics) {
          console.debug(
            `Combat stats updated - Total combats: ${stateAfterStats.character.statistics.totalCombats}`
          );
        }

        // Add items (validate item exists before adding)
        for (const item of combatLog.rewards.items || []) {
          try {
            // Ensure item is loaded before adding
            const itemData = dataLoader.getItem(item.itemId);
            if (!itemData) {
              console.warn(`Item not found when adding loot: ${item.itemId}. Skipping.`);
              continue;
            }
            addItem(item.itemId, item.quantity || 1);
          } catch (error) {
            console.error(`Failed to add item ${item.itemId} to inventory:`, error);
            // Continue with other items even if one fails
          }
        }

        // Add chests (special loot)
        for (const chest of combatLog.rewards.chests || []) {
          addItem(chest.itemId, chest.quantity || 1);
        }

        // Achievements will be checked automatically by event listeners
        // No need to manually call checkAchievements() here

        // Consume battles for combat mercenaries
        // Use characterWithExperience (which includes the XP we just added) instead of state.character
        let characterAfterMercenaries = characterWithExperience;
        const activeCombatMercenaries =
          MercenaryManager.getCombatMercenaries(characterWithExperience);
        for (const mercenary of activeCombatMercenaries) {
          const activeMercenary = characterWithExperience.activeMercenaries?.find(
            (m) => m.mercenaryId === mercenary.id
          );
          if (activeMercenary) {
            characterAfterMercenaries = MercenaryManager.consumeBattle(
              characterAfterMercenaries,
              mercenary.id
            );
          }
        }
        if (characterAfterMercenaries !== characterWithExperience) {
          setCharacter(characterAfterMercenaries);
        }

        // Update quest progress for monster kills
        const currentCombatState = state.currentCombatState;
        if (currentCombatState && currentCombatState.monsters.length > 0) {
          const monster = currentCombatState.monsters[0].monster;
          const allQuests = dataLoader.getAllQuests();

          for (const quest of allQuests) {
            if (quest.type === 'monster_kills' && quest.requirements.monsterId === monster.id) {
              const { updateQuestProgress } = useGameState.getState();
              updateQuestProgress(quest.id, 1);
            }
          }
        }

        // Update combat stats
        combatStatsRef.combatsCompleted += 1;
        combatStatsRef.totalExperience += combatLog.rewards.experience;

        // Dispatch custom event for combat stats update
        window.dispatchEvent(
          new CustomEvent('combatStatsUpdate', {
            detail: { ...combatStatsRef },
          })
        );

        // Dispatch combat complete event
        window.dispatchEvent(
          new CustomEvent('combatComplete', {
            detail: { result: 'victory' },
          })
        );

        // Auto-save every 10 combats
        const now = Date.now();
        if (combatStatsRef.combatsCompleted % 10 === 0 || now - lastSaveTimeRef.current > 30000) {
          try {
            const saveManager = getSaveManager();
            const currentState = useGameState.getState();

            if (currentState.character) {
              const saveData = {
                version: '1.0.0',
                character: currentState.character,
                inventory: currentState.inventory,
                dungeonProgress: currentState.dungeonProgress,
                settings: currentState.settings,
                lastSaved: now,
                lastOfflineTime: now,
              };
              await saveManager.save(saveData);
              lastSaveTimeRef.current = now;
            }
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        }

        // Start new combat round - check if combat is still active (player might have stopped)
        const updatedState = useGameState.getState();
        if (
          updatedState.isCombatActive &&
          updatedState.character &&
          updatedState.currentDungeonId
        ) {
          // Increment round number
          const newRoundNumber = (updatedState.combatRoundNumber || 0) + 1;
          setCombatRoundNumber(newRoundNumber);

          // Determine if this is a boss round (every 10 rounds)
          const isBossRound = newRoundNumber > 0 && newRoundNumber % 10 === 0;

          // Spawn new monsters for the next round
          const newMonsters = DungeonManager.spawnMonsterWave(
            dungeon,
            updatedState.character.level,
            isBossRound
          );

          if (newMonsters.length > 0) {
            // Get current player health/mana from previous combat state to preserve between rounds
            const previousCombatState = updatedState.currentCombatState;
            const currentPlayerHealth =
              previousCombatState?.playerParty?.[0]?.currentHealth ??
              updatedState.character.combatStats.health;
            const currentPlayerMana =
              previousCombatState?.playerParty?.[0]?.currentMana ??
              updatedState.character.combatStats.mana;

            // Start new combat with new monsters
            const newCombatEngine = CombatManager.startCombat(
              updatedState.character,
              newMonsters,
              updatedState.settings.autoCombat,
              updatedState.currentDungeonId || undefined,
              currentPlayerHealth,
              currentPlayerMana
            );

            // Initialize combat state for new round
            const newPlayer = newCombatEngine.getPlayer();
            if (newPlayer) {
              startCombatWithMonsters(
                newMonsters,
                newRoundNumber,
                isBossRound,
                newPlayer.currentHealth,
                newPlayer.stats.maxHealth,
                newPlayer.currentMana,
                newPlayer.stats.maxMana
              );
            }
          } else {
            console.error('Failed to spawn monsters for new round');
          }
        }
      }
      // Note: defeat handling is now at the top of this block (line 252), before victory processing
    }
  }, [
    startCombatWithMonsters,
    updateCombatState,
    addCombatAction,
    endCombat,
    queueSkill,
    setCharacter,
    addItem,
    setCombatActive,
    setCombatRoundNumber,
  ]);

  // @ts-expect-error - Function kept for future use
  const _runCombatIteration = useCallback(async () => {
    // This is now handled by startCombatTurn in the interval
    await startCombatTurn();
  }, [startCombatTurn]);

  useEffect(() => {
    if (!isCombatActive || !character || !currentDungeonId) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Calculate turn delay (inverse of speed setting: 1 = slow, 5 = fast)
    // Speed 1 = 2000ms per turn, Speed 3 = 1000ms, Speed 5 = 500ms
    const speedMultiplier = (6 - settings.combatSpeed) / 2;
    const turnDelayMs = 1000 * speedMultiplier;

    // Run first turn immediately
    startCombatTurn();

    // Set up interval for subsequent turns
    intervalRef.current = window.setInterval(() => {
      startCombatTurn();
    }, turnDelayMs);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    isCombatActive,
    character,
    currentDungeonId,
    settings.combatSpeed,
    settings,
    startCombatTurn,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
