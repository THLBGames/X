import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameState } from '../systems';
import type { ResourceNode } from '@idle-rpg/shared';
import { IdleSkillSystem } from '../systems/skills/IdleSkillSystem';
import { ResourceNodeManager } from '../systems/skills/ResourceNodeManager';
import { InventoryManager } from '../systems/inventory';

interface ActiveSkillTraining {
  skillId: string;
  nodeId?: string; // For gathering skills
  recipeId?: string; // For production skills
}

export function useIdleSkills() {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const setCharacter = useGameState((state) => state.setCharacter);
  const addItem = useGameState((state) => state.addItem);
  const updateIdleSkill = useGameState((state) => state.updateIdleSkill);

  const [activeSkills, setActiveSkills] = useState<ActiveSkillTraining[]>([]);
  const intervalRefsRef = useRef<Map<string, number>>(new Map());

  /**
   * Stop training a skill
   */
  const stopTraining = useCallback((skillId: string) => {
    const intervalId = intervalRefsRef.current.get(skillId);
    if (intervalId) {
      clearInterval(intervalId);
      intervalRefsRef.current.delete(skillId);
    }

    setActiveSkills((prev) => prev.filter((s) => s.skillId !== skillId));
  }, []);

  /**
   * Start training a gathering skill
   */
  const startGathering = useCallback(
    (skillId: string, nodeId?: string) => {
      if (!character) return;

      const node = nodeId
        ? ResourceNodeManager.getAllAvailableNodes(character, skillId).find(
            (n) => n.nodeId === nodeId
          )
        : ResourceNodeManager.getBestAvailableNode(character, skillId);

      if (!node) {
        console.warn(`No available node for skill ${skillId}`);
        return;
      }

      // Stop existing training for this skill
      stopTraining(skillId);

      // Add to active skills
      setActiveSkills((prev) => [...prev, { skillId, nodeId: node.nodeId }]);

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

        // Update skill in state
        const skill = expResult.character.idleSkills?.find((s) => s.skillId === skillId);
        if (skill) {
          updateIdleSkill(skillId, {
            level: skill.level,
            experience: skill.experience,
            experienceToNext: skill.experienceToNext,
          });
        }
      }, node.timeRequired || 5000);

      intervalRefsRef.current.set(skillId, intervalId);
    },
    [character, addItem, setCharacter, updateIdleSkill, stopTraining]
  );

  /**
   * Stop all training
   */
  const stopAllTraining = useCallback(() => {
    for (const intervalId of intervalRefsRef.current.values()) {
      clearInterval(intervalId);
    }
    intervalRefsRef.current.clear();
    setActiveSkills([]);
  }, []);

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

