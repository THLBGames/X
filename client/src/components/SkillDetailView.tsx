import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { IdleSkillSystem } from '../systems/skills/IdleSkillSystem';
import { ResourceNodeManager } from '../systems/skills/ResourceNodeManager';
import { CraftingSystem } from '../systems/skills/CraftingSystem';
import { useIdleSkills } from '../hooks/useIdleSkills';
import type { Skill } from '@idle-rpg/shared';
import './SkillDetailView.css';

interface SkillDetailViewProps {
  skillId: string;
}

export default function SkillDetailView({ skillId }: SkillDetailViewProps) {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const { startGathering, stopTraining, activeSkills } = useIdleSkills();

  if (!character) {
    return null;
  }

  const dataLoader = getDataLoader();
  const skill = dataLoader.getSkill(skillId);

  if (!skill) {
    return <div>Skill not found</div>;
  }

  const skillLevel = IdleSkillSystem.getSkillLevel(character, skillId);
  const skillExperience = IdleSkillSystem.getSkillExperience(character, skillId);
  const skillData = character.idleSkills?.find((s) => s.skillId === skillId);

  const availableNodes = skill.resourceNodes
    ? ResourceNodeManager.getAllAvailableNodes(character, skillId)
    : [];
  const allNodes = skill.resourceNodes || [];
  const availableRecipes = skill.recipes
    ? CraftingSystem.getAvailableRecipes(character, skillId)
    : [];

  const isNodeActive = (nodeId: string) => {
    return activeSkills.some((s) => s.skillId === skillId && s.nodeId === nodeId);
  };

  const handleStartGathering = (nodeId: string) => {
    startGathering(skillId, nodeId);
  };

  const handleStopTraining = () => {
    stopTraining(skillId);
  };

  const formatBonusValue = (key: string, value: number): string => {
    // Format percentage multipliers
    if (key === 'goldGeneration' || key === 'itemFindRate' || key === 'experienceBonus') {
      return `+${(value * 100).toFixed(0)}%`;
    }
    // Format percentage stats
    if (key === 'criticalChance' || key === 'criticalDamage') {
      return `+${(value * 100).toFixed(1)}%`;
    }
    // Format regular numeric values
    return value > 0 ? `+${value}` : `${value}`;
  };

  const formatBonusName = (key: string): string => {
    const nameMap: Record<string, string> = {
      // Stats
      strength: 'Strength',
      dexterity: 'Dexterity',
      intelligence: 'Intelligence',
      vitality: 'Vitality',
      wisdom: 'Wisdom',
      luck: 'Luck',
      // Combat Stats
      health: 'Health',
      maxHealth: 'Max Health',
      mana: 'Mana',
      maxMana: 'Max Mana',
      attack: 'Attack',
      defense: 'Defense',
      magicAttack: 'Magic Attack',
      magicDefense: 'Magic Defense',
      speed: 'Speed',
      criticalChance: 'Critical Chance',
      criticalDamage: 'Critical Damage',
      // Special bonuses
      goldGeneration: 'Gold Generation',
      itemFindRate: 'Item Find Rate',
      experienceBonus: 'Experience Bonus',
    };
    return nameMap[key] || key;
  };

  const formatPassiveBonus = (bonus: any): string[] => {
    const formatted: string[] = [];
    
    // Handle stat bonuses
    if (bonus.statBonus) {
      Object.entries(bonus.statBonus).forEach(([key, value]) => {
        if (typeof value === 'number' && value !== 0) {
          formatted.push(`${formatBonusName(key)}: ${formatBonusValue(key, value)}`);
        }
      });
    }
    
    // Handle combat stat bonuses
    if (bonus.combatStatBonus) {
      Object.entries(bonus.combatStatBonus).forEach(([key, value]) => {
        if (typeof value === 'number' && value !== 0) {
          formatted.push(`${formatBonusName(key)}: ${formatBonusValue(key, value)}`);
        }
      });
    }
    
    // Handle special bonuses
    if (bonus.goldGeneration !== undefined) {
      formatted.push(`${formatBonusName('goldGeneration')}: ${formatBonusValue('goldGeneration', bonus.goldGeneration)}`);
    }
    if (bonus.itemFindRate !== undefined) {
      formatted.push(`${formatBonusName('itemFindRate')}: ${formatBonusValue('itemFindRate', bonus.itemFindRate)}`);
    }
    if (bonus.experienceBonus !== undefined) {
      formatted.push(`${formatBonusName('experienceBonus')}: ${formatBonusValue('experienceBonus', bonus.experienceBonus)}`);
    }
    
    return formatted;
  };

  return (
    <div className="skill-detail-view">
      <div className="skill-detail-header">
        <h3>{skill.name}</h3>
        <div className="skill-level-display">Level {skillLevel} / {skill.maxLevel}</div>
      </div>

      <div className="skill-description">{skill.description}</div>

      <div className="skill-experience">
        <div className="exp-info">
          Experience: {skillExperience} / {skillData?.experienceToNext || 100}
        </div>
        <div className="exp-bar">
          <div
            className="exp-bar-fill"
            style={{
              width: `${((skillExperience / (skillData?.experienceToNext || 100)) * 100)}%`,
            }}
          />
        </div>
      </div>

      {skill.category === 'gathering' && (
        <div className="resource-nodes-section">
          <h4>Resource Nodes</h4>
          {availableNodes.length > 0 ? (
            <div className="nodes-list">
              {availableNodes.map((node) => {
                const nodeIsActive = isNodeActive(node.nodeId);
                return (
                  <div key={node.nodeId} className="node-item">
                    <div className="node-header">
                      <span className="node-name">{node.name}</span>
                      <span className="node-level">Lvl {node.level}+</span>
                    </div>
                    <div className="node-info">
                      Success Rate: {(node.successRate * 100).toFixed(0)}% | Exp: {node.experienceGain}
                    </div>
                    <button
                      className={`node-action-button ${nodeIsActive ? 'active' : ''}`}
                      onClick={() => (nodeIsActive ? handleStopTraining() : handleStartGathering(node.nodeId))}
                    >
                      {nodeIsActive ? 'Stop' : 'Gather'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : allNodes.length > 0 ? (
            <div className="nodes-list">
              {allNodes.map((node) => {
                const isLocked = skillLevel < node.level;
                return (
                  <div key={node.nodeId} className={`node-item ${isLocked ? 'locked' : ''}`}>
                    <div className="node-header">
                      <span className="node-name">{node.name}</span>
                      <span className="node-level">Lvl {node.level}+</span>
                    </div>
                    <div className="node-info">
                      {isLocked ? (
                        <span className="locked-message">Requires {skill.name} Level {node.level}</span>
                      ) : (
                        <>
                          Success Rate: {(node.successRate * 100).toFixed(0)}% | Exp: {node.experienceGain}
                        </>
                      )}
                    </div>
                    <button
                      className="node-action-button"
                      disabled={isLocked}
                      title={isLocked ? `Requires ${skill.name} Level ${node.level}` : ''}
                    >
                      {isLocked ? 'Locked' : 'Gather'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-nodes-message">No resource nodes available for this skill.</div>
          )}
        </div>
      )}

      {skill.category === 'production' && availableRecipes.length > 0 && (
        <div className="recipes-section">
          <h4>Recipes</h4>
          <div className="recipes-list">
            {availableRecipes.map((recipe) => {
              const canCraft = CraftingSystem.canCraftRecipe(inventory, recipe);

              return (
                <div key={recipe.recipeId} className="recipe-item">
                  <div className="recipe-header">
                    <span className="recipe-name">{recipe.name}</span>
                    <span className="recipe-level">Lvl {recipe.level}+</span>
                  </div>
                  <div className="recipe-ingredients">
                    Ingredients:
                    {recipe.ingredients.map((ing, idx) => (
                      <span key={idx} className="ingredient">
                        {ing.quantity}x {ing.itemId}
                      </span>
                    ))}
                  </div>
                  <div className="recipe-result">
                    Result: {recipe.result.quantity}x {recipe.result.itemId} | Exp: {recipe.experienceGain}
                  </div>
                  <button
                    className="recipe-craft-button"
                    disabled={!canCraft.canCraft}
                    title={canCraft.canCraft ? '' : 'Missing ingredients'}
                  >
                    Craft
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {skill.passiveBonuses && skill.passiveBonuses.length > 0 && (
        <div className="passive-bonuses-section">
          <h4>Passive Bonuses</h4>
          <div className="bonuses-list">
            {skill.passiveBonuses.map((bonus, idx) => {
              const formattedBonuses = formatPassiveBonus(bonus.bonus);
              return (
                <div key={idx} className="bonus-item">
                  <div className="bonus-level">Level {bonus.level}</div>
                  <div className="bonus-effects">
                    {formattedBonuses.map((formatted, bonusIdx) => (
                      <span key={bonusIdx} className="bonus-effect">
                        {formatted}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

