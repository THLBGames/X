import type { Character, QuestProgress } from '@idle-rpg/shared';
import { getDataLoader } from '@/data';

export class QuestManager {
  /**
   * Get quest progress for a character
   */
  static getQuestProgress(character: Character, questId: string): QuestProgress | undefined {
    return character.questProgress?.find((qp) => qp.questId === questId);
  }

  /**
   * Check if a character has completed a quest
   */
  static hasCompletedQuest(character: Character, questId: string): boolean {
    const progress = this.getQuestProgress(character, questId);
    return progress?.completed ?? false;
  }

  /**
   * Initialize quest progress for a character if it doesn't exist
   */
  static initializeQuestProgress(character: Character, questId: string): Character {
    const dataLoader = getDataLoader();
    const quest = dataLoader.getQuest(questId);
    
    if (!quest) {
      return character;
    }

    const existingProgress = this.getQuestProgress(character, questId);
    if (existingProgress) {
      return character;
    }

    const newProgress: QuestProgress = {
      questId,
      completed: false,
      progress: 0,
      required: quest.requirements.quantity,
    };

    return {
      ...character,
      questProgress: [...(character.questProgress || []), newProgress],
    };
  }

  /**
   * Update quest progress
   */
  static updateQuestProgress(
    character: Character,
    questId: string,
    amount: number = 1
  ): Character {
    const dataLoader = getDataLoader();
    const quest = dataLoader.getQuest(questId);
    
    if (!quest) {
      return character;
    }

    // Initialize progress if it doesn't exist
    let updatedCharacter = this.initializeQuestProgress(character, questId);
    
    const questProgress = updatedCharacter.questProgress || [];
    const progressIndex = questProgress.findIndex((qp) => qp.questId === questId);
    
    if (progressIndex === -1) {
      return updatedCharacter;
    }

    const currentProgress = questProgress[progressIndex];
    
    // Don't update if already completed
    if (currentProgress.completed) {
      return updatedCharacter;
    }

    const newProgress = Math.min(
      currentProgress.progress + amount,
      currentProgress.required
    );

    const updatedProgress: QuestProgress = {
      ...currentProgress,
      progress: newProgress,
      completed: newProgress >= currentProgress.required,
    };

    const newQuestProgress = [...questProgress];
    newQuestProgress[progressIndex] = updatedProgress;

    updatedCharacter = {
      ...updatedCharacter,
      questProgress: newQuestProgress,
    };

    // Auto-complete if requirements are met
    if (updatedProgress.completed) {
      return this.completeQuest(updatedCharacter, questId);
    }

    return updatedCharacter;
  }

  /**
   * Check if quest requirements are met
   */
  static canCompleteQuest(character: Character, questId: string): boolean {
    const dataLoader = getDataLoader();
    const quest = dataLoader.getQuest(questId);
    
    if (!quest) {
      return false;
    }

    const progress = this.getQuestProgress(character, questId);
    if (!progress) {
      return false;
    }

    return progress.progress >= progress.required;
  }

  /**
   * Complete a quest and grant rewards
   */
  static completeQuest(character: Character, questId: string): Character {
    const dataLoader = getDataLoader();
    const quest = dataLoader.getQuest(questId);
    
    if (!quest) {
      return character;
    }

    const questProgress = character.questProgress || [];
    const progressIndex = questProgress.findIndex((qp) => qp.questId === questId);
    
    if (progressIndex === -1) {
      return character;
    }

    const currentProgress = questProgress[progressIndex];
    
    // Mark as completed
    const updatedProgress: QuestProgress = {
      ...currentProgress,
      completed: true,
    };

    const newQuestProgress = [...questProgress];
    newQuestProgress[progressIndex] = updatedProgress;

    return {
      ...character,
      questProgress: newQuestProgress,
    };
  }

  /**
   * Check quest completion and auto-complete if requirements are met
   */
  static checkQuestCompletion(character: Character, questId: string): Character {
    if (this.canCompleteQuest(character, questId)) {
      return this.completeQuest(character, questId);
    }
    return character;
  }

  /**
   * Get all active (incomplete) quests for a character
   */
  static getActiveQuests(character: Character): QuestProgress[] {
    return (character.questProgress || []).filter((qp) => !qp.completed);
  }

  /**
   * Get all completed quests for a character
   */
  static getCompletedQuests(character: Character): QuestProgress[] {
    return (character.questProgress || []).filter((qp) => qp.completed);
  }
}

