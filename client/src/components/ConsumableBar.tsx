import { useState } from 'react';
import { useGameState } from '../systems';
import { getDataLoader } from '../data';
import { AutoConsumableManager } from '../systems/combat/AutoConsumableManager';
import type { AutoConsumableSetting } from '@idle-rpg/shared';
import TooltipWrapper from './TooltipWrapper';
import AutoConsumableConfigModal from './AutoConsumableConfigModal';
import './ConsumableBar.css';

interface ConsumableBarProps {
  onConsumableUse: (itemId: string) => void;
}

export default function ConsumableBar({ onConsumableUse }: ConsumableBarProps) {
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

  // Ensure we have exactly 3 slots (pad with nulls)
  const consumableSlots: (string | null)[] = [...character.consumableBar];
  while (consumableSlots.length < 3) {
    consumableSlots.push(null);
  }
  consumableSlots.splice(3); // Limit to 3

  return (
    <div className="consumable-bar">
      <div className="consumable-bar-label">Consumables</div>
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
          const hasAutoUse = autoSetting.enabled && autoSetting.condition !== 'never';

          const getConditionTooltip = (setting: AutoConsumableSetting): string => {
            if (!setting.enabled || setting.condition === 'never') {
              return 'Manual use only';
            }
            switch (setting.condition) {
              case 'always':
                return 'Auto: Always use when available';
              case 'player_health_below':
                return `Auto: Use when player health < ${setting.threshold}%`;
              case 'player_health_above':
                return `Auto: Use when player health > ${setting.threshold}%`;
              case 'player_mana_below':
                return `Auto: Use when player mana < ${setting.threshold}%`;
              case 'player_mana_above':
                return `Auto: Use when player mana > ${setting.threshold}%`;
              default:
                return 'Manual use only';
            }
          };

          const getEffectDescription = (): string => {
            const effect = item.consumableEffect;
            if (!effect) return '';
            switch (effect.type) {
              case 'heal':
                return `Heals ${effect.amount || 0} HP`;
              case 'mana':
                return `Restores ${effect.amount || 0} MP`;
              case 'buff':
                return `Applies buff: ${effect.buffId || 'Unknown'}`;
              case 'experience':
                return `Grants ${effect.amount || 0} XP`;
              default:
                return '';
            }
          };

          return (
            <TooltipWrapper
              key={index}
              content={`${item.name}\n${item.description}\n${getEffectDescription()}\n\n${getConditionTooltip(autoSetting)}`}
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
                  title={`${item.name} - ${getEffectDescription()}`}
                >
                  <div className="consumable-icon">
                    {item.consumableEffect?.type === 'heal' ? '❤️' : item.consumableEffect?.type === 'mana' ? '💙' : '⚗️'}
                  </div>
                  <div className="consumable-name">{item.name}</div>
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
                  title="Configure auto-consumable settings"
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

