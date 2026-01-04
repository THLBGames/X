import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { AutoConsumableSetting } from '@idle-rpg/shared';
import {
  AutoCondition,
  CONDITIONS_REQUIRING_THRESHOLD,
  CONSUMABLE_PRIORITY_MIN,
  CONSUMABLE_PRIORITY_MAX,
  THRESHOLD_MIN,
  THRESHOLD_MAX,
  DEFAULT_THRESHOLD,
  DEFAULT_PRIORITY,
  CONSUMABLE_CONDITION_DESCRIPTIONS,
  ConsumableEffectType,
} from '@idle-rpg/shared';
import { UI_MESSAGES, UI_LABELS } from '../constants/ui';
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
  const { t } = useTranslation('ui');
  const [enabled, setEnabled] = useState(currentSetting.enabled);
  const [condition, setCondition] = useState<AutoConsumableSetting['condition']>(
    currentSetting.condition
  );
  const [threshold, setThreshold] = useState<string>(
    currentSetting.threshold !== undefined ? currentSetting.threshold.toString() : DEFAULT_THRESHOLD.toString()
  );
  const [priority, setPriority] = useState<string>(
    currentSetting.priority !== undefined ? currentSetting.priority.toString() : DEFAULT_PRIORITY.toString()
  );

  const dataLoader = getDataLoader();
  const item = dataLoader.getItem(itemId);

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

    if (priorityNum < CONSUMABLE_PRIORITY_MIN || priorityNum > CONSUMABLE_PRIORITY_MAX) {
      alert(UI_MESSAGES.CONSUMABLE_PRIORITY_RANGE_ERROR(CONSUMABLE_PRIORITY_MIN, CONSUMABLE_PRIORITY_MAX));
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
    return CONSUMABLE_CONDITION_DESCRIPTIONS[cond] || '';
  };

  return (
    <div className="auto-consumable-config-overlay" onClick={onClose}>
      <div className="auto-consumable-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auto-consumable-config-header">
          <h3>{UI_LABELS.AUTO_CONSUMABLE_CONFIG_TITLE()}</h3>
          <button className="auto-consumable-config-close" onClick={onClose}>
            ×
          </button>
        </div>

        {item && (
          <div className="auto-consumable-config-item-info">
            <div className="auto-consumable-config-item-name">{dataLoader.getTranslatedName(item)}</div>
            <div className="auto-consumable-config-item-description">{dataLoader.getTranslatedDescription(item)}</div>
            {item.consumableEffect && (
              <div className="auto-consumable-config-item-effect">
                {item.consumableEffect.type === ConsumableEffectType.HEAL && t('consumables.heals', { amount: item.consumableEffect.amount || 0 })}
                {item.consumableEffect.type === ConsumableEffectType.MANA && t('consumables.restores', { amount: item.consumableEffect.amount || 0 })}
                {item.consumableEffect.type === ConsumableEffectType.BUFF && t('consumables.appliesBuff', { buffId: item.consumableEffect.buffId || t('consumables.unknown') })}
                {item.consumableEffect.type === ConsumableEffectType.EXPERIENCE && t('consumables.grants', { amount: item.consumableEffect.amount || 0 })}
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
              <span>{UI_LABELS.ENABLE_AUTOMATIC_USE()}</span>
            </label>
          </div>

          <div className="auto-consumable-config-field">
            <label>
              {UI_LABELS.CONDITION()}
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as AutoConsumableSetting['condition'])}
                disabled={!enabled}
              >
                <option value={AutoCondition.NEVER}>{UI_LABELS.NEVER_MANUAL_ONLY()}</option>
                <option value={AutoCondition.ALWAYS}>{UI_LABELS.ALWAYS_WHEN_AVAILABLE()}</option>
                <option value={AutoCondition.PLAYER_HEALTH_BELOW}>{UI_LABELS.PLAYER_HEALTH_BELOW()}</option>
                <option value={AutoCondition.PLAYER_HEALTH_ABOVE}>{UI_LABELS.PLAYER_HEALTH_ABOVE()}</option>
                <option value={AutoCondition.PLAYER_MANA_BELOW}>{UI_LABELS.PLAYER_MANA_BELOW()}</option>
                <option value={AutoCondition.PLAYER_MANA_ABOVE}>{UI_LABELS.PLAYER_MANA_ABOVE()}</option>
              </select>
            </label>
            <div className="auto-consumable-config-hint">{getConditionDescription(condition)}</div>
          </div>

          {needsThreshold && (
            <div className="auto-consumable-config-field">
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

          <div className="auto-consumable-config-field">
            <label>
              {UI_LABELS.CONSUMABLE_PRIORITY_RANGE(CONSUMABLE_PRIORITY_MIN, CONSUMABLE_PRIORITY_MAX)}:
              <input
                type="number"
                min={CONSUMABLE_PRIORITY_MIN}
                max={CONSUMABLE_PRIORITY_MAX}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={!enabled}
              />
            </label>
            <div className="auto-consumable-config-hint">
              {UI_LABELS.PRIORITY_HINT_CONSUMABLES()}
            </div>
          </div>
        </div>

        <div className="auto-consumable-config-actions">
          <button className="auto-consumable-config-cancel" onClick={onClose}>
            {UI_LABELS.CANCEL()}
          </button>
          <button className="auto-consumable-config-save" onClick={handleSave}>
            {UI_LABELS.SAVE()}
          </button>
        </div>
      </div>
    </div>
  );
}

