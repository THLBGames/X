import { useState, useEffect } from 'react';
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
  const activeAction = useGameState((state) => state.activeAction);
  const [activeRightPanel, setActiveRightPanel] = useState<'inventory' | 'skills' | 'shop'>('inventory');
  
  // Initialize game loop
  useGameLoop();
  
  // Auto-open skills panel if there's an active skill action (so skills can resume)
  useEffect(() => {
    if (activeAction && activeAction.type === 'skill' && activeRightPanel !== 'skills') {
      // Small delay to let the game initialize first
      const timeoutId = setTimeout(() => {
        console.log('Auto-opening skills panel to resume skill:', activeAction.skillId);
        setActiveRightPanel('skills');
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [activeAction, activeRightPanel]);

  if (!character) {
    return <CharacterCreation />;
  }

  return (
    <div className={`game-view ${activeRightPanel === 'skills' ? 'skills-active' : ''}`}>
      <div className="game-view-left">
        <CharacterSheet />
      </div>
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
          {activeRightPanel === 'shop' && <ShopPanel />}
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


