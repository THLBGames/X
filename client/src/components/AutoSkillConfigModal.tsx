import { useState, useEffect } from 'react';
import type { AutoSkillSetting } from '@idle-rpg/shared';
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
  const [enabled, setEnabled] = useState(currentSetting.enabled);
  const [condition, setCondition] = useState<AutoSkillSetting['condition']>(
    currentSetting.condition
  );
  const [threshold, setThreshold] = useState<string>(
    currentSetting.threshold !== undefined ? currentSetting.threshold.toString() : '50'
  );
  const [priority, setPriority] = useState<string>(
    currentSetting.priority !== undefined ? currentSetting.priority.toString() : '1'
  );

  const dataLoader = getDataLoader();
  const skill = dataLoader.getSkill(skillId);

  // Update state when modal opens or currentSetting changes
  useEffect(() => {
    if (isOpen) {
      setEnabled(currentSetting.enabled);
      setCondition(currentSetting.condition);
      setThreshold(
        currentSetting.threshold !== undefined ? currentSetting.threshold.toString() : '50'
      );
      setPriority(currentSetting.priority !== undefined ? currentSetting.priority.toString() : '1');
    }
  }, [isOpen, currentSetting]);

  if (!isOpen) {
    return null;
  }

  const needsThreshold =
    condition === 'player_health_below' ||
    condition === 'player_health_above' ||
    condition === 'player_mana_above' ||
    condition === 'enemy_health_below' ||
    condition === 'enemy_health_above';

  const handleSave = () => {
    // Validate inputs
    const thresholdNum = needsThreshold ? parseInt(threshold, 10) : undefined;
    const priorityNum = parseInt(priority, 10);

    if (needsThreshold && (thresholdNum === undefined || thresholdNum < 0 || thresholdNum > 100)) {
      alert('Threshold must be between 0 and 100');
      return;
    }

    if (priorityNum < 1 || priorityNum > 8) {
      alert('Priority must be between 1 and 8');
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
    switch (cond) {
      case 'always':
        return 'Always use when available (if mana allows)';
      case 'never':
        return 'Never use automatically (manual only)';
      case 'player_health_below':
        return 'Use when player health is below threshold';
      case 'player_health_above':
        return 'Use when player health is above threshold';
      case 'player_mana_above':
        return 'Use when player mana is above threshold';
      case 'enemy_health_below':
        return 'Use when enemy health is below threshold';
      case 'enemy_health_above':
        return 'Use when enemy health is above threshold';
      default:
        return '';
    }
  };

  return (
    <div className="auto-skill-config-overlay" onClick={onClose}>
      <div className="auto-skill-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auto-skill-config-header">
          <h3>Auto-Skill Configuration</h3>
          <button className="auto-skill-config-close" onClick={onClose}>
            ×
          </button>
        </div>

        {skill && (
          <div className="auto-skill-config-skill-info">
            <div className="auto-skill-config-skill-name">{skill.name}</div>
            <div className="auto-skill-config-skill-description">{skill.description}</div>
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
              <span>Enable automatic use</span>
            </label>
          </div>

          <div className="auto-skill-config-field">
            <label>
              Condition:
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as AutoSkillSetting['condition'])}
                disabled={!enabled}
              >
                <option value="never">Never (manual only)</option>
                <option value="always">Always (when available)</option>
                <option value="player_health_below">Player health below %</option>
                <option value="player_health_above">Player health above %</option>
                <option value="player_mana_above">Player mana above %</option>
                <option value="enemy_health_below">Enemy health below %</option>
                <option value="enemy_health_above">Enemy health above %</option>
              </select>
            </label>
            <div className="auto-skill-config-hint">{getConditionDescription(condition)}</div>
          </div>

          {needsThreshold && (
            <div className="auto-skill-config-field">
              <label>
                Threshold (%):
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  disabled={!enabled}
                />
              </label>
            </div>
          )}

          <div className="auto-skill-config-field">
            <label>
              Priority (1-8, lower = higher priority):
              <input
                type="number"
                min="1"
                max="8"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={!enabled}
              />
            </label>
            <div className="auto-skill-config-hint">
              Skills with lower priority numbers are used first
            </div>
          </div>
        </div>

        <div className="auto-skill-config-actions">
          <button className="auto-skill-config-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="auto-skill-config-save" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
