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

export function useIdleSkills() {
  const character = useGameState((state) => state.character);
  const setCharacter = useGameState((state) => state.setCharacter);
  const addItem = useGameState((state) => state.addItem);
  const updateIdleSkill = useGameState((state) => state.updateIdleSkill);
  const setActiveAction = useGameState((state) => state.setActiveAction);
  const activeAction = useGameState((state) => state.activeAction);

  const [activeSkills, setActiveSkills] = useState<ActiveSkillTraining[]>([]);
  const intervalRefsRef = useRef<Map<string, number>>(new Map());
  const resumeAttemptedRef = useRef<string | null>(null); // Track if we've attempted to resume a specific skill
  const startGatheringRef = useRef<((skillId: string, nodeId?: string) => void) | null>(null); // Ref to startGathering function

  /**
   * Stop training a skill
   */
  const stopTraining = useCallback((skillId: string) => {
    const intervalId = intervalRefsRef.current.get(skillId);
    if (intervalId) {
      clearInterval(intervalId);
      intervalRefsRef.current.delete(skillId);
    }

    setActiveSkills((prev) => {
      const remaining = prev.filter((s) => s.skillId !== skillId);
      // If no skills are active, clear active action
      if (remaining.length === 0) {
        setActiveAction(null);
      }
      return remaining;
    });
  }, [setActiveAction]);

  /**
   * Start training a gathering skill
   */
  const startGathering = useCallback(
    (skillId: string, nodeId?: string) => {
      console.log('startGathering called with:', { skillId, nodeId, hasCharacter: !!character });
      if (!character) {
        console.warn('startGathering: No character');
        return;
      }

      const node = nodeId
        ? ResourceNodeManager.getAllAvailableNodes(character, skillId).find(
            (n) => n.nodeId === nodeId
          )
        : ResourceNodeManager.getBestAvailableNode(character, skillId);

      console.log('startGathering: Found node:', node?.nodeId || 'null');
      if (!node) {
        console.warn(`No available node for skill ${skillId}`);
        return;
      }

      // Stop existing training for this skill (without clearing activeAction - we'll set it below)
      const existingIntervalId = intervalRefsRef.current.get(skillId);
      if (existingIntervalId) {
        clearInterval(existingIntervalId);
        intervalRefsRef.current.delete(skillId);
      }
      // Remove from active skills list (but don't clear activeAction via stopTraining)
      setActiveSkills((prev) => prev.filter((s) => s.skillId !== skillId));

      const now = Date.now();
      // Add to active skills with timing information
      setActiveSkills((prev) => [...prev, { 
        skillId, 
        nodeId: node.nodeId,
        startTime: now,
        lastActionTime: now,
        timeRequired: node.timeRequired || 5000
      }]);

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
        setActiveSkills((prev) => prev.map((s) => 
          s.skillId === skillId && s.nodeId === node.nodeId
            ? { ...s, lastActionTime: now }
            : s
        ));
      }, node.timeRequired || 5000);

      intervalRefsRef.current.set(skillId, intervalId);
      console.log('startGathering: Interval set for skill:', skillId, 'intervalId:', intervalId);

      // Set active action for offline progress (must be set after everything else)
      console.log('startGathering: Setting activeAction:', { type: 'skill', skillId, nodeId: node.nodeId });
      setActiveAction({ type: 'skill', skillId, nodeId: node.nodeId });
      console.log('startGathering: activeAction set, current state:', useGameState.getState().activeAction);
      
      // Clear resume attempt ref since we've successfully started the skill
      resumeAttemptedRef.current = null;
    },
    [character, addItem, setCharacter, updateIdleSkill, stopTraining, setActiveAction]
  );
  
  // Store startGathering in ref so resume effect can access it without dependency issues
  startGatheringRef.current = startGathering;

  /**
   * Stop all training
   */
  const stopAllTraining = useCallback(() => {
    for (const intervalId of intervalRefsRef.current.values()) {
      clearInterval(intervalId);
    }
    intervalRefsRef.current.clear();
    setActiveSkills([]);
    setActiveAction(null); // Clear active action when stopping all training
  }, [setActiveAction]);

  // Resume skill training if there's an active action after offline progress
  // This runs once when the hook mounts (e.g., when SkillDetailView is shown)
  useEffect(() => {
    // Capture the activeAction at mount time, since it might be cleared later
    const mountActiveAction = useGameState.getState().activeAction;
    const mountCharacter = useGameState.getState().character;
    
    console.log('useIdleSkills resume effect triggered (mount)', { 
      character: !!mountCharacter, 
      activeAction: mountActiveAction 
    });
    
    // Only proceed if we have a valid skill action at mount time
    if (!mountActiveAction || mountActiveAction.type !== 'skill' || !mountCharacter) {
      console.log('No valid active skill action at mount, skipping resume', { mountActiveAction, hasCharacter: !!mountCharacter });
      return;
    }
    
    const skillId = mountActiveAction.skillId;
    const nodeId = mountActiveAction.nodeId;
    const actionKey = `${skillId}-${nodeId || 'default'}`;
    
    // Check if skill is already training (if so, we're done)
    if (intervalRefsRef.current.has(skillId)) {
      console.log('Skill already training (interval exists), skipping resume');
      return;
    }
    
    // Check if we've already attempted to resume this specific action in this session
    // Only skip if we've tried AND the skill is not training (to avoid infinite loops)
    if (resumeAttemptedRef.current === actionKey) {
      console.log('Already attempted to resume this action, skipping:', actionKey);
      return;
    }
    
    console.log('Attempting to resume skill:', skillId, 'node:', nodeId);
    
    // Mark that we're attempting to resume this action BEFORE calling startGathering
    // This prevents infinite loops if the component remounts
    resumeAttemptedRef.current = actionKey;
    
    // Get the startGathering function from ref
    const startGatheringFn = startGatheringRef.current;
    if (startGatheringFn) {
      console.log('Calling startGathering for skill:', skillId, 'node:', nodeId);
      
      // Call startGathering - this will update state and potentially cause a remount
      startGatheringFn(skillId, nodeId);
      
      // Clear the ref immediately so if the component remounts, it can check if the skill is already training
      // rather than being blocked by the "already attempted" check
      // The interval check (line 170) will handle the case where the skill is already training
      resumeAttemptedRef.current = null;
    } else {
      console.error('startGathering function not available - this should not happen');
      resumeAttemptedRef.current = null;
    }
  }, []); // Empty dependency array - only run on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllTraining();
    };
  }, [stopAllTraining]);

  return {
    startGathering,
    stopTraining,
    stopAllTraining,
    activeSkills,
  };
}

