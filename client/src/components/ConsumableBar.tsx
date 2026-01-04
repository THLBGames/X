import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { AutoConsumableManager } from '../systems/combat/AutoConsumableManager';
import type { AutoConsumableSetting, ConsumableEffectType } from '@idle-rpg/shared';
import { AutoCondition, ConsumableEffectType as ConsumableEffectTypeEnum, CONSUMABLE_CONDITION_DESCRIPTIONS, MAX_CONSUMABLE_BAR_SLOTS } from '@idle-rpg/shared';
import { UI_TOOLTIPS, UI_LABELS } from '../constants/ui';
import TooltipWrapper from './TooltipWrapper';
import AutoConsumableConfigModal from './AutoConsumableConfigModal';
import './ConsumableBar.css';

interface ConsumableBarProps {
  onConsumableUse: (itemId: string) => void;
}

export default function ConsumableBar({ onConsumableUse }: ConsumableBarProps) {
  const { t } = useTranslation('ui');
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const currentCombatState = useGameState((state) => state.currentCombatState);
  const isCombatActive = useGameState((state) => state.isCombatActive);
  const updateAutoConsumableSetting = useGameState((state) => state.updateAutoConsumableSetting);
  const isPlayerTurn = currentCombatState?.currentActor === 'player';
  const dataLoader = getDataLoader();
  const [configItemId, setConfigItemId] = useState<string | null>(null);

  if (!character || !character.consumableBar || character.consumableBar.length === 0) {
    return null; // Don't show empty consumable bar
  }

  // Ensure we have exactly MAX_CONSUMABLE_BAR_SLOTS slots (pad with nulls)
  const consumableSlots: (string | null)[] = [...character.consumableBar];
  while (consumableSlots.length < MAX_CONSUMABLE_BAR_SLOTS) {
    consumableSlots.push(null);
  }
  consumableSlots.splice(MAX_CONSUMABLE_BAR_SLOTS); // Limit to MAX_CONSUMABLE_BAR_SLOTS

  return (
    <div className="consumable-bar">
      <div className="consumable-bar-label">{UI_LABELS.CONSUMABLES()}</div>
      <div className="consumable-bar-slots">
        {consumableSlots.map((itemId, index) => {
          if (!itemId) {
            return (
              <div key={index} className="consumable-slot empty">
                <div className="consumable-slot-number">{index + 1}</div>
              </div>
            );
          }

          const item = dataLoader.getItem(itemId);
          if (!item || item.type !== 'consumable' || !item.consumableEffect) {
            return (
              <div key={index} className="consumable-slot empty">
                <div className="consumable-slot-number">{index + 1}</div>
              </div>
            );
          }

          // Check if player has the item in inventory
          const inventoryItem = inventory.items.find((invItem) => invItem.itemId === itemId);
          const hasItem = inventoryItem && inventoryItem.quantity > 0;
          const quantity = inventoryItem?.quantity || 0;

          const canUse = hasItem && (isPlayerTurn || !isCombatActive);
          const autoSetting = AutoConsumableManager.getAutoConsumableSetting(character, itemId);
          const hasAutoUse = autoSetting.enabled && autoSetting.condition !== AutoCondition.NEVER;

          const getConditionTooltip = (setting: AutoConsumableSetting): string => {
            if (!setting.enabled || setting.condition === AutoCondition.NEVER) {
              return UI_TOOLTIPS.MANUAL_USE_ONLY();
            }
            if (setting.condition === AutoCondition.ALWAYS) {
              return UI_TOOLTIPS.AUTO_ALWAYS_AVAILABLE();
            }
            if (setting.threshold !== undefined) {
              switch (setting.condition) {
                case AutoCondition.PLAYER_HEALTH_BELOW:
                  return UI_TOOLTIPS.AUTO_PLAYER_HEALTH_BELOW(setting.threshold);
                case AutoCondition.PLAYER_HEALTH_ABOVE:
                  return UI_TOOLTIPS.AUTO_PLAYER_HEALTH_ABOVE(setting.threshold);
                case AutoCondition.PLAYER_MANA_BELOW:
                  return UI_TOOLTIPS.AUTO_PLAYER_MANA_BELOW(setting.threshold);
                case AutoCondition.PLAYER_MANA_ABOVE:
                  return UI_TOOLTIPS.AUTO_PLAYER_MANA_ABOVE(setting.threshold);
                default:
                  return UI_TOOLTIPS.MANUAL_USE_ONLY();
              }
            }
            return CONSUMABLE_CONDITION_DESCRIPTIONS[setting.condition] || UI_TOOLTIPS.MANUAL_USE_ONLY();
          };

          const getEffectDescription = (): string => {
            const effect = item.consumableEffect;
            if (!effect) return '';
            switch (effect.type as ConsumableEffectType) {
              case ConsumableEffectTypeEnum.HEAL:
                return t('consumables.heals', { amount: effect.amount || 0 });
              case ConsumableEffectTypeEnum.MANA:
                return t('consumables.restores', { amount: effect.amount || 0 });
              case ConsumableEffectTypeEnum.BUFF:
                return t('consumables.appliesBuff', { buffId: effect.buffId || t('consumables.unknown') });
              case ConsumableEffectTypeEnum.EXPERIENCE:
                return t('consumables.grants', { amount: effect.amount || 0 });
              default:
                return '';
            }
          };

          return (
            <TooltipWrapper
              key={index}
              content={`${dataLoader.getTranslatedName(item)}\n${dataLoader.getTranslatedDescription(item)}\n${getEffectDescription()}\n\n${getConditionTooltip(autoSetting)}`}
            >
              <div
                className={`consumable-slot ${!canUse ? 'disabled' : ''} ${!hasItem ? 'no-item' : ''}`}
              >
                <div className="consumable-slot-number">{index + 1}</div>
                <button
                  className="consumable-button"
                  onClick={() => {
                    if (canUse) {
                      onConsumableUse(itemId);
                    }
                  }}
                  disabled={!canUse}
                  title={`${dataLoader.getTranslatedName(item)} - ${getEffectDescription()}`}
                >
                  <div className="consumable-icon">
                    {item.consumableEffect?.type === 'heal' ? '❤️' : item.consumableEffect?.type === 'mana' ? '💙' : '⚗️'}
                  </div>
                  <div className="consumable-name">{dataLoader.getTranslatedName(item)}</div>
                  {quantity > 0 && (
                    <div className="consumable-quantity">x{quantity}</div>
                  )}
                </button>
                {hasAutoUse && (
                  <div
                    className={`consumable-auto-indicator ${
                      autoSetting.condition === 'player_health_below' ||
                      autoSetting.condition === 'player_mana_below'
                        ? 'auto-heal'
                        : 'auto-default'
                    }`}
                    title={getConditionTooltip(autoSetting)}
                  >
                    A
                  </div>
                )}
                <button
                  className="consumable-settings-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfigItemId(itemId);
                  }}
                  title={UI_TOOLTIPS.CONFIGURE_AUTO_CONSUMABLE()}
                >
                  ⚙
                </button>
              </div>
            </TooltipWrapper>
          );
        })}
      </div>
      {configItemId && character && (
        <AutoConsumableConfigModal
          isOpen={true}
          itemId={configItemId}
          currentSetting={AutoConsumableManager.getAutoConsumableSetting(character, configItemId)}
          onClose={() => setConfigItemId(null)}
          onSave={(setting) => {
            updateAutoConsumableSetting(configItemId, setting);
            setConfigItemId(null);
          }}
        />
      )}
    </div>
  );
}

