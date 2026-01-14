import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import { useGameLoop } from '../hooks/useGameLoop';
import { useIdleSkills } from '../hooks/useIdleSkills';
import { audioManager } from '../systems/audio/AudioManager';
import { initializeEventListeners } from '../systems/events/GameEventListeners';
import TooltipWrapper from './TooltipWrapper';
import DungeonSelector from './DungeonSelector';
import CombatDisplay from './CombatDisplay';
import InventoryPanel from './InventoryPanel';
import SkillsPanel from './SkillsPanel';
import ShopPanel from './ShopPanel';
import QuestPanel from './QuestPanel';
import CharacterPanel from './CharacterPanel';
import EquipmentPanel from './EquipmentPanel';
import StatisticsPanel from './StatisticsPanel';
import ProgressionPanel from './ProgressionPanel';
import SettingsPanel from './SettingsPanel';
import PatchNotesModal from './PatchNotesModal';
import OnboardingModal from './OnboardingModal';
import CharacterCreation from './CharacterCreation';
import './GameView.css';

export default function GameView() {
  const character = useGameState((state) => state.character);
  const isCombatActive = useGameState((state) => state.isCombatActive);
  const settings = useGameState((state) => state.settings);
  const [activeRightPanel, setActiveRightPanel] = useState<
    'character' | 'equipment' | 'inventory' | 'skills' | 'shop' | 'quests' | 'statistics' | 'progression'
  >('character');
  const [showSettings, setShowSettings] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Initialize game loop
  useGameLoop();

  // Mount useIdleSkills globally so it's always available to resume skills after offline progress
  // This ensures skills automatically resume and continue running even when Skills panel isn't open
  // Skills will continue executing in the background regardless of which tab is active
  useIdleSkills();

  // Initialize event listeners for statistics and achievements
  useEffect(() => {
    const cleanup = initializeEventListeners();
    return cleanup;
  }, []);

  // Play background music when character exists
  useEffect(() => {
    if (character && settings.musicEnabled) {
      audioManager.playMusic('/audio/music/background.wav', true);
    } else {
      audioManager.stopMusic();
    }

    return () => {
      // Don't stop music on unmount, let it continue playing
    };
  }, [character, settings.musicEnabled]);

  // Check if onboarding should be shown (once per character creation)
  useEffect(() => {
    if (character) {
      const onboardingShown = localStorage.getItem('onboardingShown');
      // Only show if character is level 1 (new character) and onboarding hasn't been shown
      if (character.level === 1 && !onboardingShown) {
        setShowOnboarding(true);
      }
    }
  }, [character]);

  if (!character) {
    return <CharacterCreation />;
  }

  return (
    <div className={`game-view ${activeRightPanel === 'skills' ? 'skills-active' : ''}`}>
      <div className="game-header">
        <h2 className="game-title-header">Tales of Heroes, Legends & Beasts</h2>
        <button className="patch-notes-button" onClick={() => setShowPatchNotes(true)}>
          Patch Notes
        </button>
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
          <TooltipWrapper content="View your character stats and information">
            <button
              className={`panel-tab ${activeRightPanel === 'character' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('character')}
            >
              Character
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Manage your equipped items">
            <button
              className={`panel-tab ${activeRightPanel === 'equipment' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('equipment')}
            >
              Equipment
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="View and manage your inventory">
            <button
              className={`panel-tab ${activeRightPanel === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('inventory')}
            >
              Inventory
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Train idle skills and view skill details">
            <button
              className={`panel-tab ${activeRightPanel === 'skills' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('skills')}
            >
              Skills
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Buy items, rent mercenaries, and purchase upgrades">
            <button
              className={`panel-tab ${activeRightPanel === 'shop' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('shop')}
            >
              Shop
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="View and track your quest progress">
            <button
              className={`panel-tab ${activeRightPanel === 'quests' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('quests')}
            >
              Quests
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="View statistics and achievements">
            <button
              className={`panel-tab ${activeRightPanel === 'statistics' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('statistics')}
            >
              Statistics
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="View recommended actions and progression guidance">
            <button
              className={`panel-tab ${activeRightPanel === 'progression' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('progression')}
            >
              Progression
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Game settings and preferences">
            <button className="panel-tab" onClick={() => setShowSettings(true)}>
              Settings
            </button>
          </TooltipWrapper>
        </div>
        <div className="right-panel-content">
          {activeRightPanel === 'character' && <CharacterPanel />}
          {activeRightPanel === 'equipment' && <EquipmentPanel />}
          {activeRightPanel === 'inventory' && <InventoryPanel />}
          {activeRightPanel === 'shop' && <ShopPanel />}
          {activeRightPanel === 'quests' && <QuestPanel />}
          {activeRightPanel === 'statistics' && <StatisticsPanel />}
          {activeRightPanel === 'progression' && <ProgressionPanel />}
          {activeRightPanel === 'skills' && (
            <div className="skills-tab-placeholder">
              <p>Skills are displayed in the center area.</p>
              <p>Select a skill from the sidebar to view details.</p>
            </div>
          )}
        </div>
      </div>
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <PatchNotesModal isOpen={showPatchNotes} onClose={() => setShowPatchNotes(false)} />
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </div>
  );
}
