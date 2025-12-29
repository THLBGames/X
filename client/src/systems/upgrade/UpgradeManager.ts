import type {
  Character,
  Inventory,
  SkillUpgrade,
  ActiveUpgrade,
  ShopTransactionResult,
  UpgradeTier,
  SkillCategory,
} from '@idle-rpg/shared';
import { getDataLoader } from '@/data';
import { InventoryManager } from '../inventory';
import { IdleSkillSystem } from '../skills/IdleSkillSystem';

export interface UpgradeBonuses {
  experienceMultiplier: number;
  speedMultiplier: number;
  yieldMultiplier: number;
  successRateBonus: number;
  unlocksNodes: string[];
  unlocksRecipes: string[];
}

export class UpgradeManager {
  /**
   * Get tier number (1-5) from tier string
   */
  private static getTierNumber(tier: UpgradeTier): number {
    const tierMap: Record<UpgradeTier, number> = {
      I: 1,
      II: 2,
      III: 3,
      IV: 4,
      V: 5,
    };
    return tierMap[tier];
  }

  /**
   * Get tier string from tier number
   */
  private static getTierString(tierNum: number): UpgradeTier {
    const tiers: UpgradeTier[] = ['I', 'II', 'III', 'IV', 'V'];
    return tiers[tierNum - 1];
  }

  /**
   * Calculate upgrade price (scales by tier: basePrice * (tierNumber ^ 1.5))
   */
  static getUpgradePrice(upgrade: SkillUpgrade, currentTier?: UpgradeTier): number {
    if (!upgrade.tier) return upgrade.price;

    const tierNum = this.getTierNumber(upgrade.tier);
    const basePrice = upgrade.price;
    
    // If upgrading from a previous tier, calculate the difference
    if (currentTier) {
      const currentTierNum = this.getTierNumber(currentTier);
      const currentPrice = Math.floor(basePrice * Math.pow(currentTierNum, 1.5));
      const newPrice = Math.floor(basePrice * Math.pow(tierNum, 1.5));
      return newPrice - currentPrice;
    }

    return Math.floor(basePrice * Math.pow(tierNum, 1.5));
  }

  /**
   * Check if upgrade can be purchased/upgraded
   */
  static canUpgrade(character: Character, upgrade: SkillUpgrade): {
    canUpgrade: boolean;
    reason?: string;
  } {
    const dataLoader = getDataLoader();

    // Check skill level requirement
    if (upgrade.requirements?.skillLevel) {
      if (upgrade.scope === 'skill' && upgrade.skillId) {
        const skillLevel = IdleSkillSystem.getSkillLevel(character, upgrade.skillId);
        if (skillLevel < upgrade.requirements.skillLevel) {
          return {
            canUpgrade: false,
            reason: `Requires ${upgrade.skillId} level ${upgrade.requirements.skillLevel}`,
          };
        }
      }
    }

    // Check previous tier requirement for permanent upgrades
    if (upgrade.type === 'permanent' && upgrade.requirements?.previousTierId) {
      const hasPreviousTier = (character.activeUpgrades || []).some(
        (au) => au.upgradeId === upgrade.requirements!.previousTierId
      );
      if (!hasPreviousTier) {
        return {
          canUpgrade: false,
          reason: `Requires previous tier upgrade`,
        };
      }
    }

    return { canUpgrade: true };
  }

