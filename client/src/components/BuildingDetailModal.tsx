import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import { CityManager } from '../systems/city/CityManager';
import type { Building, Character, Inventory } from '@idle-rpg/shared';
import { InventoryManager } from '../systems/inventory';
import { getDataLoader } from '../data';
import './BuildingDetailModal.css';

interface BuildingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  building: Building;
  character: Character;
  inventory: Inventory;
}

export default function BuildingDetailModal({
  isOpen,
  onClose,
  building,
  character,
  inventory,
}: BuildingDetailModalProps) {
  const unlockBuilding = useGameState((state) => state.unlockBuilding);
  const upgradeBuilding = useGameState((state) => state.upgradeBuilding);
  const setCharacter = useGameState((state) => state.setCharacter);
  const setInventory = useGameState((state) => state.setInventory);

  const [canUnlock, setCanUnlock] = useState<{ canUnlock: boolean; reason?: string }>({
    canUnlock: false,
  });
  const [canUpgrade, setCanUpgrade] = useState<{ canUpgrade: boolean; reason?: string }>({
    canUpgrade: false,
  });
  const [currentLevel, setCurrentLevel] = useState(0);
  const [prerequisiteBuildings, setPrerequisiteBuildings] = useState<Record<string, Building>>({});

  const city = character.city || CityManager.initializeCity();
  const dataLoader = getDataLoader();
  const gold = InventoryManager.getGold(inventory);

  useEffect(() => {
    if (!isOpen) return;

    const checkRequirements = async () => {
      const level = CityManager.getBuildingLevel(city, building.id);
      setCurrentLevel(level);

      // Load prerequisite buildings
      if (building.unlockRequirements.prerequisiteBuildings) {
        const prereqMap: Record<string, Building> = {};
        for (const prereq of building.unlockRequirements.prerequisiteBuildings) {
          const prereqBuilding = await CityManager.getBuilding(prereq.buildingId);
          if (prereqBuilding) {
            prereqMap[prereq.buildingId] = prereqBuilding;
          }
        }
        setPrerequisiteBuildings(prereqMap);
      }

      if (level === 0) {
        const unlockCheck = await CityManager.canUnlockBuilding(character, inventory, building.id);
        setCanUnlock(unlockCheck);
      } else {
        const upgradeCheck = await CityManager.canUpgradeBuilding(character, inventory, building.id);
        setCanUpgrade(upgradeCheck);
      }
    };

    checkRequirements();
  }, [isOpen, building, character, inventory, city]);

  if (!isOpen) return null;

  const handleUnlock = async () => {
    const result = await CityManager.unlockBuilding(character, inventory, building.id);
    if (result.success && result.character && result.inventory) {
      setCharacter(result.character);
      setInventory(result.inventory);
      onClose();
    } else {
      alert(result.reason || 'Failed to unlock building');
    }
  };

  const handleUpgrade = async () => {
    const result = await CityManager.upgradeBuilding(character, inventory, building.id);
    if (result.success && result.character && result.inventory) {
      setCharacter(result.character);
      setInventory(result.inventory);
      onClose();
    } else {
      alert(result.reason || 'Failed to upgrade building');
    }
  };

  const currentLevelData = building.levels.find((l) => l.level === currentLevel);
  const nextLevelData =
    currentLevel < building.maxLevel
      ? building.levels.find((l) => l.level === currentLevel + 1)
      : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="building-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{building.name}</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="building-info">
            <div className="building-description">{building.description}</div>
            <div className="building-category">Category: {building.category}</div>
            {currentLevel > 0 && (
              <div className="building-level-info">
                Current Level: {currentLevel} / {building.maxLevel}
              </div>
            )}
          </div>

          {currentLevel === 0 ? (
            <div className="unlock-section">
              <h3>Unlock Requirements</h3>
              <div className="requirements-list">
                {building.unlockRequirements.level && (
                  <div className="requirement-item">
                    <span className="requirement-label">Level:</span>
                    <span
                      className={
                        character.level >= building.unlockRequirements.level
                          ? 'requirement-met'
                          : 'requirement-unmet'
                      }
                    >
                      {building.unlockRequirements.level} (Current: {character.level})
                    </span>
                  </div>
                )}
                {building.unlockRequirements.gold && (
                  <div className="requirement-item">
                    <span className="requirement-label">Gold:</span>
                    <span
                      className={
                        gold >= building.unlockRequirements.gold
                          ? 'requirement-met'
                          : 'requirement-unmet'
                      }
                    >
                      {building.unlockRequirements.gold} (Have: {gold})
                    </span>
                  </div>
                )}
                {building.unlockRequirements.materials &&
                  building.unlockRequirements.materials.map((material, idx) => {
                    const have = InventoryManager.getItemQuantity(inventory, material.itemId);
                    const item = dataLoader.getItem(material.itemId);
                    return (
                      <div key={idx} className="requirement-item">
                        <span className="requirement-label">Material:</span>
                        <span className={have >= material.quantity ? 'requirement-met' : 'requirement-unmet'}>
                          {material.quantity}x {item?.name || material.itemId} (Have: {have})
                        </span>
                      </div>
                    );
                  })}
                {building.unlockRequirements.prerequisiteBuildings &&
                  building.unlockRequirements.prerequisiteBuildings.map((prereq, idx) => {
                    const prereqLevel = CityManager.getBuildingLevel(city, prereq.buildingId);
                    const prereqBuilding = prerequisiteBuildings[prereq.buildingId];
                    return (
                      <div key={idx} className="requirement-item">
                        <span className="requirement-label">Building:</span>
                        <span
                          className={
                            prereqLevel >= prereq.level ? 'requirement-met' : 'requirement-unmet'
                          }
                        >
                          {prereqBuilding?.name || prereq.buildingId} Level {prereq.level} (Current:{' '}
                          {prereqLevel})
                        </span>
                      </div>
                    );
                  })}
              </div>
              <button
                className="unlock-button"
                onClick={handleUnlock}
                disabled={!canUnlock.canUnlock}
              >
                Unlock Building
              </button>
              {!canUnlock.canUnlock && canUnlock.reason && (
                <div className="error-message">{canUnlock.reason}</div>
              )}
            </div>
          ) : (
            <div className="upgrade-section">
              {currentLevelData && (
                <div className="current-level-info">
                  <h3>Current Level {currentLevel} Bonuses</h3>
                  <div className="bonuses-list">
                    {currentLevelData.bonuses.skillMultiplier &&
                      Object.entries(currentLevelData.bonuses.skillMultiplier).map(([skillId, mult]) => {
                        const skill = dataLoader.getSkill(skillId);
                        return (
                          <div key={skillId} className="bonus-item">
                            {skill?.name || skillId}: +{((mult - 1) * 100).toFixed(0)}% XP
                          </div>
                        );
                      })}
                    {currentLevelData.bonuses.craftingSuccessRate && (
                      <div className="bonus-item">
                        Crafting Success: +{(currentLevelData.bonuses.craftingSuccessRate * 100).toFixed(0)}%
                      </div>
                    )}
                    {currentLevelData.bonuses.resourceYield && (
                      <div className="bonus-item">
                        Resource Yield: +{((currentLevelData.bonuses.resourceYield - 1) * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <div className="level-description">{currentLevelData.description}</div>
                </div>
              )}

              {nextLevelData && currentLevel < building.maxLevel && (
                <div className="next-level-info">
                  <h3>Upgrade to Level {currentLevel + 1}</h3>
                  <div className="upgrade-cost">
                    <div className="cost-item">
                      <span className="cost-label">Gold:</span>
                      <span
                        className={
                          gold >= nextLevelData.upgradeCost.gold
                            ? 'cost-met'
                            : 'cost-unmet'
                        }
                      >
                        {nextLevelData.upgradeCost.gold} (Have: {gold})
                      </span>
                    </div>
                    {nextLevelData.upgradeCost.materials &&
                      nextLevelData.upgradeCost.materials.map((material, idx) => {
                        const have = InventoryManager.getItemQuantity(inventory, material.itemId);
                        const item = dataLoader.getItem(material.itemId);
                        return (
                          <div key={idx} className="cost-item">
                            <span className="cost-label">Material:</span>
                            <span className={have >= material.quantity ? 'cost-met' : 'cost-unmet'}>
                              {material.quantity}x {item?.name || material.itemId} (Have: {have})
                            </span>
                          </div>
                        );
                      })}
                  </div>
                  <div className="next-level-description">{nextLevelData.description}</div>
                  <button
                    className="upgrade-button"
                    onClick={handleUpgrade}
                    disabled={!canUpgrade.canUpgrade}
                  >
                    Upgrade to Level {currentLevel + 1}
                  </button>
                  {!canUpgrade.canUpgrade && canUpgrade.reason && (
                    <div className="error-message">{canUpgrade.reason}</div>
                  )}
                </div>
              )}

              {currentLevel >= building.maxLevel && (
                <div className="max-level-message">Building is at maximum level!</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
