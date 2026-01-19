import { useState, useEffect, useRef } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { IdleSkillSystem } from '../systems/skills/IdleSkillSystem';
import { ResourceNodeManager } from '../systems/skills/ResourceNodeManager';
import { CraftingSystem } from '../systems/skills/CraftingSystem';
import { InventoryManager } from '../systems/inventory';
import { SkillManager } from '../systems/skills/SkillManager';
import { useIdleSkills } from '../hooks/useIdleSkills';
import DivinationUnlockTree from './DivinationUnlockTree';
import './SkillDetailView.css';

interface SkillDetailViewProps {
  skillId: string;
}

export default function SkillDetailView({ skillId }: SkillDetailViewProps) {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const setCharacter = useGameState((state) => state.setCharacter);
  const setInventory = useGameState((state) => state.setInventory);
  const { startGathering, stopTraining, activeSkills } = useIdleSkills();

  if (!character) {
    return null;
  }

  const dataLoader = getDataLoader();
  const skill = dataLoader.getSkill(skillId);

  if (!skill) {
    return <div>Skill not found</div>;
  }

  // Check if it's an idle skill or combat skill
  const isIdleSkill = skill.category === 'gathering' || skill.category === 'production' || skill.category === 'hybrid';
  const isCombatSkill = (skill.type === 'active' || skill.type === 'passive') && !skill.category;

  // Get skill level based on type
  const skillLevel = isIdleSkill
    ? IdleSkillSystem.getSkillLevel(character, skillId)
    : character.learnedSkills.find((ls) => ls.skillId === skillId)?.level || 0;

  const skillData = isIdleSkill ? character.idleSkills?.find((s) => s.skillId === skillId) : null;
  
  // Calculate experience to next level for idle skills
  let currentLevelExp = 0;
  let expToNext = 100;
  if (isIdleSkill && skillData && skillLevel < skill.maxLevel) {
    const baseExp = 100; // Default base exp
    const currentTotalExp = skillData.experience;
    const currentLevel = skillData.level;
    const nextLevel = currentLevel + 1;
    
    // Calculate total exp needed for current level
    const totalExpForCurrent = IdleSkillSystem.calculateTotalExperienceForLevel(currentLevel, baseExp);
    // Calculate total exp needed for next level
    const totalExpForNext = IdleSkillSystem.calculateTotalExperienceForLevel(nextLevel, baseExp);
    
    // Experience within current level (current total - total for current level)
    currentLevelExp = Math.max(0, currentTotalExp - totalExpForCurrent);
    // Experience needed to reach next level (fixed amount for this level)
    // This is the difference between total exp for next level and total exp for current level
    expToNext = totalExpForNext - totalExpForCurrent;
  } else if (isIdleSkill && skillData && skillLevel >= skill.maxLevel) {
    // At max level, show experience in current level
    const baseExp = 100;
    const currentTotalExp = skillData.experience;
    const currentLevel = skillData.level;
    const totalExpForCurrent = IdleSkillSystem.calculateTotalExperienceForLevel(currentLevel, baseExp);
    currentLevelExp = Math.max(0, currentTotalExp - totalExpForCurrent);
    expToNext = 0; // No next level
  }

  // Idle skill specific data
  const availableNodes = isIdleSkill && skill.resourceNodes
    ? ResourceNodeManager.getAllAvailableNodes(character, skillId, inventory)
    : [];
  const allNodes = isIdleSkill ? (skill.resourceNodes || []) : [];
  const availableRecipes = isIdleSkill && skill.recipes
    ? CraftingSystem.getAvailableRecipes(character, skillId)
    : [];

  // Combat skill specific data
  const canLearnResult = isCombatSkill && skillLevel < skill.maxLevel ? SkillManager.canLearnSkill(character, skillId, skillLevel + 1) : null;
  const canLearn = canLearnResult?.canLearn ?? false;
  const learnReason = canLearnResult?.reason;

  const getActiveTraining = () => {
    return activeSkills.find((s) => s.skillId === skillId && s.nodeId);
  };

  const isNodeActive = (nodeId: string) => {
    return activeSkills.some((s) => s.skillId === skillId && s.nodeId === nodeId);
  };

  const activeTraining = getActiveTraining();

  // Countdown timer state for active training
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  // Use a ref to always get the latest activeSkills value in the interval
  const activeSkillsRef = useRef(activeSkills);
  useEffect(() => {
    activeSkillsRef.current = activeSkills;
  }, [activeSkills]);

  // Update countdown timer for active training
  useEffect(() => {
    if (!activeTraining || !activeTraining.lastActionTime || !activeTraining.timeRequired) {
      setTimeRemaining(null);
      return;
    }

    // Store the nodeId to track which node we're timing
    const trackingNodeId = activeTraining.nodeId;

    const updateTimer = () => {
      // Always get the current activeSkills from the ref - this ensures we get the latest value
      const currentTraining = activeSkillsRef.current.find((s) => s.skillId === skillId && s.nodeId === trackingNodeId);
      if (!currentTraining || !currentTraining.lastActionTime || !currentTraining.timeRequired) {
        setTimeRemaining(null);
        return;
      }

      const now = Date.now();
      const elapsed = now - currentTraining.lastActionTime;
      const remaining = Math.max(0, currentTraining.timeRequired - elapsed);
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 50); // Update more frequently for smoother animation

    return () => clearInterval(interval);
  }, [activeTraining?.lastActionTime, activeTraining?.nodeId, skillId]);

  const handleStartGathering = (nodeId: string) => {
    startGathering(skillId, nodeId);
  };

  const handleStopTraining = () => {
    stopTraining(skillId);
  };

  const handleLearnSkill = async () => {
    if (!isCombatSkill) return;
    const result = await SkillManager.learnSkill(character, skillId, 1);
    if (result.success && result.character) {
      setCharacter(result.character);
    } else {
      alert(result.reason || 'Cannot learn skill');
    }
  };

  const handleUpgradeSkill = async () => {
    if (!isCombatSkill || skillLevel >= skill.maxLevel) return;
    const result = await SkillManager.learnSkill(character, skillId, skillLevel + 1);
    if (result.success && result.character) {
      setCharacter(result.character);
    } else {
      alert(result.reason || 'Cannot upgrade skill');
    }
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
        if (typeof value === 'number') {
          formatted.push(`${formatBonusName(key)}: ${formatBonusValue(key, value)}`);
        }
      });
    }

    // Handle combat stat bonuses
    if (bonus.combatStatBonus) {
      Object.entries(bonus.combatStatBonus).forEach(([key, value]) => {
        if (typeof value === 'number') {
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

  const getSkillTypeColor = () => {
    if (skill.type === 'active') return '#4a9eff';
    if (skill.type === 'passive') return '#4ecdc4';
    if (skill.category === 'gathering') return '#90ee90';
    if (skill.category === 'production') return '#ffa500';
    return '#888';
  };

  return (
    <div className="skill-detail-view">
      <div className="skill-detail-header">
        <div className="skill-detail-title-section">
          <div className="skill-detail-icon" style={{ backgroundColor: getSkillTypeColor() }}>
            {skill.name.charAt(0)}
          </div>
          <div className="skill-detail-title">
            <h2>{skill.name}</h2>
            <div className="skill-detail-meta">
              <span className="skill-type-badge">{skill.type === 'active' ? 'Active' : skill.type === 'passive' ? 'Passive' : skill.category || 'Skill'}</span>
              {skillLevel > 0 && <span className="skill-level-badge">Level {skillLevel} / {skill.maxLevel}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="skill-detail-description">
        <p>{skill.description}</p>
      </div>

      {/* Idle Skill Specific Content */}
      {isIdleSkill && (
        <>
          <div className="skill-detail-section">
            <h3>Experience</h3>
            <div className="skill-exp-info">
              <div className="skill-exp-text">
                Level {skillLevel} {skillLevel < skill.maxLevel ? `- ${currentLevelExp} / ${expToNext} XP` : `(Max Level)`}
              </div>
              {skillLevel > 0 && skillLevel < skill.maxLevel && expToNext > 0 && (
                <div className="skill-exp-bar">
                  <div
                    className="skill-exp-bar-fill"
                    style={{ width: `${Math.min((currentLevelExp / expToNext) * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {availableNodes.length > 0 && (
            <div className="skill-detail-section">
              <h3>Available Resource Nodes</h3>
              <div className="resource-nodes-list">
                {availableNodes.map((node) => {
                  const isActive = isNodeActive(node.nodeId);
                  const showProgress = isActive && activeTraining && timeRemaining !== null;
                  const progressPercent = showProgress && activeTraining.timeRequired
                    ? Math.max(0, Math.min(100, ((activeTraining.timeRequired - timeRemaining) / activeTraining.timeRequired) * 100))
                    : 0;

                  return (
                    <div key={node.nodeId} className={`resource-node-item ${isActive ? 'active' : ''}`}>
                      <div className="resource-node-header">
                        <span className="resource-node-name">{node.name}</span>
                        <span className="resource-node-level">Level {node.level}+</span>
                        {isActive && <span className="training-status-badge">Training...</span>}
                      </div>
                      {isActive && showProgress && (
                        <div className="training-progress-indicator">
                          <div className="training-progress-bar">
                            <div 
                              className="training-progress-fill" 
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <div className="training-timer">
                            Next action in: {((timeRemaining / 1000) || 0).toFixed(1)}s
                          </div>
                        </div>
                      )}
                      <div className="resource-node-info">
                        <div className="resource-node-stats">
                          <span>Success Rate: {(node.successRate * 100).toFixed(0)}%</span>
                          <span>XP per action: {node.experienceGain}</span>
                          {node.timeRequired && <span>Time: {(node.timeRequired / 1000).toFixed(1)}s</span>}
                        </div>
                        {node.resources && node.resources.length > 0 && (
                          <div className="resource-node-drops">
                            <div className="resource-drops-label">Possible Resources:</div>
                            <div className="resource-drops-list">
                              {node.resources.map((drop, idx) => {
                                const item = dataLoader.getItem(drop.itemId);
                                const itemName = item ? item.name : drop.itemId;
                                let quantityText = '';
                                if (drop.min !== undefined && drop.max !== undefined) {
                                  quantityText = `${drop.min}-${drop.max}`;
                                } else if (drop.quantity !== undefined) {
                                  quantityText = `${drop.quantity}`;
                                } else {
                                  quantityText = '1';
                                }
                                return (
                                  <div key={idx} className="resource-drop-item">
                                    <span className="drop-item-name">{itemName}</span>
                                    <span className="drop-quantity">x{quantityText}</span>
                                    <span className="drop-chance">({(drop.chance * 100).toFixed(0)}%)</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      {isActive ? (
                        <button className="resource-node-button stop" onClick={handleStopTraining}>
                          Stop Training
                        </button>
                      ) : (
                        <button 
                          className="resource-node-button start" 
                          onClick={() => handleStartGathering(node.nodeId)}
                          disabled={availableNodes.some(n => isNodeActive(n.nodeId))}
                        >
                          Start Training
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {allNodes.length > availableNodes.length && (
            <div className="skill-detail-section">
              <h3>Locked Resource Nodes</h3>
              <div className="resource-nodes-list">
                {allNodes
                  .filter((node) => !availableNodes.some((an) => an.nodeId === node.nodeId))
                  .map((node) => {
                    const skillLevelCheck = skillLevel >= node.level;
                    const unlockRequirementsMet = node.unlockRequirements
                      ? node.unlockRequirements.every((req) => {
                          const quantity = InventoryManager.getItemQuantity(inventory, req.itemId);
                          return quantity >= req.quantity;
                        })
                      : true;
                    const isLockedByLevel = !skillLevelCheck;
                    const isLockedByItems = node.unlockRequirements && !unlockRequirementsMet;
                    
                    return (
                      <div key={node.nodeId} className="resource-node-item locked">
                        <div className="resource-node-header">
                          <span className="resource-node-name">{node.name}</span>
                          <span className="resource-node-level">Level {node.level}+</span>
                        </div>
                        <div className="resource-node-info">
                          {isLockedByLevel && (
                            <div className="locked-message">Requires Skill Level {node.level}</div>
                          )}
                          {isLockedByItems && (
                            <div className="locked-message">
                              <div>Secret Location - Requires:</div>
                              <div className="unlock-requirements">
                                {node.unlockRequirements!.map((req, idx) => {
                                  const item = dataLoader.getItem(req.itemId);
                                  const itemName = item ? item.name : req.itemId;
                                  const have = InventoryManager.getItemQuantity(inventory, req.itemId);
                                  const hasEnough = have >= req.quantity;
                                  return (
                                    <div key={idx} className={`unlock-requirement-item ${hasEnough ? 'met' : 'missing'}`}>
                                      {req.quantity}x {itemName} {!hasEnough && `(have ${have})`}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {node.resources && node.resources.length > 0 && (
                            <div className="resource-node-drops">
                              <div className="resource-drops-label">Possible Resources:</div>
                              <div className="resource-drops-list">
                                {node.resources.map((drop, idx) => {
                                  const item = dataLoader.getItem(drop.itemId);
                                  const itemName = item ? item.name : drop.itemId;
                                  let quantityText = '';
                                  if (drop.min !== undefined && drop.max !== undefined) {
                                    quantityText = `${drop.min}-${drop.max}`;
                                  } else if (drop.quantity !== undefined) {
                                    quantityText = `${drop.quantity}`;
                                  } else {
                                    quantityText = '1';
                                  }
                                  return (
                                    <div key={idx} className="resource-drop-item">
                                      <span className="drop-item-name">{itemName}</span>
                                      <span className="drop-quantity">x{quantityText}</span>
                                      <span className="drop-chance">({(drop.chance * 100).toFixed(0)}%)</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {availableRecipes.length > 0 && (
            <div className="skill-detail-section">
              <h3>Available Recipes</h3>
              <div className="recipes-list">
                {availableRecipes.map((recipe) => {
                  const canCraftResult = CraftingSystem.canCraftRecipe(inventory, recipe);
                  const canCraft = canCraftResult.canCraft && skillLevel >= recipe.level;

                  return (
                    <div key={recipe.recipeId} className="recipe-item">
                      <div className="recipe-header">
                        <span className="recipe-name">{recipe.name}</span>
                        <span className="recipe-level">Level {recipe.level}+</span>
                      </div>
                      <div className="recipe-ingredients">
                        <span>Ingredients:</span>
                        <div className="ingredients-list">
                          {recipe.ingredients.map((ing, idx) => {
                            const haveQty = InventoryManager.getItemQuantity(inventory, ing.itemId);
                            const hasEnough = haveQty >= ing.quantity;
                            const ingredientItem = dataLoader.getItem(ing.itemId);
                            const ingredientName = ingredientItem?.name || ing.itemId;
                            return (
                              <span
                                key={idx}
                                className={`ingredient-item ${hasEnough ? '' : 'missing'}`}
                              >
                                {ing.quantity}x {ingredientName} {!hasEnough && `(have ${haveQty})`}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="recipe-results">
                        <span>Result:</span>
                        <div className="results-list">
                          <span className="result-item">
                            {recipe.result.quantity}x {dataLoader.getItem(recipe.result.itemId)?.name || recipe.result.itemId}
                          </span>
                        </div>
                      </div>
                      <button
                        className="recipe-craft-button"
                        onClick={() => {
                          if (!canCraft) {
                            if (skillLevel < recipe.level) {
                              alert(`Requires skill level ${recipe.level}`);
                            } else {
                              alert(`Missing ingredients: ${canCraftResult.missingIngredients.map(m => {
                                const item = dataLoader.getItem(m.itemId);
                                const itemName = item?.name || m.itemId;
                                return `${itemName} (need ${m.required}, have ${m.have})`;
                              }).join(', ')}`);
                            }
                            return;
                          }

                          (async () => {
                            const result = await CraftingSystem.craftItem(character, inventory, skillId, recipe);
                            
                            if (result.success) {
                              // Update inventory with new item and removed ingredients
                              let newInventory = inventory;
                              for (const ingredient of recipe.ingredients) {
                                newInventory = InventoryManager.removeItem(newInventory, ingredient.itemId, ingredient.quantity);
                              }
                              if (result.itemId) {
                                newInventory = InventoryManager.addItem(newInventory, result.itemId, result.quantity || 1);
                              }
                              setInventory(newInventory);

                              // Add experience
                              const expResult = IdleSkillSystem.addSkillExperience(character, skillId, result.experience);
                              setCharacter(expResult.character);

                              alert(`Successfully crafted ${recipe.name}!`);
                            } else {
                              // Failed craft - still consume ingredients with 50% chance
                              let newInventory = inventory;
                              for (const ingredient of recipe.ingredients) {
                                if (Math.random() < 0.5) {
                                  newInventory = InventoryManager.removeItem(newInventory, ingredient.itemId, ingredient.quantity);
                                }
                              }
                              setInventory(newInventory);

                              // Add reduced experience
                              if (result.experience > 0) {
                                const expResult = IdleSkillSystem.addSkillExperience(character, skillId, result.experience);
                                setCharacter(expResult.character);
                              }

                              alert(result.reason || 'Crafting failed');
                            }
                          })();
                        }}
                        disabled={!canCraft}
                        title={canCraft ? `Craft ${recipe.name}` : skillLevel < recipe.level ? `Requires skill level ${recipe.level}` : `Missing ingredients`}
                      >
                        Craft
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Combat Skill Specific Content */}
      {isCombatSkill && (
        <>
          <div className="skill-detail-section">
            <h3>Skill Information</h3>
            <div className="skill-info-grid">
              {skill.manaCost !== undefined && (
                <div className="skill-info-item">
                  <span className="skill-info-label">Mana Cost:</span>
                  <span className="skill-info-value">{skill.manaCost}</span>
                </div>
              )}
              {skill.cooldown !== undefined && (
                <div className="skill-info-item">
                  <span className="skill-info-label">Cooldown:</span>
                  <span className="skill-info-value">{skill.cooldown}s</span>
                </div>
              )}
              {skill.target && (
                <div className="skill-info-item">
                  <span className="skill-info-label">Target:</span>
                  <span className="skill-info-value">{skill.target}</span>
                </div>
              )}
              <div className="skill-info-item">
                <span className="skill-info-label">Max Level:</span>
                <span className="skill-info-value">{skill.maxLevel}</span>
              </div>
            </div>
          </div>

          {skill.effect && (
            <div className="skill-detail-section">
              <h3>Effect</h3>
              <div className="skill-effect-info">
                {skill.effect.damage && (
                  <div className="effect-item">
                    <span className="effect-label">Damage:</span>
                    <span className="effect-value">
                      {skill.effect.damage.base}
                      {skill.effect.damage.scaling && ` + ${skill.effect.damage.scaling.multiplier * 100}% ${skill.effect.damage.scaling.stat}`}
                    </span>
                  </div>
                )}
                {skill.effect.heal && (
                  <div className="effect-item">
                    <span className="effect-label">Heal:</span>
                    <span className="effect-value">
                      {skill.effect.heal.base}
                      {skill.effect.heal.scaling && ` + ${skill.effect.heal.scaling.multiplier * 100}% ${skill.effect.heal.scaling.stat}`}
                    </span>
                  </div>
                )}
                {skill.effect.buffId && (
                  <div className="effect-item">
                    <span className="effect-label">Buff:</span>
                    <span className="effect-value">{skill.effect.buffId}</span>
                  </div>
                )}
                {skill.effect.debuffId && (
                  <div className="effect-item">
                    <span className="effect-label">Debuff:</span>
                    <span className="effect-value">{skill.effect.debuffId}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {skill.passiveBonus && (
            <div className="skill-detail-section">
              <h3>Passive Bonus</h3>
              <div className="skill-bonus-list">
                {formatPassiveBonus(skill.passiveBonus).map((bonus, idx) => (
                  <div key={idx} className="bonus-item">{bonus}</div>
                ))}
              </div>
            </div>
          )}

          {skill.prerequisites && skill.prerequisites.length > 0 && (
            <div className="skill-detail-section">
              <h3>Prerequisites</h3>
              <div className="prerequisites-list">
                {skill.prerequisites.map((prereqId) => {
                  const prereqSkill = dataLoader.getSkill(prereqId);
                  const prereqLevel = character.learnedSkills.find((ls) => ls.skillId === prereqId)?.level || 0;
                  return (
                    <div key={prereqId} className="prerequisite-item">
                      {prereqSkill ? prereqSkill.name : prereqId} {prereqLevel > 0 ? `(Level ${prereqLevel})` : '(Not Learned)'}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(skill.requirements?.level || skill.unlockLevel) && (
            <div className="skill-detail-section">
              <h3>Requirements</h3>
              <div className="requirements-list">
                {(skill.requirements?.level || skill.unlockLevel) && (
                  <div className="requirement-item">
                    Level: {skill.unlockLevel || skill.requirements?.level || 'N/A'}
                  </div>
                )}
                {skill.requirements?.class && skill.requirements.class.length > 0 && (
                  <div className="requirement-item">
                    Classes: {skill.requirements.class.join(', ')}
                  </div>
                )}
                {(skill.unlockCost || 1) > 0 && (
                  <div className="requirement-item">
                    Cost: {skill.unlockCost || 1} skill point(s)
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="skill-detail-section">
            <h3>Actions</h3>
            <div className="skill-actions">
              {skillLevel === 0 ? (
                <button
                  className="skill-action-button learn"
                  onClick={handleLearnSkill}
                  disabled={!canLearn}
                  title={learnReason || 'Learn Skill'}
                >
                  Learn Skill ({skill.unlockCost || 1} skill point{skill.unlockCost !== 1 ? 's' : ''})
                </button>
              ) : skillLevel < skill.maxLevel ? (
                <button
                  className="skill-action-button upgrade"
                  onClick={handleUpgradeSkill}
                  disabled={!canLearn}
                  title={learnReason || 'Upgrade Skill'}
                >
                  Upgrade to Level {skillLevel + 1} ({skill.unlockCost || 1} skill point{skill.unlockCost !== 1 ? 's' : ''})
                </button>
              ) : (
                <div className="skill-max-level">Skill is at maximum level ({skill.maxLevel})</div>
              )}
              {!canLearn && learnReason && skillLevel === 0 && (
                <div className="skill-learn-reason">{learnReason}</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Passive Bonuses (for idle skills with level-based bonuses) */}
      {isIdleSkill && skill.passiveBonuses && skill.passiveBonuses.length > 0 && (
        <div className="skill-detail-section">
          <h3>Level-Based Bonuses</h3>
          <div className="passive-bonuses-list">
            {skill.passiveBonuses
              .filter((pb) => skillLevel >= pb.level)
              .map((pb, idx) => (
                <div key={idx} className="passive-bonus-item">
                  <div className="passive-bonus-level">Level {pb.level}+</div>
                  <div className="passive-bonus-effects">
                    {formatPassiveBonus(pb.bonus).map((bonus, bonusIdx) => (
                      <div key={bonusIdx} className="bonus-item">{bonus}</div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {isIdleSkill && skillId === 'divination' && (
        <div className="skill-detail-section">
          <DivinationUnlockTree skillId={skillId} />
        </div>
      )}
    </div>
  );
}
