import { useEffect, useState } from 'react';
import { useGameState } from './systems';
import { getDataLoader } from './data';
import { getSaveManager } from './systems/save';
import { IdleProgress } from './systems/idle';
import { InventoryManager } from './systems/inventory';
import GameView from './components/GameView';

function App() {
  const initialize = useGameState((state) => state.initialize);
  const character = useGameState((state) => state.character);
  const currentDungeonId = useGameState((state) => state.currentDungeonId);
  const setCharacter = useGameState((state) => state.setCharacter);
  const setInventory = useGameState((state) => state.setInventory);
  const setDungeonProgress = useGameState((state) => state.setDungeonProgress);
  const updateSettings = useGameState((state) => state.updateSettings);
  const addItem = useGameState((state) => state.addItem);
  const [isLoading, setIsLoading] = useState(true);
  const [offlineProgressApplied, setOfflineProgressApplied] = useState(false);

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
          // Use first unlocked dungeon if no current dungeon selected
          const dungeonIdForOffline = (saveData as any).currentDungeonId || (saveData.dungeonProgress.find(p => p.unlocked)?.dungeonId);
          if (saveData.lastOfflineTime && saveData.character && dungeonIdForOffline) {
            const offlineTime = Date.now() - saveData.lastOfflineTime;
            if (offlineTime > 60000) { // Only if offline for more than 1 minute
              try {
                const result = IdleProgress.processOfflineProgress(
                  saveData.character,
                  dungeonIdForOffline,
                  saveData.lastOfflineTime
                );

                // Apply offline rewards
                if (result.progress.experience > 0 || result.progress.gold > 0 || result.progress.items.length > 0) {
                  // Update character
                  saveData.character = result.character;

                  // Add gold to inventory
                  if (result.progress.gold > 0) {
                    saveData.inventory = InventoryManager.addItem(saveData.inventory, 'gold', result.progress.gold);
                  }

                  // Add items to inventory
                  for (const item of result.progress.items) {
                    saveData.inventory = InventoryManager.addItem(saveData.inventory, item.itemId, item.quantity);
                  }
                }
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
          setOfflineProgressApplied(true);
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

  // Save last offline time when component unmounts or game closes
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (character) {
        try {
          const saveManager = getSaveManager();
          const currentState = useGameState.getState();
          const saveData = {
            version: '1.0.0',
            character: currentState.character!,
            inventory: currentState.inventory,
            dungeonProgress: currentState.dungeonProgress,
            settings: currentState.settings,
            lastSaved: Date.now(),
            lastOfflineTime: Date.now(),
          };
          await saveManager.save(saveData);
        } catch (error) {
          console.error('Failed to save on exit:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [character]);

  if (isLoading) {
    return (
      <div className="app">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <GameView />
    </div>
  );
}

export default App;

