import { useState, useEffect } from 'react';
import type { FloorNode } from '@idle-rpg/shared';
import './POIInspector.css';

interface POIInspectorProps {
  node: FloorNode;
  onSave: (updates: Partial<FloorNode>) => void;
  onCancel: () => void;
}

export default function POIInspector({ node, onSave, onCancel }: POIInspectorProps) {
  const [name, setName] = useState(node.name || '');
  const [description, setDescription] = useState(node.description || '');
  const [metadata, setMetadata] = useState(node.metadata || {});
  const [isStartPoint, setIsStartPoint] = useState(node.is_start_point || false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonText, setJsonText] = useState(JSON.stringify(metadata, null, 2));
  
  // Wave combat state - derived from metadata
  const poiCombat = metadata.poi_combat || { enabled: false, waves: [] };
  const [waves, setWaves] = useState(poiCombat.waves || []);

  useEffect(() => {
    setName(node.name || '');
    setDescription(node.description || '');
    setMetadata(node.metadata || {});
    setIsStartPoint(node.is_start_point || false);
    setJsonText(JSON.stringify(node.metadata || {}, null, 2));
    
    // Sync waves state with metadata
    const poiCombatFromNode = node.metadata?.poi_combat;
    if (poiCombatFromNode?.waves) {
      setWaves(poiCombatFromNode.waves);
    } else {
      setWaves([]);
    }
  }, [node]);

  const handleSave = () => {
    let finalMetadata = metadata;
    if (showJsonEditor) {
      try {
        finalMetadata = JSON.parse(jsonText);
      } catch (err) {
        alert('Invalid JSON in metadata editor');
        return;
      }
    }

    onSave({
      name: name || null,
      description: description || null,
      metadata: finalMetadata,
      is_start_point: isStartPoint,
    });
  };

  // Wave combat configuration component
  const renderWaveCombatConfig = () => {
    const handleEnableWaveCombat = (enabled: boolean) => {
      if (enabled) {
        const initialWaves = waves.length > 0 ? waves : [{ waveNumber: 1, monsterCount: 3 }];
        setWaves(initialWaves);
        setMetadata({
          ...metadata,
          poi_combat: {
            enabled: true,
            waves: initialWaves,
          },
        });
      } else {
        const newMetadata = { ...metadata };
        delete newMetadata.poi_combat;
        setMetadata(newMetadata);
        setWaves([]);
      }
    };

    const handleAddWave = () => {
      const newWave = {
        waveNumber: waves.length + 1,
        monsterCount: 3,
      };
      const updatedWaves = [...waves, newWave];
      setWaves(updatedWaves);
      setMetadata({
        ...metadata,
        poi_combat: {
          enabled: true,
          waves: updatedWaves,
        },
      });
    };

    const handleRemoveWave = (index: number) => {
      const updatedWaves = waves.filter((_: any, i: number) => i !== index).map((w: any, i: number) => ({
        ...w,
        waveNumber: i + 1,
      }));
      setWaves(updatedWaves);
      if (updatedWaves.length > 0) {
        setMetadata({
          ...metadata,
          poi_combat: {
            enabled: true,
            waves: updatedWaves,
          },
        });
      } else {
        const newMetadata = { ...metadata };
        delete newMetadata.poi_combat;
        setMetadata(newMetadata);
      }
    };

    const handleWaveChange = (index: number, field: 'monsterCount', value: number) => {
      const updatedWaves = [...waves];
      updatedWaves[index] = { ...updatedWaves[index], [field]: value };
      setWaves(updatedWaves);
      setMetadata({
        ...metadata,
        poi_combat: {
          enabled: true,
          waves: updatedWaves,
        },
      });
    };

    return (
      <div className="wave-combat-config">
        <h5>Wave Combat Configuration</h5>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={poiCombat.enabled || false}
              onChange={(e) => handleEnableWaveCombat(e.target.checked)}
            />
            Enable Wave Combat
          </label>
          <div className="form-hint">
            When enabled, players can start wave-based combat at this node. Combat will automatically progress through waves until all enemies are defeated or the player dies.
          </div>
        </div>

        {poiCombat.enabled && (
          <div className="waves-config">
            <div className="waves-header">
              <label>Waves</label>
              <button type="button" className="btn-add-wave" onClick={handleAddWave}>
                + Add Wave
              </button>
            </div>

            {waves.length === 0 && (
              <div className="no-waves-message">
                No waves configured. Click "Add Wave" to create the first wave.
              </div>
            )}

            {waves.map((wave: any, index: number) => (
              <div key={index} className="wave-item">
                <div className="wave-header">
                  <span className="wave-number">Wave {wave.waveNumber}</span>
                  <button
                    type="button"
                    className="btn-remove-wave"
                    onClick={() => handleRemoveWave(index)}
                  >
                    Remove
                  </button>
                </div>
                <div className="wave-fields">
                  <div className="form-group">
                    <label>Monster Count</label>
                    <input
                      type="number"
                      min="1"
                      value={wave.monsterCount || 3}
                      onChange={(e) =>
                        handleWaveChange(index, 'monsterCount', parseInt(e.target.value) || 1)
                      }
                    />
                    <div className="form-hint">
                      Number of monsters that will spawn in this wave
                    </div>
                  </div>
                  <div className="form-group">
                    <label>
                      Monster Pool (Optional - JSON array)
                      {wave.monsterPool && wave.monsterPool.length > 0 && (
                        <span className="monster-pool-badge">
                          {wave.monsterPool.length} monster{wave.monsterPool.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </label>
                    {wave.monsterPool && wave.monsterPool.length > 0 && (
                      <div className="monster-pool-preview">
                        <div className="monster-pool-list">
                          {wave.monsterPool.map((monster: any, poolIndex: number) => (
                            <div key={poolIndex} className="monster-pool-item">
                              <span className="monster-id">{monster.monsterId || monster.id || 'Unknown'}</span>
                              {monster.weight !== undefined && (
                                <span className="monster-weight">Weight: {monster.weight}</span>
                              )}
                              {monster.minLevel !== undefined && (
                                <span className="monster-level">Min Level: {monster.minLevel}</span>
                              )}
                              {monster.maxLevel !== undefined && (
                                <span className="monster-level">Max Level: {monster.maxLevel}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <textarea
                      value={
                        wave.monsterPool
                          ? JSON.stringify(wave.monsterPool, null, 2)
                          : ''
                      }
                      onChange={(e) => {
                        try {
                          const pool = e.target.value.trim()
                            ? JSON.parse(e.target.value)
                            : undefined;
                          const updatedWaves = [...waves];
                          updatedWaves[index] = { ...updatedWaves[index], monsterPool: pool };
                          setWaves(updatedWaves);
                          setMetadata({
                            ...metadata,
                            poi_combat: {
                              enabled: true,
                              waves: updatedWaves,
                            },
                          });
                        } catch (err) {
                          // Invalid JSON, ignore
                        }
                      }}
                      rows={4}
                      placeholder='[{"monsterId": "goblin", "weight": 1}]'
                    />
                    <div className="form-hint">
                      Leave empty to use floor monster pool. Format: [&#123;&quot;monsterId&quot;: &quot;id&quot;, &quot;weight&quot;: 1, &quot;minLevel&quot;: 1, &quot;maxLevel&quot;: 10&#125;]
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Type-specific configuration forms
  const renderTypeSpecificForm = () => {
    switch (node.node_type) {
      case 'monster_spawner':
        return (
          <div className="type-config">
            <h5>Spawner Configuration</h5>
            <div className="form-group">
              <label>Monster Pool (JSON array)</label>
              <textarea
                value={metadata.spawner_config?.monster_pool ? JSON.stringify(metadata.spawner_config.monster_pool) : '[]'}
                onChange={(e) => {
                  try {
                    const pool = JSON.parse(e.target.value);
                    setMetadata({
                      ...metadata,
                      spawner_config: {
                        ...metadata.spawner_config,
                        monster_pool: pool,
                      },
                    });
                  } catch (err) {
                    // Invalid JSON, ignore
                  }
                }}
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Spawn Rate (seconds)</label>
              <input
                type="number"
                value={metadata.spawner_config?.spawn_rate || 300}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    spawner_config: {
                      ...metadata.spawner_config,
                      spawn_rate: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>Max Spawns</label>
              <input
                type="number"
                value={metadata.spawner_config?.max_spawns || 5}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    spawner_config: {
                      ...metadata.spawner_config,
                      max_spawns: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
            {renderWaveCombatConfig()}
          </div>
        );

      case 'monster_spawn':
        return (
          <div className="type-config">
            <h5>Monster Spawn Configuration</h5>
            {/* Show regular monster pool if present (for non-POI combat nodes) */}
            {metadata.monster_pool && metadata.monster_pool.length > 0 && !metadata.poi_combat?.enabled && (
              <div className="form-group">
                <label>
                  Monster Pool (Regular Combat)
                  <span className="monster-pool-badge">
                    {metadata.monster_pool.length} monster{metadata.monster_pool.length !== 1 ? 's' : ''}
                  </span>
                </label>
                <div className="monster-pool-preview">
                  <div className="monster-pool-list">
                    {metadata.monster_pool.map((monster: any, poolIndex: number) => (
                      <div key={poolIndex} className="monster-pool-item">
                        <span className="monster-id">{monster.monsterId || monster.id || 'Unknown'}</span>
                        {monster.weight !== undefined && (
                          <span className="monster-weight">Weight: {monster.weight}</span>
                        )}
                        {monster.minLevel !== undefined && (
                          <span className="monster-level">Min Level: {monster.minLevel}</span>
                        )}
                        {monster.maxLevel !== undefined && (
                          <span className="monster-level">Max Level: {monster.maxLevel}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <textarea
                  value={JSON.stringify(metadata.monster_pool, null, 2)}
                  onChange={(e) => {
                    try {
                      const pool = e.target.value.trim() ? JSON.parse(e.target.value) : undefined;
                      setMetadata({
                        ...metadata,
                        monster_pool: pool,
                      });
                    } catch (err) {
                      // Invalid JSON, ignore
                    }
                  }}
                  rows={4}
                  placeholder='[{"monsterId": "goblin", "weight": 1}]'
                />
                <div className="form-hint">
                  Monster pool for regular combat at this node. Format: [&#123;&quot;monsterId&quot;: &quot;id&quot;, &quot;weight&quot;: 1, &quot;minLevel&quot;: 1, &quot;maxLevel&quot;: 10&#125;]
                </div>
              </div>
            )}
            {renderWaveCombatConfig()}
          </div>
        );

      case 'boss':
        return (
          <div className="type-config">
            <h5>Boss Configuration</h5>
            <div className="form-group">
              <label>Boss Monster ID</label>
              <input
                type="text"
                value={metadata.boss_config?.monster_id || ''}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    boss_config: {
                      ...metadata.boss_config,
                      monster_id: e.target.value,
                    },
                  })
                }
                placeholder="e.g., balrog"
              />
            </div>
            <div className="form-group">
              <label>Required for Stairs</label>
              <input
                type="checkbox"
                checked={!!metadata.boss_config?.required_for_stairs}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    boss_config: {
                      ...metadata.boss_config,
                      required_for_stairs: e.target.checked,
                    },
                  })
                }
              />
            </div>
          </div>
        );

      case 'safe_zone':
        return (
          <div className="type-config">
            <h5>Safe Zone Configuration</h5>
            <div className="form-group">
              <label>Healing Rate (HP/second)</label>
              <input
                type="number"
                value={metadata.safe_zone_config?.healing_rate || 10}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    safe_zone_config: {
                      ...metadata.safe_zone_config,
                      healing_rate: parseFloat(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>Allows Trading</label>
              <input
                type="checkbox"
                checked={!!metadata.safe_zone_config?.allows_trading}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    safe_zone_config: {
                      ...metadata.safe_zone_config,
                      allows_trading: e.target.checked,
                    },
                  })
                }
              />
            </div>
          </div>
        );

      case 'crafting':
        return (
          <div className="type-config">
            <h5>Crafting Configuration</h5>
            <div className="form-group">
              <label>Crafting Type</label>
              <select
                value={metadata.crafting_config?.type || 'smithing'}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    crafting_config: {
                      ...metadata.crafting_config,
                      type: e.target.value,
                    },
                  })
                }
              >
                <option value="smithing">Smithing</option>
                <option value="alchemy">Alchemy</option>
                <option value="cooking">Cooking</option>
                <option value="enchanting">Enchanting</option>
              </select>
            </div>
          </div>
        );

      case 'stairs':
        return (
          <div className="type-config">
            <h5>Stairs Configuration</h5>
            <div className="form-group">
              <label>Target Floor Number</label>
              <input
                type="number"
                value={node.leads_to_floor_number || ''}
                onChange={(e) =>
                  onSave({
                    leads_to_floor_number: parseInt(e.target.value) || null,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>Capacity Limit (null = unlimited)</label>
              <input
                type="number"
                value={node.capacity_limit || ''}
                onChange={(e) =>
                  onSave({
                    capacity_limit: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Leave empty for unlimited"
              />
            </div>
          </div>
        );

      case 'guild_hall':
        return (
          <div className="type-config">
            <h5>Guild Hall Configuration</h5>
            <div className="form-group">
              <label>Has Trading Post</label>
              <input
                type="checkbox"
                checked={!!metadata.guild_hall_config?.has_trading_post}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    guild_hall_config: {
                      ...metadata.guild_hall_config,
                      has_trading_post: e.target.checked,
                    },
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>Has Quest Board</label>
              <input
                type="checkbox"
                checked={!!metadata.guild_hall_config?.has_quest_board}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    guild_hall_config: {
                      ...metadata.guild_hall_config,
                      has_quest_board: e.target.checked,
                    },
                  })
                }
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="poi-inspector">
      <div className="inspector-header">
        <h4>{node.name || `Node ${node.id.slice(0, 8)}`}</h4>
        <span className="node-type-badge">{node.node_type}</span>
      </div>

      <div className="inspector-content">
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter node name"
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Enter node description"
          />
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={isStartPoint}
              onChange={(e) => setIsStartPoint(e.target.checked)}
            />
            Mark as Start Point
          </label>
          <div className="form-hint">
            Players will randomly spawn at one of the nodes marked as start points when entering this floor.
          </div>
        </div>

        {renderTypeSpecificForm()}

        <div className="form-group">
          <label>
            Metadata (JSON)
            <button
              type="button"
              className="toggle-json"
              onClick={() => setShowJsonEditor(!showJsonEditor)}
            >
              {showJsonEditor ? 'Hide' : 'Show'} Editor
            </button>
          </label>
          {showJsonEditor ? (
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={8}
              className="json-editor"
            />
          ) : (
            <div className="json-preview">
              {Object.keys(metadata).length} metadata keys
            </div>
          )}
        </div>

        <div className="form-actions">
          <button className="btn-save" onClick={handleSave}>
            Save Changes
          </button>
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
