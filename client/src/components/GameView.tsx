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
import ChroniclePanel from './ChroniclePanel';
import CityPanel from './CityPanel';
import GuildPanel from './GuildPanel';
import VendorPanel from './VendorPanel';
import LabyrinthPanel from './LabyrinthPanel';
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
    'character' | 'equipment' | 'inventory' | 'skills' | 'shop' | 'quests' | 'statistics' | 'progression' | 'chronicle' | 'city' | 'guilds' | 'vendors' | 'labyrinth'
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

  // Determine which panels should show in center area
  const centerPanels: Array<typeof activeRightPanel> = ['skills', 'shop', 'chronicle', 'city', 'guilds', 'vendors', 'inventory'];
  const isCenterPanel = centerPanels.includes(activeRightPanel);

  return (
    <div className={`game-view ${isCenterPanel ? 'center-panel-active' : ''}`}>
      <div className="game-header">
        <h2 className="game-title-header">Tales of Heroes, Legends & Beasts</h2>
        <button className="patch-notes-button" onClick={() => setShowPatchNotes(true)}>
          Patch Notes
        </button>
      </div>
      <div className="game-view-center">
        {activeRightPanel === 'skills' ? (
          <SkillsPanel />
        ) : activeRightPanel === 'shop' ? (
          <ShopPanel />
        ) : activeRightPanel === 'chronicle' ? (
          <ChroniclePanel />
        ) : activeRightPanel === 'city' ? (
          <CityPanel />
        ) : activeRightPanel === 'guilds' ? (
          <GuildPanel />
        ) : activeRightPanel === 'vendors' ? (
          <VendorPanel />
        ) : activeRightPanel === 'labyrinth' ? (
          <LabyrinthPanel />
        ) : activeRightPanel === 'inventory' ? (
          <InventoryPanel />
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
          <TooltipWrapper content="View your character's story and legend titles">
            <button
              className={`panel-tab ${activeRightPanel === 'chronicle' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('chronicle')}
            >
              Chronicle
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Manage your city and buildings">
            <button
              className={`panel-tab ${activeRightPanel === 'city' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('city')}
            >
              City
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Join and manage guilds">
            <button
              className={`panel-tab ${activeRightPanel === 'guilds' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('guilds')}
            >
              Guilds
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Shop from building and guild vendors">
            <button
              className={`panel-tab ${activeRightPanel === 'vendors' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('vendors')}
            >
              Vendors
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Join multiplayer labyrinth challenges">
            <button
              className={`panel-tab ${activeRightPanel === 'labyrinth' ? 'active' : ''}`}
              onClick={() => setActiveRightPanel('labyrinth')}
            >
              Labyrinth
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
          {activeRightPanel === 'quests' && <QuestPanel />}
          {activeRightPanel === 'statistics' && <StatisticsPanel />}
          {activeRightPanel === 'progression' && <ProgressionPanel />}
          {isCenterPanel && (
            <div className="center-panel-placeholder">
              {activeRightPanel === 'skills' && (
                <p>Skills are displayed in the center area. Select a skill from the sidebar to view details.</p>
              )}
              {activeRightPanel === 'shop' && <p>Shop is displayed in the center area.</p>}
              {activeRightPanel === 'chronicle' && <p>Chronicle is displayed in the center area.</p>}
              {activeRightPanel === 'city' && <p>City management is displayed in the center area.</p>}
              {activeRightPanel === 'guilds' && <p>Guilds are displayed in the center area.</p>}
              {activeRightPanel === 'vendors' && <p>Vendors are displayed in the center area.</p>}
              {activeRightPanel === 'labyrinth' && <p>Labyrinth is displayed in the center area.</p>}
              {activeRightPanel === 'inventory' && <p>Inventory is displayed in the center area.</p>}
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
