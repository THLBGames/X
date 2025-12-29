import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameState } from '../systems';
import { IdleSkillSystem } from '../systems/skills/IdleSkillSystem';
import { ResourceNodeManager } from '../systems/skills/ResourceNodeManager';

export interface ActiveSkillTraining {
  skillId: string;
  nodeId?: string; // For gathering skills
  recipeId?: string; // For production skills
  startTime?: number; // Timestamp when training started
  lastActionTime?: number; // Timestamp of last action
  timeRequired?: number; // Milliseconds required per action
}

// Shared interval tracking across all hook instances
// This ensures that if the hook is mounted in multiple places, they all share the same interval tracking
const sharedIntervalRefs = new Map<string, number>();
const sharedResumeAttempted = new Map<string, boolean>(); // Track if we've attempted to resume a specific action

// Shared active skills state across all hook instances
// This ensures all instances see the same active skills for UI updates
const sharedActiveSkills = new Map<string, ActiveSkillTraining>();
const activeSkillsListeners = new Set<() => void>(); // Listeners to notify when activeSkills change

// Helper to notify all listeners of activeSkills changes
const notifyActiveSkillsListeners = () => {
  activeSkillsListeners.forEach((listener) => listener());
};

// Helper to get all active skills as an array
const getSharedActiveSkills = (): ActiveSkillTraining[] => {
  return Array.from(sharedActiveSkills.values());
};

// Global function to stop all idle skills - can be called from anywhere
export const stopAllIdleSkills = () => {
  // Clear all intervals
  for (const intervalId of sharedIntervalRefs.values()) {
    clearInterval(intervalId);
  }
  sharedIntervalRefs.clear();

  // Clear all active skills
  sharedActiveSkills.clear();
  notifyActiveSkillsListeners();

  // Clear resume attempt tracking
  sharedResumeAttempted.clear();

  // Clear activeAction if it's a skill action
  const state = useGameState.getState();
  if (state.activeAction && state.activeAction.type === 'skill') {
    useGameState.getState().setActiveAction(null);
  }
};