  /**
   * Purchase or upgrade a permanent upgrade
   */
  static purchaseUpgrade(
    inventory: Inventory,
    character: Character,
    upgradeId: string
  ): ShopTransactionResult {
    const dataLoader = getDataLoader();
    const upgrade = dataLoader.getUpgrade(upgradeId);

    if (!upgrade) {
      return {
        success: false,
        message: 'Upgrade not found',
      };
    }

    if (upgrade.type !== 'permanent') {
      return {
        success: false,
        message: 'This is not a permanent upgrade. Use activateConsumable instead.',
      };
    }

    // Check if can upgrade
    const canUpgrade = this.canUpgrade(character, upgrade);
    if (!canUpgrade.canUpgrade) {
      return {
        success: false,
        message: canUpgrade.reason || 'Cannot purchase upgrade',
      };
    }

    // Check if already has this upgrade
    const existingUpgrade = (character.activeUpgrades || []).find(
      (au) => au.upgradeId === upgradeId
    );

    if (existingUpgrade) {
      // Check if already at max tier
      if (existingUpgrade.tier === 'V') {
        return {
          success: false,
          message: 'Upgrade already at maximum tier',
        };
      }

      // Upgrading to next tier
      const currentTierNum = this.getTierNumber(existingUpgrade.tier);
      if (currentTierNum >= 5) {
        return {
          success: false,
          message: 'Upgrade already at maximum tier',
        };
      }
      const nextTierNum = currentTierNum + 1;
      const nextTier = this.getTierString(nextTierNum);

      // Get the next tier upgrade - construct ID based on upgrade structure
      const baseId = upgradeId.replace(/_(I|II|III|IV|V)$/, '');
      const nextTierUpgradeId = `${baseId}_${nextTier}`;
      const nextTierUpgrade = dataLoader.getUpgrade(nextTierUpgradeId);

      if (!nextTierUpgrade) {
        return {
          success: false,
          message: 'Next tier upgrade not found',
        };
      }

      const price = this.getUpgradePrice(nextTierUpgrade, existingUpgrade.tier);
      const gold = InventoryManager.getGold(inventory);

      if (gold < price) {
        return {
          success: false,
          message: `Not enough gold. Need ${price}, have ${gold}`,
        };
      }

      // Deduct gold and upgrade
      const newInventory = InventoryManager.removeItem(inventory, 'gold', price);
      const newGold = InventoryManager.getGold(newInventory);

      return {
        success: true,
        message: `Upgraded to tier ${nextTier}`,
        newInventory,
        newGold,
        upgradeTier: nextTier,
      };
    } else {
      // Purchasing tier I
      const price = this.getUpgradePrice(upgrade);
      const gold = InventoryManager.getGold(inventory);

      if (gold < price) {
        return {
          success: false,
          message: `Not enough gold. Need ${price}, have ${gold}`,
        };
      }

      // Deduct gold
      const newInventory = InventoryManager.removeItem(inventory, 'gold', price);
      const newGold = InventoryManager.getGold(newInventory);

      return {
        success: true,
        message: `Purchased ${upgrade.name}`,
        newInventory,
        newGold,
        upgradeTier: upgrade.tier,
      };
    }
  }

  /**
   * Activate a consumable upgrade
   */
  static activateConsumable(
    inventory: Inventory,
    character: Character,
    upgradeId: string
  ): ShopTransactionResult {
    const dataLoader = getDataLoader();
    const upgrade = dataLoader.getUpgrade(upgradeId);

    if (!upgrade) {
      return {
        success: false,
        message: 'Upgrade not found',
      };
    }

    if (upgrade.type !== 'consumable') {
      return {
        success: false,
        message: 'This is not a consumable upgrade. Use purchaseUpgrade instead.',
      };
    }

    if (!upgrade.actionDuration) {
      return {
        success: false,
        message: 'Invalid consumable upgrade (no action duration)',
      };
    }

    // Check if can afford
    const gold = InventoryManager.getGold(inventory);
    if (gold < upgrade.price) {
      return {
        success: false,
        message: `Not enough gold. Need ${upgrade.price}, have ${gold}`,
      };
    }

    // Deduct gold
    const newInventory = InventoryManager.removeItem(inventory, 'gold', upgrade.price);
    const newGold = InventoryManager.getGold(newInventory);

    return {
      success: true,
      message: `Activated ${upgrade.name}`,
      newInventory,
      newGold,
      actionDuration: upgrade.actionDuration,
    };
  }

