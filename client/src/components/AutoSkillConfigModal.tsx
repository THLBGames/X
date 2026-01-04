import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { AutoSkillSetting } from '@idle-rpg/shared';
import {
  AutoCondition,
  CONDITIONS_REQUIRING_THRESHOLD,
  SKILL_PRIORITY_MIN,
  SKILL_PRIORITY_MAX,
  THRESHOLD_MIN,
  THRESHOLD_MAX,
  DEFAULT_THRESHOLD,
  DEFAULT_PRIORITY,
  SKILL_CONDITION_DESCRIPTIONS,
} from '@idle-rpg/shared';
import { UI_MESSAGES, UI_LABELS } from '../constants/ui';
import { getDataLoader } from '../data';
import './AutoSkillConfigModal.css';

interface AutoSkillConfigModalProps {
  isOpen: boolean;
  skillId: string;
  currentSetting: AutoSkillSetting;
  onClose: () => void;
  onSave: (setting: AutoSkillSetting) => void;
}

export default function AutoSkillConfigModal({
  isOpen,
  skillId,
  currentSetting,
  onClose,
  onSave,
}: AutoSkillConfigModalProps) {
  const { t } = useTranslation('ui');
  const [enabled, setEnabled] = useState(currentSetting.enabled);
  const [condition, setCondition] = useState<AutoSkillSetting['condition']>(
    currentSetting.condition
  );
  const [threshold, setThreshold] = useState<string>(
    currentSetting.threshold !== undefined ? currentSetting.threshold.toString() : DEFAULT_THRESHOLD.toString()
  );
  const [priority, setPriority] = useState<string>(
    currentSetting.priority !== undefined ? currentSetting.priority.toString() : DEFAULT_PRIORITY.toString()
  );

  const dataLoader = getDataLoader();
  const skill = dataLoader.getSkill(skillId);

  // Update state when modal opens or currentSetting changes
  useEffect(() => {
    if (isOpen) {
      setEnabled(currentSetting.enabled);
      setCondition(currentSetting.condition);
      setThreshold(
        currentSetting.threshold !== undefined ? currentSetting.threshold.toString() : DEFAULT_THRESHOLD.toString()
      );
      setPriority(currentSetting.priority !== undefined ? currentSetting.priority.toString() : DEFAULT_PRIORITY.toString());
    }
  }, [isOpen, currentSetting]);

  if (!isOpen) {
    return null;
  }

  const needsThreshold = CONDITIONS_REQUIRING_THRESHOLD.includes(condition);

  const handleSave = () => {
    // Validate inputs
    const thresholdNum = needsThreshold ? parseInt(threshold, 10) : undefined;
    const priorityNum = parseInt(priority, 10);

    if (needsThreshold && (thresholdNum === undefined || thresholdNum < THRESHOLD_MIN || thresholdNum > THRESHOLD_MAX)) {
      alert(UI_MESSAGES.THRESHOLD_RANGE_ERROR());
      return;
    }

    if (priorityNum < SKILL_PRIORITY_MIN || priorityNum > SKILL_PRIORITY_MAX) {
      alert(UI_MESSAGES.SKILL_PRIORITY_RANGE_ERROR(SKILL_PRIORITY_MIN, SKILL_PRIORITY_MAX));
      return;
    }

    const newSetting: AutoSkillSetting = {
      skillId,
      enabled,
      condition,
      threshold: thresholdNum,
      priority: priorityNum,
    };

    onSave(newSetting);
    onClose();
  };

  const getConditionDescription = (cond: AutoSkillSetting['condition']): string => {
    return SKILL_CONDITION_DESCRIPTIONS[cond] || '';
  };

  return (
    <div className="auto-skill-config-overlay" onClick={onClose}>
      <div className="auto-skill-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auto-skill-config-header">
          <h3>{UI_LABELS.AUTO_SKILL_CONFIG_TITLE()}</h3>
          <button className="auto-skill-config-close" onClick={onClose}>
            ×
          </button>
        </div>

        {skill && (
          <div className="auto-skill-config-skill-info">
            <div className="auto-skill-config-skill-name">{dataLoader.getTranslatedName(skill)}</div>
            <div className="auto-skill-config-skill-description">{dataLoader.getTranslatedDescription(skill)}</div>
          </div>
        )}

        <div className="auto-skill-config-content">
          <div className="auto-skill-config-field">
            <label>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>{UI_LABELS.ENABLE_AUTOMATIC_USE()}</span>
            </label>
          </div>

          <div className="auto-skill-config-field">
            <label>
              {UI_LABELS.CONDITION()}
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as AutoSkillSetting['condition'])}
                disabled={!enabled}
              >
                <option value={AutoCondition.NEVER}>{UI_LABELS.NEVER_MANUAL_ONLY()}</option>
                <option value={AutoCondition.ALWAYS}>{UI_LABELS.ALWAYS_WHEN_AVAILABLE()}</option>
                <option value={AutoCondition.PLAYER_HEALTH_BELOW}>{UI_LABELS.PLAYER_HEALTH_BELOW()}</option>
                <option value={AutoCondition.PLAYER_HEALTH_ABOVE}>{UI_LABELS.PLAYER_HEALTH_ABOVE()}</option>
                <option value={AutoCondition.PLAYER_MANA_ABOVE}>{UI_LABELS.PLAYER_MANA_ABOVE()}</option>
                <option value={AutoCondition.ENEMY_HEALTH_BELOW}>{UI_LABELS.ENEMY_HEALTH_BELOW()}</option>
                <option value={AutoCondition.ENEMY_HEALTH_ABOVE}>{UI_LABELS.ENEMY_HEALTH_ABOVE()}</option>
              </select>
            </label>
            <div className="auto-skill-config-hint">{getConditionDescription(condition)}</div>
          </div>

          {needsThreshold && (
            <div className="auto-skill-config-field">
              <label>
                {UI_LABELS.THRESHOLD_PERCENT()}
                <input
                  type="number"
                  min={THRESHOLD_MIN}
                  max={THRESHOLD_MAX}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  disabled={!enabled}
                />
              </label>
            </div>
          )}

          <div className="auto-skill-config-field">
            <label>
              {UI_LABELS.SKILL_PRIORITY_RANGE(SKILL_PRIORITY_MIN, SKILL_PRIORITY_MAX)}:
              <input
                type="number"
                min={SKILL_PRIORITY_MIN}
                max={SKILL_PRIORITY_MAX}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={!enabled}
              />
            </label>
            <div className="auto-skill-config-hint">
              {UI_LABELS.PRIORITY_HINT_SKILLS()}
            </div>
          </div>
        </div>

        <div className="auto-skill-config-actions">
          <button className="auto-skill-config-cancel" onClick={onClose}>
            {UI_LABELS.CANCEL()}
          </button>
          <button className="auto-skill-config-save" onClick={handleSave}>
            {UI_LABELS.SAVE()}
          </button>
        </div>
      </div>
    </div>
  );
}