export function useIdleSkills() {
  const character = useGameState((state) => state.character);
  const setCharacter = useGameState((state) => state.setCharacter);
  const addItem = useGameState((state) => state.addItem);
  const updateIdleSkill = useGameState((state) => state.updateIdleSkill);
  const setActiveAction = useGameState((state) => state.setActiveAction);
  const activeAction = useGameState((state) => state.activeAction);

  // Use shared activeSkills and sync with local state for reactivity
  const [activeSkills, setActiveSkills] = useState<ActiveSkillTraining[]>(getSharedActiveSkills());
  const startGatheringRef = useRef<((skillId: string, nodeId?: string) => void) | null>(null); // Ref to startGathering function

  // Subscribe to shared activeSkills changes
  useEffect(() => {
    const listener = () => {
      setActiveSkills(getSharedActiveSkills());
    };
    activeSkillsListeners.add(listener);

    // Initialize with current shared state
    setActiveSkills(getSharedActiveSkills());

    return () => {
      activeSkillsListeners.delete(listener);
    };
  }, []);

  /**
   * Stop training a skill
   */
  const stopTraining = useCallback(
    (skillId: string) => {
      const intervalId = sharedIntervalRefs.get(skillId);
      if (intervalId) {
        clearInterval(intervalId);
        sharedIntervalRefs.delete(skillId);
      }

      // Remove from shared active skills
      sharedActiveSkills.delete(skillId);
      notifyActiveSkillsListeners();

      // If no skills are active, clear active action
      if (sharedActiveSkills.size === 0) {
        setActiveAction(null);
      }
    },
    [setActiveAction]
  );

  /**
   * Start training a gathering skill
   */
  const startGathering = useCallback(
    (skillId: string, nodeId?: string) => {
      if (!character) {
        return;
      }

      // Check if combat is active - if so, stop it before starting idle skill
      const state = useGameState.getState();
      if (state.isCombatActive || (state.activeAction && state.activeAction.type === 'combat')) {
        useGameState.getState().stopCombat();
      }

      const node = nodeId
        ? ResourceNodeManager.getAllAvailableNodes(character, skillId).find(
            (n) => n.nodeId === nodeId
          )
        : ResourceNodeManager.getBestAvailableNode(character, skillId);

      if (!node) {
        console.warn(`No available node for skill ${skillId}`);
        return;
      }

      // Stop ALL existing idle skills to ensure only one is active at a time
      stopAllIdleSkills();

      const now = Date.now();
      // Add to shared active skills with timing information
      const activeTraining: ActiveSkillTraining = {
        skillId,
        nodeId: node.nodeId,
        startTime: now,
        lastActionTime: now,
        timeRequired: node.timeRequired || 5000,
      };
      sharedActiveSkills.set(skillId, activeTraining);
      notifyActiveSkillsListeners();

      // Start interval for gathering
      const intervalId = window.setInterval(() => {
        const currentCharacter = useGameState.getState().character;
        if (!currentCharacter) {
          stopTraining(skillId);
          return;
        }

        const result = ResourceNodeManager.gatherFromNode(currentCharacter, skillId, node);

        if (result.success) {
          // Add resources to inventory
          for (const resource of result.resources) {
            addItem(resource.itemId, resource.quantity);
          }
        }

        // Add experience
        const expResult = IdleSkillSystem.addSkillExperience(
          currentCharacter,
          skillId,
          result.experience
        );

        // Update character
        setCharacter(expResult.character);

        // Update last action time to reset the timer
        const now = Date.now();
        const currentTraining = sharedActiveSkills.get(skillId);
        if (currentTraining && currentTraining.nodeId === node.nodeId) {
          sharedActiveSkills.set(skillId, {
            ...currentTraining,
            lastActionTime: now,
          });
          notifyActiveSkillsListeners();
        }
      }, node.timeRequired || 5000);

      sharedIntervalRefs.set(skillId, intervalId);

      setActiveAction({ type: 'skill', skillId, nodeId: node.nodeId });

      // Clear resume attempt tracking since we've successfully started the skill
      const actionKey = `${skillId}-${node.nodeId || 'default'}`;
      sharedResumeAttempted.delete(actionKey);
    },
    [character, addItem, setCharacter, updateIdleSkill, stopTraining, setActiveAction]
  );

  // Store startGathering in ref so resume effect can access it without dependency issues
  startGatheringRef.current = startGathering;

  /**
   * Stop all training
   */
  const stopAllTraining = useCallback(() => {
    for (const intervalId of sharedIntervalRefs.values()) {
      clearInterval(intervalId);
    }
    sharedIntervalRefs.clear();
    sharedActiveSkills.clear();
    notifyActiveSkillsListeners();
    setActiveAction(null); // Clear active action when stopping all training
  }, [setActiveAction]);

  // Resume skill training if there's an active action after offline progress
  // This runs:
  // 1. When the hook mounts (e.g., when SkillDetailView is shown)
  // 2. When activeAction changes to a skill action (e.g., after offline progress is processed)
  useEffect(() => {
    // Get current state
    const currentActiveAction = activeAction;
    const currentCharacter = character;

    // Only proceed if we have a valid skill action
    if (!currentActiveAction || currentActiveAction.type !== 'skill' || !currentCharacter) {
      return;
    }

    const skillId = currentActiveAction.skillId;
    const nodeId = currentActiveAction.nodeId;
    const actionKey = `${skillId}-${nodeId || 'default'}`;

    // Check if skill is already training (if so, we're done)
    if (sharedIntervalRefs.has(skillId)) {
      return;
    }

    // Check if we've already attempted to resume this specific action
    // Only skip if we've tried AND the skill is not training (to avoid infinite loops)
    if (sharedResumeAttempted.get(actionKey)) {
      return;
    }

    // Mark that we're attempting to resume this action BEFORE calling startGathering
    // This prevents infinite loops if multiple instances try to resume
    sharedResumeAttempted.set(actionKey, true);

    // Get the startGathering function from ref
    const startGatheringFn = startGatheringRef.current;
    if (startGatheringFn) {
      // Call startGathering - this will update state and potentially cause a remount
      startGatheringFn(skillId, nodeId);

      // Clear the tracking after a short delay to allow the interval to be set
      // This ensures that if the component remounts, it can check if the skill is already training
      setTimeout(() => {
        if (sharedIntervalRefs.has(skillId)) {
          sharedResumeAttempted.delete(actionKey);
        }
      }, 100);
    } else {
      console.error('startGathering function not available - this should not happen');
      sharedResumeAttempted.delete(actionKey);
    }
  }, [activeAction, character]); // Watch activeAction and character changes

  // Cleanup on unmount - only clear intervals if this is the last instance
  // Note: We don't clear intervals on unmount because the hook might be mounted in multiple places
  // The intervals should persist as long as there's an activeAction in state
  // If activeAction is cleared, stopAllTraining will be called explicitly
  useEffect(() => {
    return () => {
      // Don't stop all training on unmount - let intervals continue running
      // This allows skills to continue even if SkillDetailView unmounts
      // The intervals will be cleaned up when activeAction is cleared or stopAllTraining is called explicitly
    };
  }, []);

  return {
    startGathering,
    stopTraining,
    stopAllTraining,
    activeSkills,
  };
}