  /**
   * Get active upgrades for a skill
   */
  static getActiveUpgrades(character: Character, skillId?: string): ActiveUpgrade[] {
    const dataLoader = getDataLoader();
    const allActive: ActiveUpgrade[] = [];

    // Get permanent upgrades
    if (character.activeUpgrades) {
      for (const activeUpgrade of character.activeUpgrades) {
        const upgrade = dataLoader.getUpgrade(activeUpgrade.upgradeId);
        if (!upgrade) continue;

        // Check if applies to this skill
        if (skillId) {
          if (upgrade.scope === 'skill' && upgrade.skillId === skillId) {
            allActive.push(activeUpgrade);
          } else if (upgrade.scope === 'category') {
            const skill = dataLoader.getSkill(skillId);
            if (skill && skill.category === upgrade.category) {
              allActive.push(activeUpgrade);
            }
          }
        } else {
          allActive.push(activeUpgrade);
        }
      }
    }

    // Get consumable upgrades
    if (character.consumableUpgrades) {
      for (const consumableUpgrade of character.consumableUpgrades) {
        const upgrade = dataLoader.getUpgrade(consumableUpgrade.upgradeId);
        if (!upgrade) continue;

        // Check if applies to this skill
        if (skillId) {
          if (upgrade.scope === 'skill' && upgrade.skillId === skillId) {
            allActive.push(consumableUpgrade);
          } else if (upgrade.scope === 'category') {
            const skill = dataLoader.getSkill(skillId);
            if (skill && skill.category === upgrade.category) {
              allActive.push(consumableUpgrade);
            }
          }
        } else {
          allActive.push(consumableUpgrade);
        }
      }
    }

    return allActive;
  }

  /**
   * Calculate all active upgrade bonuses for a skill
   */
  static getUpgradeBonuses(character: Character, skillId: string): UpgradeBonuses {
    const dataLoader = getDataLoader();
    const activeUpgrades = this.getActiveUpgrades(character, skillId);

    let experienceMultiplier = 1;
    let speedMultiplier = 1;
    let yieldMultiplier = 1;
    let successRateBonus = 0;
    const unlocksNodes: string[] = [];
    const unlocksRecipes: string[] = [];

    for (const activeUpgrade of activeUpgrades) {
      const upgrade = dataLoader.getUpgrade(activeUpgrade.upgradeId);
      if (!upgrade || !upgrade.bonuses) continue;

      // Apply bonuses multiplicatively for multipliers
      if (upgrade.bonuses.experienceMultiplier) {
        experienceMultiplier *= upgrade.bonuses.experienceMultiplier;
      }
      if (upgrade.bonuses.speedMultiplier) {
        speedMultiplier *= upgrade.bonuses.speedMultiplier;
      }
      if (upgrade.bonuses.yieldMultiplier) {
        yieldMultiplier *= upgrade.bonuses.yieldMultiplier;
      }

      // Add success rate bonus additively
      if (upgrade.bonuses.successRateBonus) {
        successRateBonus += upgrade.bonuses.successRateBonus;
      }

      // Collect unlocks
      if (upgrade.bonuses.unlocksNodes) {
        unlocksNodes.push(...upgrade.bonuses.unlocksNodes);
      }
      if (upgrade.bonuses.unlocksRecipes) {
        unlocksRecipes.push(...upgrade.bonuses.unlocksRecipes);
      }
    }

    return {
      experienceMultiplier,
      speedMultiplier,
      yieldMultiplier,
      successRateBonus: Math.min(successRateBonus, 1), // Cap at 100%
      unlocksNodes: [...new Set(unlocksNodes)], // Remove duplicates
      unlocksRecipes: [...new Set(unlocksRecipes)], // Remove duplicates
    };
  }

  /**
   * Consume an action for consumable upgrades
   */
  static consumeAction(character: Character, skillId: string): Character {
    const dataLoader = getDataLoader();
    const consumableUpgrades = character.consumableUpgrades || [];
    const updatedConsumables: ActiveUpgrade[] = [];

    for (const consumableUpgrade of consumableUpgrades) {
      const upgrade = dataLoader.getUpgrade(consumableUpgrade.upgradeId);
      if (!upgrade) continue;

      // Check if applies to this skill
      let applies = false;
      if (upgrade.scope === 'skill' && upgrade.skillId === skillId) {
        applies = true;
      } else if (upgrade.scope === 'category') {
        const skill = dataLoader.getSkill(skillId);
        if (skill && skill.category === upgrade.category) {
          applies = true;
        }
      }

      if (applies && consumableUpgrade.remainingActions !== undefined) {
        const remaining = consumableUpgrade.remainingActions - 1;
        if (remaining > 0) {
          updatedConsumables.push({
            ...consumableUpgrade,
            remainingActions: remaining,
          });
        }
        // If remaining is 0, don't add it (expired)
      } else {
        // Doesn't apply to this skill, keep as is
        updatedConsumables.push(consumableUpgrade);
      }
    }

    return {
      ...character,
      consumableUpgrades: updatedConsumables,
    };
  }
}

