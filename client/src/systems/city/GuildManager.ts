import type {
  Character,
  Guild,
  GuildProgress,
  CityData,
} from '@idle-rpg/shared';
import { CityManager } from './CityManager';
import { IdleSkillSystem } from '../skills/IdleSkillSystem';

interface GuildsData {
  version: string;
  guilds: {
    [key: string]: Guild;
  };
}

export class GuildManager {
  private static guildsCache: GuildsData | null = null;
  // TODO: Implement primary guild switch cooldown feature
  // private static readonly PRIMARY_GUILD_SWITCH_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private static readonly SECONDARY_GUILD_BONUS_MULTIPLIER = 0.5; // 50% of primary benefits

  /**
   * Load guilds data
   */
  private static async loadGuilds(): Promise<GuildsData> {
    if (this.guildsCache) {
      return this.guildsCache;
    }

    try {
      const response = await fetch('/data/city/guilds.json');
      if (!response.ok) {
        throw new Error(`Failed to load guilds: ${response.statusText}`);
      }
      const data = await response.json();
      this.guildsCache = data;
      return data;
    } catch (error) {
      console.error('Error loading guilds:', error);
      return { version: '1.0.0', guilds: {} };
    }
  }

  /**
   * Get a guild definition
   */
  static async getGuild(guildId: string): Promise<Guild | null> {
    const data = await this.loadGuilds();
    return data.guilds[guildId] || null;
  }

  /**
   * Get all guild definitions
   */
  static async getAllGuilds(): Promise<Guild[]> {
    const data = await this.loadGuilds();
    return Object.values(data.guilds);
  }

  /**
   * Get guild progress for a character
   */
  static getGuildProgress(city: CityData, guildId: string): GuildProgress | null {
    return city.guildProgress[guildId] || null;
  }

  /**
   * Check if a character can join a guild
   */
  static async canJoinGuild(character: Character, guildId: string): Promise<{
    canJoin: boolean;
    reason?: string;
  }> {
    if (!character.city) {
      return { canJoin: false, reason: 'City not initialized' };
    }

    const guild = await this.getGuild(guildId);
    if (!guild) {
      return { canJoin: false, reason: 'Guild not found' };
    }

    const city = character.city;

    // Check if already in guild
    if (city.primaryGuildId === guildId || city.secondaryGuildIds.includes(guildId)) {
      return { canJoin: false, reason: 'Already a member of this guild' };
    }

    // Check if guild hall is built
    const guildHallLevel = CityManager.getBuildingLevel(city, guild.buildingId);
    if (guildHallLevel === 0) {
      return {
        canJoin: false,
        reason: `Requires ${guild.buildingId} to be built`,
      };
    }

    // Check if at max secondary guilds (limit to 3 secondary guilds)
    if (city.secondaryGuildIds.length >= 3 && !city.primaryGuildId) {
      return {
        canJoin: false,
        reason: 'Maximum number of guild memberships reached',
      };
    }

    return { canJoin: true };
  }

  /**
   * Join a guild (as primary or secondary)
   */
  static async joinGuild(
    character: Character,
    guildId: string,
    asPrimary: boolean = false
  ): Promise<{ success: boolean; character?: Character; reason?: string }> {
    if (!character.city) {
      character.city = CityManager.initializeCity();
    }

    const canJoin = await this.canJoinGuild(character, guildId);
    if (!canJoin.canJoin) {
      return { success: false, reason: canJoin.reason };
    }

    const guild = await this.getGuild(guildId);
    if (!guild) {
      return { success: false, reason: 'Guild not found' };
    }

    const city = character.city;
    let newPrimaryGuildId = city.primaryGuildId;
    let newSecondaryGuildIds = [...city.secondaryGuildIds];
    const newGuildProgress = { ...city.guildProgress };

    if (asPrimary) {
      // If switching primary guild, move old primary to secondary
      if (newPrimaryGuildId && !newSecondaryGuildIds.includes(newPrimaryGuildId)) {
        newSecondaryGuildIds.push(newPrimaryGuildId);
      }
      newPrimaryGuildId = guildId;
      // Remove from secondary if it was there
      newSecondaryGuildIds = newSecondaryGuildIds.filter((id) => id !== guildId);
    } else {
      // Add as secondary
      if (!newSecondaryGuildIds.includes(guildId)) {
        newSecondaryGuildIds.push(guildId);
      }
    }

    // Initialize guild progress if not exists
    if (!newGuildProgress[guildId]) {
      newGuildProgress[guildId] = {
        guildId,
        rank: 1,
        experience: 0,
        experienceToNext: 100,
        joinedAt: Date.now(),
      };
    }

    const newCity: CityData = {
      ...city,
      primaryGuildId: newPrimaryGuildId,
      secondaryGuildIds: newSecondaryGuildIds,
      guildProgress: newGuildProgress,
    };

    const updatedCharacter: Character = {
      ...character,
      city: newCity,
    };

    return {
      success: true,
      character: updatedCharacter,
    };
  }

