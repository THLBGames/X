import { useState, useEffect } from 'react';
import type { AutoConsumableSetting } from '@idle-rpg/shared';
import { getDataLoader } from '../data';
import './AutoConsumableConfigModal.css';

interface AutoConsumableConfigModalProps {
  isOpen: boolean;
  itemId: string;
  currentSetting: AutoConsumableSetting;
  onClose: () => void;
  onSave: (setting: AutoConsumableSetting) => void;
}

export default function AutoConsumableConfigModal({
  isOpen,
  itemId,
  currentSetting,
  onClose,
  onSave,
}: AutoConsumableConfigModalProps) {
  const [enabled, setEnabled] = useState(currentSetting.enabled);
  const [condition, setCondition] = useState<AutoConsumableSetting['condition']>(
    currentSetting.condition
  );
  const [threshold, setThreshold] = useState<string>(
    currentSetting.threshold !== undefined ? currentSetting.threshold.toString() : '50'
  );
  const [priority, setPriority] = useState<string>(
    currentSetting.priority !== undefined ? currentSetting.priority.toString() : '1'
  );

  const dataLoader = getDataLoader();
  const item = dataLoader.getItem(itemId);

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
    condition === 'player_mana_below' ||
    condition === 'player_mana_above';

  const handleSave = () => {
    // Validate inputs
    const thresholdNum = needsThreshold ? parseInt(threshold, 10) : undefined;
    const priorityNum = parseInt(priority, 10);

    if (needsThreshold && (thresholdNum === undefined || thresholdNum < 0 || thresholdNum > 100)) {
      alert('Threshold must be between 0 and 100');
      return;
    }

    if (priorityNum < 1 || priorityNum > 3) {
      alert('Priority must be between 1 and 3');
      return;
    }

    const newSetting: AutoConsumableSetting = {
      itemId,
      enabled,
      condition,
      threshold: thresholdNum,
      priority: priorityNum,
    };

    onSave(newSetting);
    onClose();
  };

  const getConditionDescription = (cond: AutoConsumableSetting['condition']): string => {
    switch (cond) {
      case 'always':
        return 'Always use when available (if in inventory)';
      case 'never':
        return 'Never use automatically (manual only)';
      case 'player_health_below':
        return 'Use when player health is below threshold';
      case 'player_health_above':
        return 'Use when player health is above threshold';
      case 'player_mana_below':
        return 'Use when player mana is below threshold';
      case 'player_mana_above':
        return 'Use when player mana is above threshold';
      default:
        return '';
    }
  };

  return (
    <div className="auto-consumable-config-overlay" onClick={onClose}>
      <div className="auto-consumable-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auto-consumable-config-header">
          <h3>Auto-Consumable Configuration</h3>
          <button className="auto-consumable-config-close" onClick={onClose}>
            ×
          </button>
        </div>

        {item && (
          <div className="auto-consumable-config-item-info">
            <div className="auto-consumable-config-item-name">{item.name}</div>
            <div className="auto-consumable-config-item-description">{item.description}</div>
            {item.consumableEffect && (
              <div className="auto-consumable-config-item-effect">
                {item.consumableEffect.type === 'heal' && `Heals ${item.consumableEffect.amount || 0} HP`}
                {item.consumableEffect.type === 'mana' && `Restores ${item.consumableEffect.amount || 0} MP`}
                {item.consumableEffect.type === 'buff' && `Applies buff: ${item.consumableEffect.buffId || 'Unknown'}`}
                {item.consumableEffect.type === 'experience' && `Grants ${item.consumableEffect.amount || 0} XP`}
              </div>
            )}
          </div>
        )}

        <div className="auto-consumable-config-content">
          <div className="auto-consumable-config-field">
            <label>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>Enable automatic use</span>
            </label>
          </div>

          <div className="auto-consumable-config-field">
            <label>
              Condition:
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as AutoConsumableSetting['condition'])}
                disabled={!enabled}
              >
                <option value="never">Never (manual only)</option>
                <option value="always">Always (when available)</option>
                <option value="player_health_below">Player health below %</option>
                <option value="player_health_above">Player health above %</option>
                <option value="player_mana_below">Player mana below %</option>
                <option value="player_mana_above">Player mana above %</option>
              </select>
            </label>
            <div className="auto-consumable-config-hint">{getConditionDescription(condition)}</div>
          </div>

          {needsThreshold && (
            <div className="auto-consumable-config-field">
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

          <div className="auto-consumable-config-field">
            <label>
              Priority (1-3, lower = higher priority):
              <input
                type="number"
                min="1"
                max="3"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={!enabled}
              />
            </label>
            <div className="auto-consumable-config-hint">
              Consumables with lower priority numbers are used first
            </div>
          </div>
        </div>

        <div className="auto-consumable-config-actions">
          <button className="auto-consumable-config-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="auto-consumable-config-save" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

