import { useState, useMemo, useEffect } from 'react';
import { useGameState } from '../systems';
import { CityManager } from '../systems/city/CityManager';
import type { Building } from '@idle-rpg/shared';
import BuildingDetailModal from './BuildingDetailModal';
import './CityPanel.css';

export default function CityPanel() {
  const character = useGameState((state) => state.character);
  const inventory = useGameState((state) => state.inventory);
  const unlockBuilding = useGameState((state) => state.unlockBuilding);
  const upgradeBuilding = useGameState((state) => state.upgradeBuilding);

  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [availableBuildings, setAvailableBuildings] = useState<Building[]>([]);

  // Load buildings
  useEffect(() => {
    const loadBuildings = async () => {
      const allBuildings = await CityManager.getAllBuildings();
      setBuildings(allBuildings);
      
      if (character) {
        const available = await CityManager.getAvailableBuildings(character);
        setAvailableBuildings(available);
      }
    };
    loadBuildings();
  }, [character]);

  if (!character) {
    return <div className="city-panel">No character loaded</div>;
  }

  const city = character.city || CityManager.initializeCity();

  // Get building progress for all buildings
  const buildingProgress = useMemo(() => {
    const progress: Record<string, { level: number; unlocked: boolean }> = {};
    for (const building of buildings) {
      const level = CityManager.getBuildingLevel(city, building.id);
      progress[building.id] = {
        level,
        unlocked: level > 0,
      };
    }
    return progress;
  }, [buildings, city]);

  // Categorize buildings
  const coreBuildings = buildings.filter((b) => b.category === 'core');
  const expandedBuildings = buildings.filter((b) => b.category === 'expanded');
  const specializedBuildings = buildings.filter((b) => b.category === 'specialized');

  const handleBuildingClick = async (building: Building) => {
    const buildingData = await CityManager.getBuilding(building.id);
    if (buildingData) {
      setSelectedBuilding(buildingData);
      setShowBuildingModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowBuildingModal(false);
    setSelectedBuilding(null);
  };

  const BuildingCard = ({ building }: { building: Building }) => {
    const progress = buildingProgress[building.id];
    const isUnlocked = progress?.unlocked || false;
    const level = progress?.level || 0;

    return (
      <div
        className={`building-card ${isUnlocked ? 'unlocked' : 'locked'}`}
        onClick={() => handleBuildingClick(building)}
      >
        <div className="building-header">
          <h3 className="building-name">{building.name}</h3>
          {isUnlocked && <div className="building-level">Level {level}/{building.maxLevel}</div>}
        </div>
        <div className="building-description">{building.description}</div>
        {!isUnlocked && (
          <div className="building-locked">Locked - Click to view requirements</div>
        )}
        {isUnlocked && level < building.maxLevel && (
          <div className="building-upgradeable">Can be upgraded</div>
        )}
        {isUnlocked && level >= building.maxLevel && (
          <div className="building-maxed">Max Level</div>
        )}
      </div>
    );
  };

  const BuildingSection = ({
    title,
    buildings: sectionBuildings,
  }: {
    title: string;
    buildings: Building[];
  }) => {
    if (sectionBuildings.length === 0) return null;

    return (
      <div className="building-section">
        <h2 className="section-title">{title}</h2>
        <div className="buildings-grid">
          {sectionBuildings.map((building) => (
            <BuildingCard key={building.id} building={building} />
          ))}
        </div>
      </div>
    );
  };

  const totalBuildings = city.buildings.length;
  const totalLevels = city.buildings.reduce((sum, bp) => sum + bp.level, 0);

  return (
    <div className="city-panel">
      <div className="city-header">
        <h2>City Management</h2>
        <div className="city-stats">
          <div className="stat-item">
            <span className="stat-label">Buildings:</span>
            <span className="stat-value">{totalBuildings}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Levels:</span>
            <span className="stat-value">{totalLevels}</span>
          </div>
        </div>
      </div>

      <div className="city-content">
        <BuildingSection title="Core Buildings" buildings={coreBuildings} />
        <BuildingSection title="Expanded Buildings" buildings={expandedBuildings} />
        <BuildingSection title="Specialized Buildings" buildings={specializedBuildings} />
      </div>

      {showBuildingModal && selectedBuilding && (
        <BuildingDetailModal
          isOpen={showBuildingModal}
          onClose={handleCloseModal}
          building={selectedBuilding}
          character={character}
          inventory={inventory}
        />
      )}
    </div>
  );
}
