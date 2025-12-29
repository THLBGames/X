import { useEffect, useState } from 'react';
import { useGameState } from './systems';
import { getDataLoader } from './data';
import { getSaveManager } from './systems/save';
import { IdleProgress } from './systems/idle';
import { InventoryManager } from './systems/inventory';
import { StatisticsManager } from './systems/statistics/StatisticsManager';
import { audioManager } from './systems/audio/AudioManager';
import GameView from './components/GameView';
import DebugPanel from './components/DebugPanel';
import OfflineProgressModal from './components/OfflineProgressModal';
import NotificationManager, { showNotification } from './components/NotificationManager';

// Declare global window interface for debug panel
declare global {
  interface Window {
    openDebugPanel: () => void;
  }
}

function App() {
  const initialize = useGameState((state) => state.initialize);
  const character = useGameState((state) => state.character);
  const setCharacter = useGameState((state) => state.setCharacter);
  const setInventory = useGameState((state) => state.setInventory);
  const setDungeonProgress = useGameState((state) => state.setDungeonProgress);
  const updateSettings = useGameState((state) => state.updateSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState<{
    hoursOffline: number;
    progress: {
      combatsCompleted?: number;
      actionsCompleted?: number;
      experience: number;
      gold: number;
      items: Array<{ itemId: string; quantity: number }>;
      died?: boolean;
    };
    actionType: 'combat' | 'skill' | null;
  } | null>(null);

  // Track play time
  useEffect(() => {
    if (!character) return;

    const interval = setInterval(() => {
      const updatePlayTime = () => {
        const state = useGameState.getState();
        if (!state.character || !state.character.statistics) return;

        const statistics = state.character.statistics;
        const updatedStatistics = StatisticsManager.updatePlayTime(statistics, 60); // Update every minute (60 seconds)

        state.setCharacter({
          ...state.character,
          statistics: updatedStatistics,
        });
      };

      updatePlayTime();
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [character]);

  useEffect(() => {
    // Initialize data loader and load save data
    const init = async () => {
      try {
        // Load game data
        const dataLoader = getDataLoader();
        await dataLoader.loadAll();

        // Try to load existing save
        const saveManager = getSaveManager();
        await saveManager.initialize();
        const saveData = await saveManager.load();

        if (saveData) {
          // Calculate offline progress if applicable
          const activeAction = saveData.activeAction ?? null;
          const maxOfflineHours = saveData.maxOfflineHours ?? 8;

          if (saveData.lastOfflineTime && saveData.character && activeAction) {
            const offlineTime = Date.now() - saveData.lastOfflineTime;
            console.log('Offline progress check:', {
              lastOfflineTime: saveData.lastOfflineTime,
              currentTime: Date.now(),
              offlineTimeMs: offlineTime,
              offlineTimeMinutes: offlineTime / 60000,
              activeAction,
            });
            if (offlineTime > 60000) {
              // Only if offline for more than 1 minute
              try {
                const result = IdleProgress.processOfflineActionProgress(
                  saveData.character,
                  activeAction,
                  offlineTime,
                  maxOfflineHours
                );
                console.log('Offline progress result:', result.progress);

                // Always show offline progress modal, even if no progress was made
                // Update character
                saveData.character = result.character;

                // Add gold to inventory
                if (result.progress.gold > 0) {
                  saveData.inventory = InventoryManager.addItem(
                    saveData.inventory,
                    'gold',
                    result.progress.gold
                  );
                }

                // Add items to inventory (load items on-demand if needed)
                for (const item of result.progress.items) {
                  try {
                    // Ensure item is loaded before adding
                    const itemData = dataLoader.getItem(item.itemId);
                    if (!itemData) {
                      // Try loading it on-demand
                      await dataLoader.loadItem(item.itemId);
                    }
                    saveData.inventory = InventoryManager.addItem(
                      saveData.inventory,
                      item.itemId,
                      item.quantity
                    );
                  } catch (error) {
                    console.warn(`Failed to add item ${item.itemId} to inventory:`, error);
                    // Continue with other items even if one fails
                  }
                }

                // Clear active action if player died in combat
                if (result.progress.died) {
                  saveData.activeAction = null;
                }

                // Show offline progress modal (always show, even with 0 progress)
                const hoursOffline = offlineTime / (1000 * 60 * 60);
                setOfflineProgress({
                  hoursOffline,
                  progress: result.progress,
                  actionType: activeAction.type,
                });
              } catch (error) {
                console.error('Failed to process offline progress:', error);
              }
            }
          }

          // Initialize with saved data (potentially updated with offline progress)
          setCharacter(saveData.character);
          setInventory(saveData.inventory);
          setDungeonProgress(saveData.dungeonProgress);
          updateSettings(saveData.settings);
          initialize(saveData);

          // Note: Skill resumption is handled by useIdleSkills hook when SkillDetailView mounts
          // This ensures skills resume when the player opens the skills panel
        } else {
          // No save data, initialize empty
          initialize();
        }
      } catch (error) {
        console.error('Failed to initialize game:', error);
        // Initialize anyway with empty state
        initialize();
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [initialize, setCharacter, setInventory, setDungeonProgress, updateSettings]);

  // Expose debug panel via window API
  useEffect(() => {
    // Set up window API function
    window.openDebugPanel = () => {
      setShowDebugPanel(true);
    };

    // Cleanup on unmount
    return () => {
      delete (window as any).openDebugPanel;
    };
  }, []);

  const settings = useGameState((state) => state.settings);

  // Initialize audio manager
  useEffect(() => {
    audioManager.initialize();
    return () => {
      audioManager.cleanup();
    };
  }, []);

  // Update audio settings when they change
  useEffect(() => {
    audioManager.updateSettings(settings);
  }, [settings.soundEnabled, settings.musicEnabled, settings.soundVolume, settings.musicVolume]);

  // Apply theme to root element (must be before early returns)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-auto');

    if (settings.theme === 'auto') {
      root.classList.add('theme-auto');
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
    } else {
      root.classList.add(`theme-${settings.theme || 'dark'}`);
    }
  }, [settings.theme]);

  // Apply font size to root element (must be before early returns)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    root.classList.add(`font-size-${settings.fontSize || 'medium'}`);
  }, [settings.fontSize]);

  // Apply animations setting (must be before early returns)
  useEffect(() => {
    const root = document.documentElement;
    if (settings.animationsEnabled === false) {
      root.classList.add('no-animations');
    } else {
      root.classList.remove('no-animations');
    }
  }, [settings.animationsEnabled]);

  // Save periodically and on close
  useEffect(() => {
    if (!character) return;

    const autoSaveInterval = settings.autoSaveInterval || 30;

    // Skip if auto-save is disabled
    if (autoSaveInterval === 0) {
      return;
    }

    // Periodic save based on settings
    const periodicSave = setInterval(async () => {
      try {
        const saveManager = getSaveManager();
        const currentState = useGameState.getState();
        if (currentState.character) {
          const saveData = {
            version: '1.0.0',
            character: currentState.character,
            inventory: currentState.inventory,
            dungeonProgress: currentState.dungeonProgress,
            settings: currentState.settings,
            lastSaved: Date.now(),
            lastOfflineTime: Date.now(), // Update lastOfflineTime periodically
            activeAction: currentState.activeAction ?? null,
            maxOfflineHours: currentState.maxOfflineHours ?? 8,
          };
          await saveManager.save(saveData);
          console.log('Periodic save completed, activeAction:', saveData.activeAction);
        }
      } catch (error) {
        console.error('Failed to save:', error);
      }
    }, autoSaveInterval * 1000); // Use setting value in seconds

    // Save on close
    const handleBeforeUnload = async () => {
      try {
        const saveManager = getSaveManager();
        const currentState = useGameState.getState();
        if (currentState.character) {
          const saveData = {
            version: '1.0.0',
            character: currentState.character,
            inventory: currentState.inventory,
            dungeonProgress: currentState.dungeonProgress,
            settings: currentState.settings,
            lastSaved: Date.now(),
            lastOfflineTime: Date.now(),
            activeAction: currentState.activeAction ?? null,
            maxOfflineHours: currentState.maxOfflineHours ?? 8,
          };
          await saveManager.save(saveData);
        }
      } catch (error) {
        console.error('Failed to save on exit:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      clearInterval(periodicSave);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Try to save one more time on cleanup
      handleBeforeUnload();
    };
  }, [character, settings.autoSaveInterval]);

  // Listen for notification events (must be before early returns)
  useEffect(() => {
    const handleNotification = (event: CustomEvent) => {
      showNotification(event.detail.message, event.detail.type, event.detail.duration);
    };

    window.addEventListener('showNotification' as any, handleNotification as EventListener);
    return () => {
      window.removeEventListener('showNotification' as any, handleNotification as EventListener);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="app">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
          }}
        >
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <GameView />
      <NotificationManager />
      <DebugPanel isOpen={showDebugPanel} onClose={() => setShowDebugPanel(false)} />
      {offlineProgress && (
        <OfflineProgressModal
          isOpen={true}
          onClose={() => setOfflineProgress(null)}
          hoursOffline={offlineProgress.hoursOffline}
          progress={offlineProgress.progress}
          actionType={offlineProgress.actionType}
        />
      )}
    </div>
  );
}

export default App;
