import type {
  Character,
  ChronicleData,
  ChronicleEntry,
  NarrativeChoice,
  LegendTitle,
  Stats,
  CombatStats,
} from '@idle-rpg/shared';
import { getDataLoader } from '@/data';

interface NarrativeTemplate {
  version: string;
  templates: {
    [key: string]: {
      title: string;
      narratives: {
        [key: string]: string;
      };
    };
  };
}

interface LegendTitlesData {
  version: string;
  titles: {
    [key: string]: LegendTitle;
  };
}

interface ChoiceScenario {
  id: string;
  trigger: {
    type: string;
    [key: string]: any;
  };
  prompt: string;
  options: Array<{
    id: string;
    text: string;
    description?: string;
    consequences?: {
      titleId?: string;
      statBonus?: Partial<Stats>;
      combatStatBonus?: Partial<CombatStats>;
      narrativePath?: string;
    };
  }>;
}

interface ChoiceScenariosData {
  version: string;
  scenarios: {
    [key: string]: ChoiceScenario;
  };
}

export class ChronicleManager {
  private static narrativeTemplatesCache: NarrativeTemplate | null = null;
  private static legendTitlesCache: LegendTitlesData | null = null;
  private static choiceScenariosCache: ChoiceScenariosData | null = null;

  /**
   * Initialize chronicle data for a new character
   */
  static initializeChronicle(): ChronicleData {
    return {
      entries: [],
      activeTitleId: undefined,
      unlockedTitles: [],
      choiceHistory: [],
      lastMilestoneLevel: 1,
      recordedMilestones: [],
    };
  }

  /**
   * Load narrative templates
   */
  private static async loadNarrativeTemplates(): Promise<NarrativeTemplate> {
    if (this.narrativeTemplatesCache) {
      return this.narrativeTemplatesCache;
    }

    try {
      const response = await fetch('/data/chronicle/narrative_templates.json');
      if (!response.ok) {
        throw new Error(`Failed to load narrative templates: ${response.statusText}`);
      }
      const data = await response.json();
      this.narrativeTemplatesCache = data;
      return data;
    } catch (error) {
      console.error('Error loading narrative templates:', error);
      // Return empty template structure
      return { version: '1.0.0', templates: {} };
    }
  }

  /**
   * Load legend titles
   */
  private static async loadLegendTitles(): Promise<LegendTitlesData> {
    if (this.legendTitlesCache) {
      return this.legendTitlesCache;
    }

    try {
      const response = await fetch('/data/chronicle/legend_titles.json');
      if (!response.ok) {
        throw new Error(`Failed to load legend titles: ${response.statusText}`);
      }
      const data = await response.json();
      this.legendTitlesCache = data;
      return data;
    } catch (error) {
      console.error('Error loading legend titles:', error);
      return { version: '1.0.0', titles: {} };
    }
  }

  /**
   * Load choice scenarios
   */
  private static async loadChoiceScenarios(): Promise<ChoiceScenariosData> {
    if (this.choiceScenariosCache) {
      return this.choiceScenariosCache;
    }

    try {
      const response = await fetch('/data/chronicle/choice_scenarios.json');
      if (!response.ok) {
        throw new Error(`Failed to load choice scenarios: ${response.statusText}`);
      }
      const data = await response.json();
      this.choiceScenariosCache = data;
      return data;
    } catch (error) {
      console.error('Error loading choice scenarios:', error);
      return { version: '1.0.0', scenarios: {} };
    }
  }

