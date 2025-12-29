import { useState, useEffect } from 'react';
import { useGameState } from '../systems';
import type { GameSettings } from '@idle-rpg/shared';
import './SettingsPanel.css';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const settings = useGameState((state) => state.settings);
  const updateSettings = useGameState((state) => state.updateSettings);

  const [activeTab, setActiveTab] = useState<'audio' | 'combat' | 'ui' | 'gameplay'>('audio');
  const [localSettings, setLocalSettings] = useState<GameSettings>(settings);

  // Update local settings when props change
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (!isOpen) {
    return null;
  }

  const handleSettingChange = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    updateSettings({ [key]: value });
  };

  const handleResetToDefaults = () => {
    const defaultSettings: GameSettings = {
      soundEnabled: true,
      musicEnabled: true,
      autoCombat: true,
      combatSpeed: 3,
      showDamageNumbers: true,
      soundVolume: 100,
      musicVolume: 100,
      theme: 'dark',
      fontSize: 'medium',
      animationsEnabled: true,
      showTooltips: true,
      confirmItemDrop: true,
      confirmItemSell: false,
      showNotifications: true,
      autoSaveInterval: 30,
    };
    setLocalSettings(defaultSettings);
    updateSettings(defaultSettings);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="settings-modal-overlay" onClick={handleClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close-button" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'audio' ? 'active' : ''}`}
            onClick={() => setActiveTab('audio')}
          >
            Audio
          </button>
          <button
            className={`settings-tab ${activeTab === 'combat' ? 'active' : ''}`}
            onClick={() => setActiveTab('combat')}
          >
            Combat
          </button>
          <button
            className={`settings-tab ${activeTab === 'ui' ? 'active' : ''}`}
            onClick={() => setActiveTab('ui')}
          >
            UI
          </button>
          <button
            className={`settings-tab ${activeTab === 'gameplay' ? 'active' : ''}`}
            onClick={() => setActiveTab('gameplay')}
          >
            Gameplay
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'audio' && (
            <div className="settings-section">
              <div className="setting-item">
                <div className="setting-label">
                  <label>Sound Effects</label>
                  <span className="setting-description">Enable sound effects</span>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localSettings.soundEnabled ?? true}
                      onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label">
                  <label>Sound Volume</label>
                  <span className="setting-description">{localSettings.soundVolume ?? 100}%</span>
                </div>
                <div className="setting-control">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={localSettings.soundVolume ?? 100}
                    onChange={(e) =>
                      handleSettingChange('soundVolume', parseInt(e.target.value, 10))
                    }
                    className="volume-slider"
                    disabled={!localSettings.soundEnabled}
                  />
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label">
                  <label>Music</label>
                  <span className="setting-description">Enable background music</span>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localSettings.musicEnabled ?? true}
                      onChange={(e) => handleSettingChange('musicEnabled', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label">
                  <label>Music Volume</label>
                  <span className="setting-description">{localSettings.musicVolume ?? 100}%</span>
                </div>
                <div className="setting-control">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={localSettings.musicVolume ?? 100}
                    onChange={(e) =>
                      handleSettingChange('musicVolume', parseInt(e.target.value, 10))
                    }
                    className="volume-slider"
                    disabled={!localSettings.musicEnabled}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'combat' && (
            <div className="settings-section">
              <div className="setting-item">
                <div className="setting-label">
                  <label>Auto-Combat</label>
                  <span className="setting-description">Automatically execute combat turns</span>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localSettings.autoCombat ?? true}
                      onChange={(e) => handleSettingChange('autoCombat', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label">
                  <label>Combat Speed</label>
                  <span className="setting-description">{localSettings.combatSpeed ?? 3} / 5</span>
                </div>
                <div className="setting-control">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={localSettings.combatSpeed ?? 3}
                    onChange={(e) =>
                      handleSettingChange('combatSpeed', parseInt(e.target.value, 10))
                    }
                    className="speed-slider"
                  />
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label">
                  <label>Show Damage Numbers</label>
                  <span className="setting-description">Display damage numbers during combat</span>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localSettings.showDamageNumbers ?? true}
                      onChange={(e) => handleSettingChange('showDamageNumbers', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ui' && (
            <div className="settings-section">
              <div className="setting-item">
                <div className="setting-label">
                  <label>Theme</label>
                  <span className="setting-description">Choose color theme</span>
                </div>
                <div className="setting-control">
                  <select
                    value={localSettings.theme ?? 'dark'}
                    onChange={(e) =>
                      handleSettingChange('theme', e.target.value as 'dark' | 'light' | 'auto')
                    }
                    className="theme-select"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="auto">Auto (System)</option>
                  </select>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label">
                  <label>Font Size</label>
                  <span className="setting-description">Adjust text size</span>
                </div>
                <div className="setting-control">
                  <select
                    value={localSettings.fontSize ?? 'medium'}
                    onChange={(e) =>
                      handleSettingChange(
                        'fontSize',
                        e.target.value as 'small' | 'medium' | 'large'
                      )
                    }
                    className="font-size-select"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label">
                  <label>Animations</label>
                  <span className="setting-description">Enable UI animations</span>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localSettings.animationsEnabled ?? true}
                      onChange={(e) => handleSettingChange('animationsEnabled', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label">
                  <label>Show Tooltips</label>
                  <span className="setting-description">Display helpful tooltips</span>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localSettings.showTooltips ?? true}
                      onChange={(e) => handleSettingChange('showTooltips', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gameplay' && (
            <div className="settings-section">
              <div className="setting-item">
                <div className="setting-label">
                  <label>Confirm Item Drop</label>
                  <span className="setting-description">
                    Ask for confirmation before dropping items
                  </span>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localSettings.confirmItemDrop ?? true}
                      onChange={(e) => handleSettingChange('confirmItemDrop', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label">
                  <label>Confirm Item Sell</label>
                  <span className="setting-description">
                    Ask for confirmation before selling items
                  </span>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localSettings.confirmItemSell ?? false}
                      onChange={(e) => handleSettingChange('confirmItemSell', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label">
                  <label>Show Notifications</label>
                  <span className="setting-description">
                    Display achievement and level-up notifications
                  </span>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localSettings.showNotifications ?? true}
                      onChange={(e) => handleSettingChange('showNotifications', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-label">
                  <label>Auto-Save Interval</label>
                  <span className="setting-description">
                    {localSettings.autoSaveInterval === 0
                      ? 'Disabled'
                      : `Every ${localSettings.autoSaveInterval ?? 30} seconds`}
                  </span>
                </div>
                <div className="setting-control">
                  <input
                    type="number"
                    min="0"
                    max="300"
                    value={localSettings.autoSaveInterval ?? 30}
                    onChange={(e) =>
                      handleSettingChange('autoSaveInterval', parseInt(e.target.value, 10) || 0)
                    }
                    className="auto-save-input"
                  />
                  <span className="setting-unit">seconds (0 = disabled)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button className="settings-button reset-button" onClick={handleResetToDefaults}>
            Reset to Defaults
          </button>
          <button className="settings-button close-button" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
