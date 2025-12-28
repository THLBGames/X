import { useState } from 'react';
import { useGameState } from '../systems';
import { useGameLoop } from '../hooks/useGameLoop';
import CharacterSheet from './CharacterSheet';
import DungeonSelector from './DungeonSelector';
import CombatDisplay from './CombatDisplay';
import InventoryPanel from './InventoryPanel';
import SkillsPanel from './SkillsPanel';
import ShopPanel from './ShopPanel';
import CharacterCreation from './CharacterCreation';
import './GameView.css';

export default function GameView() {
  const character = useGameState((state) => state.character);
  const isCombatActive = useGameState((state) => state.isCombatActive);
  const [activeRightPanel, setActiveRightPanel] = useState<'inventory' | 'skills' | 'shop'>('inventory');
  
  // Initialize game loop
  useGameLoop();

  if (!character) {
    return <CharacterCreation />;
  }

  return (
    <div className="game-view">
      <div className="game-view-left">
        <CharacterSheet />
      </div>
      <div className="game-view-center">
        <CombatDisplay />
        {!isCombatActive && <DungeonSelector />}
      </div>
      <div className="game-view-right">
        <div className="right-panel-tabs">
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
        </div>
        <div className="right-panel-content">
          {activeRightPanel === 'inventory' && <InventoryPanel />}
          {activeRightPanel === 'skills' && <SkillsPanel />}
          {activeRightPanel === 'shop' && <ShopPanel />}
        </div>
      </div>
    </div>
  );
}


