import { useEffect, useState } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { AutoSkillManager } from '../systems/combat/AutoSkillManager';
import type { AutoSkillSetting } from '@idle-rpg/shared';
import { AutoCondition, SKILL_CONDITION_DESCRIPTIONS, MAX_SKILL_BAR_SLOTS } from '@idle-rpg/shared';
import { UI_TOOLTIPS } from '../constants/ui';
import SkillButton from './SkillButton';
import SkillTreeModal from './SkillTreeModal';
import AutoSkillConfigModal from './AutoSkillConfigModal';
import TooltipWrapper from './TooltipWrapper';
import './CombatSkillBar.css';

interface CombatSkillBarProps {
  onSkillUse: (skillId: string) => void;
}

export default function CombatSkillBar({ onSkillUse }: CombatSkillBarProps) {
  const character = useGameState((state) => state.character);
  const currentCombatState = useGameState((state) => state.currentCombatState);
  const isCombatActive = useGameState((state) => state.isCombatActive);
  const updateAutoSkillSetting = useGameState((state) => state.updateAutoSkillSetting);
  const isPlayerTurn = currentCombatState?.currentActor === 'player';
  const playerMana = currentCombatState?.playerMana || 0;
  const dataLoader = getDataLoader();
  const [showSkillTree, setShowSkillTree] = useState(false);
  const [configSkillId, setConfigSkillId] = useState<string | null>(null);

  // Update cooldown display in real-time
  const [, setCooldownUpdate] = useState(0);
  useEffect(() => {
    if (!isCombatActive || !currentCombatState?.skillCooldowns) {
      return;
    }

    const interval = setInterval(() => {
      setCooldownUpdate((prev) => prev + 1);
    }, 100); // Update every 100ms for smooth cooldown display

    return () => clearInterval(interval);
  }, [isCombatActive, currentCombatState?.skillCooldowns]);

  // Handle keyboard shortcuts (1-8)
  useEffect(() => {
    if (!isPlayerTurn || !character?.skillBar) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= '1' && key <= '8') {
        const index = parseInt(key) - 1;
        if (character.skillBar && character.skillBar[index]) {
          const skillId = character.skillBar[index];
          const skill = dataLoader.getSkill(skillId);
          if (skill && playerMana >= (skill.manaCost || 0)) {
            onSkillUse(skillId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlayerTurn, character?.skillBar, playerMana, onSkillUse, dataLoader]);

  if (!character || !character.skillBar || character.skillBar.length === 0) {
    return (
      <>
        <div className="combat-skill-bar empty">
          <div className="skill-bar-message">
            <div className="skill-bar-message-text">No skills assigned to skill bar.</div>
            <button className="skill-bar-open-tree-button" onClick={() => setShowSkillTree(true)}>
              Open Skill Tree
            </button>
          </div>
        </div>
        <SkillTreeModal isOpen={showSkillTree} onClose={() => setShowSkillTree(false)} />
      </>
    );
  }

  // Ensure we have exactly MAX_SKILL_BAR_SLOTS slots (pad with nulls)
  const skillSlots: (string | null)[] = [...character.skillBar];
  while (skillSlots.length < MAX_SKILL_BAR_SLOTS) {
    skillSlots.push(null);
  }
  skillSlots.splice(MAX_SKILL_BAR_SLOTS); // Limit to MAX_SKILL_BAR_SLOTS

  return (
    <div className="combat-skill-bar">
      <div className="skill-bar-slots">
        {skillSlots.map((skillId, index) => {
          if (!skillId) {
            return (
              <div key={index} className="skill-slot empty">
                <div className="skill-slot-number">{index + 1}</div>
              </div>
            );
          }

          const skill = dataLoader.getSkill(skillId);
          if (!skill) {
            return (
              <div key={index} className="skill-slot empty">
                <div className="skill-slot-number">{index + 1}</div>
              </div>
            );
          }

          // Check cooldown
          const skillCooldowns = currentCombatState?.skillCooldowns || {};
          const cooldownEndTime = skillCooldowns[skillId] || 0;
          const now = Date.now();
          const isOnCooldown = cooldownEndTime > 0 && now < cooldownEndTime;
          const cooldownRemaining = isOnCooldown ? Math.ceil((cooldownEndTime - now) / 1000) : 0;

          const canUse = playerMana >= (skill.manaCost || 0) && !isOnCooldown;
          const skillLevel =
            character.learnedSkills.find((ls) => ls.skillId === skillId)?.level || 0;
          const autoSetting = AutoSkillManager.getAutoSkillSetting(character, skillId);
          const hasAutoUse = autoSetting.enabled && autoSetting.condition !== AutoCondition.NEVER;

          const getConditionTooltip = (setting: AutoSkillSetting): string => {
            if (!setting.enabled || setting.condition === AutoCondition.NEVER) {
              return UI_TOOLTIPS.MANUAL_USE_ONLY;
            }
            if (setting.condition === AutoCondition.ALWAYS) {
              return UI_TOOLTIPS.AUTO_ALWAYS_AVAILABLE;
            }
            if (setting.threshold !== undefined) {
              switch (setting.condition) {
                case AutoCondition.PLAYER_HEALTH_BELOW:
                  return UI_TOOLTIPS.AUTO_PLAYER_HEALTH_BELOW(setting.threshold);
                case AutoCondition.PLAYER_HEALTH_ABOVE:
                  return UI_TOOLTIPS.AUTO_PLAYER_HEALTH_ABOVE(setting.threshold);
                case AutoCondition.PLAYER_MANA_ABOVE:
                  return UI_TOOLTIPS.AUTO_PLAYER_MANA_ABOVE(setting.threshold);
                case AutoCondition.ENEMY_HEALTH_BELOW:
                  return UI_TOOLTIPS.AUTO_ENEMY_HEALTH_BELOW(setting.threshold);
                case AutoCondition.ENEMY_HEALTH_ABOVE:
                  return UI_TOOLTIPS.AUTO_ENEMY_HEALTH_ABOVE(setting.threshold);
                default:
                  return UI_TOOLTIPS.MANUAL_USE_ONLY;
              }
            }
            return SKILL_CONDITION_DESCRIPTIONS[setting.condition] || UI_TOOLTIPS.MANUAL_USE_ONLY;
          };

          return (
            <TooltipWrapper key={index} content={getConditionTooltip(autoSetting)}>
              <div
                className={`skill-slot ${!canUse || !isPlayerTurn || isOnCooldown ? 'disabled' : ''} ${isOnCooldown ? 'on-cooldown' : ''}`}
              >
                <div className="skill-slot-number">{index + 1}</div>
                <SkillButton
                  skill={skill}
                  mana={playerMana}
                  onUse={() => onSkillUse(skillId)}
                  disabled={!canUse || !isPlayerTurn || isOnCooldown}
                  cooldownRemaining={cooldownRemaining}
                />
                {skillLevel > 0 && <div className="skill-level-indicator">Lv.{skillLevel}</div>}
                {hasAutoUse && (
                  <div
                    className={`skill-auto-indicator ${
                      autoSetting.condition === 'player_health_below' ||
                      autoSetting.condition === 'enemy_health_below'
                        ? 'auto-heal'
                        : autoSetting.condition === 'player_health_above' ||
                            autoSetting.condition === 'enemy_health_above'
                          ? 'auto-damage'
                          : 'auto-default'
                    }`}
                    title={getConditionTooltip(autoSetting)}
                  >
                    A
                  </div>
                )}
                <button
                  className="skill-settings-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfigSkillId(skillId);
                  }}
                  title="Configure auto-skill settings"
                >
                  ⚙
                </button>
              </div>
            </TooltipWrapper>
          );
        })}
      </div>
      {configSkillId && character && (
        <AutoSkillConfigModal
          isOpen={true}
          skillId={configSkillId}
          currentSetting={AutoSkillManager.getAutoSkillSetting(character, configSkillId)}
          onClose={() => setConfigSkillId(null)}
          onSave={(setting) => {
            updateAutoSkillSetting(configSkillId, setting);
            setConfigSkillId(null);
          }}
        />
      )}
    </div>
  );
}
