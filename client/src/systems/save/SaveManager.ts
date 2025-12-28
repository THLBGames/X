import type { SaveData } from '@idle-rpg/shared';
import { IdleSkillSystem } from '../skills/IdleSkillSystem';

const DB_NAME = 'idle-rpg-save';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const CURRENT_SAVE_VERSION = '1.0.0';

interface SaveEntry {
  id: string;
  data: SaveData;
  createdAt: number;
  updatedAt: number;
}

export class SaveManager {
  private static instance: SaveManager;
  private db: IDBDatabase | null = null;

  private constructor() {}

  static getInstance(): SaveManager {
    if (!SaveManager.instance) {
      SaveManager.instance = new SaveManager();
    }
    return SaveManager.instance;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
  }

  async save(saveData: SaveData, saveId: string = 'main'): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const entry: SaveEntry = {
      id: saveId,
      data: {
        ...saveData,
        version: CURRENT_SAVE_VERSION,
        lastSaved: Date.now(),
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Check if save exists to preserve createdAt
      const getRequest = this.db
        .transaction([STORE_NAME], 'readonly')
        .objectStore(STORE_NAME)
        .get(saveId);

      getRequest.onsuccess = () => {
        const existing = getRequest.result as SaveEntry | undefined;
        if (existing) {
          entry.createdAt = existing.createdAt;
        }

        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to save game'));
      };

      getRequest.onerror = () => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to save game'));
      };
    });
  }

  async load(saveId: string = 'main'): Promise<SaveData | null> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(saveId);

      request.onsuccess = () => {
        const entry = request.result as SaveEntry | undefined;
        if (entry) {
          // Migrate save data if needed
          const migratedData = this.migrateSaveData(entry.data);
          resolve(migratedData);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to load game'));
      };
    });
  }

  async delete(saveId: string = 'main'): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(saveId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete save'));
    });
  }

  async listSaves(): Promise<Array<{ id: string; updatedAt: number; createdAt: number }>> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('updatedAt');
      const request = index.getAll();

      request.onsuccess = () => {
        const entries = request.result as SaveEntry[];
        const saves = entries.map((entry) => ({
          id: entry.id,
          updatedAt: entry.updatedAt,
          createdAt: entry.createdAt,
        }));
        resolve(saves);
      };

      request.onerror = () => {
        reject(new Error('Failed to list saves'));
      };
    });
  }

  private migrateSaveData(saveData: SaveData): SaveData {
    // Migrate idle skills from level 0 to level 1, or initialize if missing
    const migratedCharacter = saveData.character
      ? (() => {
          const baseExp = 100;
          const expToLevel2 = IdleSkillSystem.calculateExperienceForLevel(2, baseExp);
          
          // If idleSkills is missing, initialize them
          if (!saveData.character.idleSkills) {
            return {
              ...saveData.character,
              idleSkills: IdleSkillSystem.initializeIdleSkills(),
            };
          }
          
          // Migrate existing idle skills from level 0 to level 1
          return {
            ...saveData.character,
            idleSkills: saveData.character.idleSkills.map((skill) => {
              // If skill is at level 0, upgrade it to level 1
              if (skill.level === 0) {
                return {
                  ...skill,
                  level: 1,
                  experience: 0,
                  experienceToNext: expToLevel2,
                };
              }
              return skill;
            }),
          };
        })()
      : saveData.character;

    return {
      ...saveData,
      character: migratedCharacter,
      version: CURRENT_SAVE_VERSION,
      lastSaved: saveData.lastSaved || Date.now(),
      settings: saveData.settings || {
        soundEnabled: true,
        musicEnabled: true,
        autoCombat: true,
        combatSpeed: 3,
        showDamageNumbers: true,
      },
    };
  }

  // Export save data as JSON string (for cloud sync or backup)
  async exportSave(saveId: string = 'main'): Promise<string> {
    const saveData = await this.load(saveId);
    if (!saveData) {
      throw new Error('Save not found');
    }
    return JSON.stringify(saveData, null, 2);
  }

  // Import save data from JSON string
  async importSave(jsonData: string, saveId: string = 'main'): Promise<void> {
    try {
      const saveData = JSON.parse(jsonData) as SaveData;
      const migratedData = this.migrateSaveData(saveData);
      await this.save(migratedData, saveId);
    } catch (error) {
      throw new Error('Invalid save data format');
    }
  }
}

export const getSaveManager = (): SaveManager => SaveManager.getInstance();