  /**
   * Switch primary guild
   */
  static async switchPrimaryGuild(
    character: Character,
    newPrimaryGuildId: string
  ): Promise<{ success: boolean; character?: Character; reason?: string }> {
    if (!character.city) {
      return { success: false, reason: 'City not initialized' };
    }

    const city = character.city;

    // Check if already primary
    if (city.primaryGuildId === newPrimaryGuildId) {
      return { success: false, reason: 'Already primary guild' };
    }

    // Check cooldown (simplified - in full implementation, track last switch time)
    // For now, allow switching

    // Check if member of new guild
    const isMember =
      city.primaryGuildId === newPrimaryGuildId ||
      city.secondaryGuildIds.includes(newPrimaryGuildId);
    if (!isMember) {
      return { success: false, reason: 'Not a member of this guild' };
    }

    // Switch guilds
    const result = await this.joinGuild(character, newPrimaryGuildId, true);
    return result;
  }

  /**
   * Check if player can rank up in a guild
   */
  static async canRankUp(
    character: Character,
    guildId: string
  ): Promise<{ canRankUp: boolean; reason?: string }> {
    if (!character.city) {
      return { canRankUp: false, reason: 'City not initialized' };
    }

    const guild = await this.getGuild(guildId);
    if (!guild) {
      return { canRankUp: false, reason: 'Guild not found' };
    }

    const city = character.city;
    const progress = this.getGuildProgress(city, guildId);
    if (!progress) {
      return { canRankUp: false, reason: 'Not a member of this guild' };
    }

    const currentRank = progress.rank;
    const nextRank = currentRank + 1;
    const rankData = guild.ranks.find((r) => r.rank === nextRank);

    if (!rankData) {
      return { canRankUp: false, reason: 'Already at max rank' };
    }

    // Check experience requirement
    if (progress.experience < progress.experienceToNext) {
      return {
        canRankUp: false,
        reason: `Need ${progress.experienceToNext} guild experience (have: ${progress.experience})`,
      };
    }

    // Check level requirement
    if (rankData.requirements.level && character.level < rankData.requirements.level) {
      return {
        canRankUp: false,
        reason: `Requires level ${rankData.requirements.level} (current: ${character.level})`,
      };
    }

    // Check skill level requirements
    if (rankData.requirements.skillLevels) {
      for (const [skillId, requiredLevel] of Object.entries(rankData.requirements.skillLevels)) {
        const skillLevel = IdleSkillSystem.getSkillLevel(character, skillId);
        if (skillLevel < requiredLevel) {
          const dataLoader = await import('@/data').then((m) => m.getDataLoader());
          const skill = dataLoader.getSkill(skillId);
          const skillName = skill?.name || skillId;
          return {
            canRankUp: false,
            reason: `Requires ${skillName} level ${requiredLevel} (current: ${skillLevel})`,
          };
        }
      }
    }

    // Check quest completion requirement
    if (rankData.requirements.questsCompleted) {
      const completedQuests = character.completedAchievements?.length || 0;
      if (completedQuests < rankData.requirements.questsCompleted) {
        return {
          canRankUp: false,
          reason: `Requires ${rankData.requirements.questsCompleted} completed quests (have: ${completedQuests})`,
        };
      }
    }

    return { canRankUp: true };
  }