  /**
   * Generate narrative text from template
   */
  private static generateNarrative(
    templateKey: string,
    character: Character,
    metadata?: Record<string, any>
  ): { title: string; narrative: string } | null {
    const templates = this.narrativeTemplatesCache;
    if (!templates) {
      return null;
    }

    const template = templates.templates[templateKey];
    if (!template) {
      return null;
    }

    // Get class-specific or default narrative
    const dataLoader = getDataLoader();
    const characterClass = dataLoader.getClass(character.classId);
    const classId = characterClass?.id || 'default';

    let narrativeText = template.narratives[classId] || template.narratives['default'];
    if (!narrativeText) {
      return null;
    }

    // Replace variables in narrative
    narrativeText = narrativeText.replace(/\{\{name\}\}/g, character.name);
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        narrativeText = narrativeText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
      }
    }

    return {
      title: template.title,
      narrative: narrativeText,
    };
  }

  /**
   * Record a milestone and generate story entry
   */
  static recordMilestone(
    character: Character,
    milestoneType: string,
    category: ChronicleEntry['category'],
    metadata?: Record<string, any>
  ): { character: Character; entry?: ChronicleEntry } {
    if (!character.chronicle) {
      character.chronicle = this.initializeChronicle();
    }

    const chronicle = character.chronicle;
    const milestoneKey = `${milestoneType}_${metadata?.level || metadata?.dungeonId || metadata?.monsterId || ''}`;

    // Check if we've already recorded this milestone
    if (chronicle.recordedMilestones.includes(milestoneKey)) {
      return { character };
    }

    // Generate narrative
    const narrative = this.generateNarrative(milestoneType, character, metadata);
    if (!narrative) {
      return { character };
    }

    // Create entry
    const entry: ChronicleEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      category,
      title: narrative.title,
      narrative: narrative.narrative,
      metadata: metadata || {},
    };

    // Add to entries (limit to last 1000)
    chronicle.entries.push(entry);
    if (chronicle.entries.length > 1000) {
      chronicle.entries = chronicle.entries.slice(-1000);
    }

    // Mark milestone as recorded
    if (!chronicle.recordedMilestones.includes(milestoneKey)) {
      chronicle.recordedMilestones.push(milestoneKey);
    }

    // Update character
    const updatedCharacter: Character = {
      ...character,
      chronicle,
    };

    return { character: updatedCharacter, entry };
  }

  /**
   * Check if a title should be unlocked
   */
  static async checkTitleUnlocks(character: Character): Promise<{ character: Character; unlockedTitles: string[] }> {
    if (!character.chronicle) {
      character.chronicle = this.initializeChronicle();
    }

    const titlesData = await this.loadLegendTitles();
    const chronicle = character.chronicle;
    const unlockedTitles: string[] = [];

    for (const [titleId, title] of Object.entries(titlesData.titles)) {
      // Skip if already unlocked
      if (chronicle.unlockedTitles.includes(titleId)) {
        continue;
      }

      // Check requirements
      if (this.checkTitleRequirements(character, title)) {
        chronicle.unlockedTitles.push(titleId);
        unlockedTitles.push(titleId);
      }
    }

    if (unlockedTitles.length > 0) {
      const updatedCharacter: Character = {
        ...character,
        chronicle,
      };
      return { character: updatedCharacter, unlockedTitles };
    }

    return { character, unlockedTitles: [] };
  }

  /**
   * Check if character meets title requirements
   */
  private static checkTitleRequirements(character: Character, title: LegendTitle): boolean {
    const requirements = title.requirements;

    // Check level requirement
    if (requirements.level && character.level < requirements.level) {
      return false;
    }

    // Check dungeon completions
    if (requirements.dungeonCompletions) {
      const completedDungeons = character.statistics?.totalCombatVictories || 0;
      if (completedDungeons < requirements.dungeonCompletions) {
        return false;
      }
    }

    // Check monster kills
    if (requirements.monsterKills) {
      const stats = character.statistics;
      if (!stats || !stats.monsterKills) {
        return false;
      }
      for (const [monsterId, requiredCount] of Object.entries(requirements.monsterKills)) {
        const killCount = stats.monsterKills[monsterId] || 0;
        if (killCount < requiredCount) {
          return false;
        }
      }
    }

    // Check skill levels
    if (requirements.skillLevels) {
      const idleSkills = character.idleSkills || [];
      for (const [skillId, requiredLevel] of Object.entries(requirements.skillLevels)) {
        const skill = idleSkills.find((s) => s.skillId === skillId);
        if (!skill || skill.level < requiredLevel) {
          return false;
        }
      }
    }

    // Check achievements
    if (requirements.achievementIds && requirements.achievementIds.length > 0) {
      const completedAchievements = character.completedAchievements || [];
      const completedIds = completedAchievements.map((a) => a.achievementId);
      for (const achievementId of requirements.achievementIds) {
        if (!completedIds.includes(achievementId)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get active title bonuses (synchronous if data is loaded)
   */
  static getActiveTitleBonuses(character: Character): {
    statBonus?: Partial<Stats>;
    combatStatBonus?: Partial<CombatStats>;
    combatMultiplier?: { experience?: number; gold?: number; itemDropRate?: number };
    skillMultiplier?: { experience?: number; speed?: number; yield?: number };
    inventorySlots?: number;
  } {
    if (!character.chronicle || !character.chronicle.activeTitleId) {
      return {};
    }

    // If titles are loaded, get the active title's bonuses
    if (this.legendTitlesCache) {
      const title = this.legendTitlesCache.titles[character.chronicle.activeTitleId];
      if (title && title.bonuses) {
        return {
          statBonus: title.bonuses.statBonus,
          combatStatBonus: title.bonuses.combatStatBonus,
          combatMultiplier: title.bonuses.combatMultiplier,
          skillMultiplier: title.bonuses.skillMultiplier,
          inventorySlots: title.bonuses.inventorySlots,
        };
      }
    }

    return {};
  }

  /**
   * Set active title
   */
  static setActiveTitle(character: Character, titleId: string | undefined): Character {
    if (!character.chronicle) {
      character.chronicle = this.initializeChronicle();
    }

    // Validate title is unlocked
    if (titleId && !character.chronicle.unlockedTitles.includes(titleId)) {
      return character;
    }

    const updatedChronicle: ChronicleData = {
      ...character.chronicle,
      activeTitleId: titleId,
    };

    return {
      ...character,
      chronicle: updatedChronicle,
    };
  }

  /**
   * Get a choice scenario that should be triggered
   */
  static async getTriggeredChoice(
    character: Character,
    eventType: string,
    eventData?: Record<string, any>
  ): Promise<NarrativeChoice | null> {
    const scenariosData = await this.loadChoiceScenarios();
    const chronicle = character.chronicle || this.initializeChronicle();

    // Check if we've already presented this choice
    for (const choice of chronicle.choiceHistory) {
      if (choice.resolvedAt) {
        continue; // Already resolved
      }
      // Check if this scenario matches
      const scenario = scenariosData.scenarios[choice.scenarioId];
      if (scenario && scenario.trigger.type === eventType) {
        return choice; // Return existing unresolved choice
      }
    }

    // Find matching scenario
    for (const [scenarioId, scenario] of Object.entries(scenariosData.scenarios)) {
      if (scenario.trigger.type !== eventType) {
        continue;
      }

      // Check trigger conditions
      if (this.checkTriggerConditions(scenario.trigger, character, eventData)) {
        // Check if we've already resolved this scenario
        const alreadyResolved = chronicle.choiceHistory.some(
          (c) => c.scenarioId === scenarioId && c.resolvedAt
        );
        if (alreadyResolved) {
          continue;
        }

        // Create choice
        const choice: NarrativeChoice = {
          id: `choice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          scenarioId,
          prompt: scenario.prompt,
          options: scenario.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            description: opt.description,
            consequences: opt.consequences,
          })),
          triggeredAt: Date.now(),
        };

        return choice;
      }
    }

    return null;
  }

  /**
   * Check if trigger conditions are met
   */
  private static checkTriggerConditions(
    trigger: ChoiceScenario['trigger'],
    character: Character,
    eventData?: Record<string, any>
  ): boolean {
    // Check level requirement
    if (trigger.level && character.level !== trigger.level) {
      return false;
    }

    // Check if first event
    if (trigger.isFirst) {
      const chronicle = character.chronicle || this.initializeChronicle();
      // This is simplified - in practice, you'd check if this is truly the first
      // For now, we'll assume it's checked by the caller
    }

    // Check skill level
    if (trigger.skillLevel) {
      const skillId = eventData?.skillId;
      if (!skillId) {
        return false;
      }
      const idleSkills = character.idleSkills || [];
      const skill = idleSkills.find((s) => s.skillId === skillId);
      if (!skill || skill.level !== trigger.skillLevel) {
        return false;
      }
    }

    return true;
  }

  /**
   * Record a choice decision
   */
  static recordChoice(character: Character, choiceId: string, optionId: string): Character {
    if (!character.chronicle) {
      character.chronicle = this.initializeChronicle();
    }

    const chronicle = character.chronicle;
    const choice = chronicle.choiceHistory.find((c) => c.id === choiceId);
    if (!choice) {
      return character;
    }

    // Update choice
    choice.chosenOptionId = optionId;
    choice.resolvedAt = Date.now();

    // Apply consequences
    const option = choice.options.find((o) => o.id === optionId);
    if (option?.consequences) {
      // Apply stat bonuses (these would need to be applied to character stats)
      // For now, we'll just record the choice
      // In practice, you'd want to apply these bonuses immediately
    }

    // Update character
    return {
      ...character,
      chronicle,
    };
  }

  /**
   * Preload all chronicle data
   */
  static async preloadData(): Promise<void> {
    await Promise.all([
      this.loadNarrativeTemplates(),
      this.loadLegendTitles(),
      this.loadChoiceScenarios(),
    ]);
  }
}
