import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import { useGameLoop } from '../hooks/useGameLoop';
import { useIdleSkills } from '../hooks/useIdleSkills';
import DungeonSelector from './DungeonSelector';
import CombatDisplay from './CombatDisplay';
import InventoryPanel from './InventoryPanel';
import SkillsPanel from './SkillsPanel';
import ShopPanel from './ShopPanel';
import QuestPanel from './QuestPanel';
import CharacterPanel from './CharacterPanel';
import EquipmentPanel from './EquipmentPanel';
import StatisticsPanel from './StatisticsPanel';
import CharacterCreation from './CharacterCreation';
import './GameView.css';

export default function GameView() {
  const character = useGameState((state) => state.character);
  const isCombatActive = useGameState((state) => state.isCombatActive);
  const activeAction = useGameState((state) => state.activeAction);
  const [activeRightPanel, setActiveRightPanel] = useState<
    'character' | 'equipment' | 'inventory' | 'skills' | 'shop' | 'quests' | 'statistics'
  >('character');

  // Initialize game loop
  useGameLoop();

  // Mount useIdleSkills globally so it's always available to resume skills after offline progress
  // This ensures skills automatically resume and continue running even when Skills panel isn't open
  // Skills will continue executing in the background regardless of which tab is active
  useIdleSkills();

  if (!character) {
    return <CharacterCreation />;
  }

  return (
    <div className={`game-view ${activeRightPanel === 'skills' ? 'skills-active' : ''}`}>
      <div className="game-view-center">
        {activeRightPanel === 'skills' ? (
          <SkillsPanel />
        ) : (
          <>
            <CombatDisplay />
            {!isCombatActive && <DungeonSelector />}
          </>
        )}
      </div>
      <div className="game-view-right">
        <div className="right-panel-tabs">
          <button
            className={`panel-tab ${activeRightPanel === 'character' ? 'active' : ''}`}
            onClick={() => setActiveRightPanel('character')}
          >
            Character
          </button>
          <button
            className={`panel-tab ${activeRightPanel === 'equipment' ? 'active' : ''}`}
            onClick={() => setActiveRightPanel('equipment')}
          >
            Equipment
          </button>
          <button
            className={`panel-tab ${activeRightPanel === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveRightPanel('inventory')}
          >
            Inventory
          </button>
          <button
            className={`panel-tab ${activeRightPanel === 'skills' ? 'active' : ''}`}
            onClick={() => setActiveRightPanel('skills')}
          >
            Skills
          </button>
          <button
            className={`panel-tab ${activeRightPanel === 'shop' ? 'active' : ''}`}
            onClick={() => setActiveRightPanel('shop')}
          >
            Shop
          </button>
          <button
            className={`panel-tab ${activeRightPanel === 'quests' ? 'active' : ''}`}
            onClick={() => setActiveRightPanel('quests')}
          >
            Quests
          </button>
          <button
            className={`panel-tab ${activeRightPanel === 'statistics' ? 'active' : ''}`}
            onClick={() => setActiveRightPanel('statistics')}
          >
            Statistics
          </button>
        </div>
        <div className="right-panel-content">
          {activeRightPanel === 'character' && <CharacterPanel />}
          {activeRightPanel === 'equipment' && <EquipmentPanel />}
          {activeRightPanel === 'inventory' && <InventoryPanel />}
          {activeRightPanel === 'shop' && <ShopPanel />}
          {activeRightPanel === 'quests' && <QuestPanel />}
          {activeRightPanel === 'statistics' && <StatisticsPanel />}
          {activeRightPanel === 'skills' && (
            <div className="skills-tab-placeholder">
              <p>Skills are displayed in the center area.</p>
              <p>Select a skill from the sidebar to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