  /**
   * Rank up in a guild
   */
  static async rankUp(
    character: Character,
    guildId: string
  ): Promise<{ success: boolean; character?: Character; reason?: string }> {
    if (!character.city) {
      return { success: false, reason: 'City not initialized' };
    }

    const canRankUp = await this.canRankUp(character, guildId);
    if (!canRankUp.canRankUp) {
      return { success: false, reason: canRankUp.reason };
    }

    const guild = await this.getGuild(guildId);
    if (!guild) {
      return { success: false, reason: 'Guild not found' };
    }

    const city = character.city;
    const progress = this.getGuildProgress(city, guildId);
    if (!progress) {
      return { success: false, reason: 'Not a member of this guild' };
    }

    const nextRank = progress.rank + 1;
    const rankData = guild.ranks.find((r) => r.rank === nextRank);
    if (!rankData) {
      return { success: false, reason: 'Next rank data not found' };
    }

    // Calculate experience needed for next rank (simple formula)
    const experienceToNext = Math.floor(100 * Math.pow(1.5, nextRank - 1));

    const updatedProgress: GuildProgress = {
      ...progress,
      rank: nextRank,
      experience: progress.experience - progress.experienceToNext,
      experienceToNext,
    };

    const newGuildProgress = {
      ...city.guildProgress,
      [guildId]: updatedProgress,
    };

    const newCity: CityData = {
      ...city,
      guildProgress: newGuildProgress,
    };

    const updatedCharacter: Character = {
      ...character,
      city: newCity,
    };

    return {
      success: true,
      character: updatedCharacter,
    };
  }

  /**
   * Get active guild bonuses for a character
   */
  static async getGuildBonuses(character: Character): Promise<{
    skillMultiplier: Record<string, number>;
    vendorDiscount: number;
  }> {
    if (!character.city) {
      return {
        skillMultiplier: {},
        vendorDiscount: 0,
      };
    }

    const city = character.city;
    const skillMultiplier: Record<string, number> = {};
    let vendorDiscount = 0;

    // Primary guild bonuses (full)
    if (city.primaryGuildId) {
      const guild = await this.getGuild(city.primaryGuildId);
      if (guild) {
        const progress = this.getGuildProgress(city, city.primaryGuildId);
        if (progress) {
          const rankData = guild.ranks.find((r) => r.rank === progress.rank);
          if (rankData) {
            // Apply skill bonuses
            for (const [skillId, multiplier] of Object.entries(guild.skillBonuses)) {
              skillMultiplier[skillId] =
                (skillMultiplier[skillId] || 1) *
                multiplier *
                (1 + rankData.benefits.experienceMultiplier);
            }
            vendorDiscount = Math.max(vendorDiscount, rankData.benefits.vendorDiscount);
          }
        }
      }
    }

    // Secondary guild bonuses (reduced)
    for (const guildId of city.secondaryGuildIds) {
      const guild = await this.getGuild(guildId);
      if (guild) {
        const progress = this.getGuildProgress(city, guildId);
        if (progress) {
          const rankData = guild.ranks.find((r) => r.rank === progress.rank);
          if (rankData) {
            // Apply skill bonuses at reduced rate
            for (const [skillId, multiplier] of Object.entries(guild.skillBonuses)) {
              const reducedMultiplier =
                multiplier *
                (1 + rankData.benefits.experienceMultiplier) *
                this.SECONDARY_GUILD_BONUS_MULTIPLIER;
              skillMultiplier[skillId] = (skillMultiplier[skillId] || 1) * reducedMultiplier;
            }
            // Secondary guilds don't provide vendor discount
          }
        }
      }
    }

    return {
      skillMultiplier,
      vendorDiscount,
    };
  }

  /**
   * Get vendors for a guild
   */
  static async getGuildVendors(guildId: string): Promise<string[]> {
    const guild = await this.getGuild(guildId);
    return guild?.vendors || [];
  }

  /**
   * Add guild experience
   */
  static addGuildExperience(
    character: Character,
    guildId: string,
    experience: number
  ): Character {
    if (!character.city) {
      return character;
    }

    const city = character.city;
    const progress = this.getGuildProgress(city, guildId);
    if (!progress) {
      return character;
    }

    let newExperience = progress.experience + experience;
    let newRank = progress.rank;
    let experienceToNext = progress.experienceToNext;

    // Check for rank ups
    while (newExperience >= experienceToNext) {
      newExperience -= experienceToNext;
      newRank += 1;
      experienceToNext = Math.floor(100 * Math.pow(1.5, newRank - 1));
    }

    const updatedProgress: GuildProgress = {
      ...progress,
      experience: newExperience,
      rank: newRank,
      experienceToNext,
    };

    const newGuildProgress = {
      ...city.guildProgress,
      [guildId]: updatedProgress,
    };

    const newCity: CityData = {
      ...city,
      guildProgress: newGuildProgress,
    };

    return {
      ...character,
      city: newCity,
    };
  }

  /**
   * Preload guilds data
   */
  static async preloadData(): Promise<void> {
    await this.loadGuilds();
  }
}
