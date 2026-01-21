import { useState, useEffect } from 'react';
import { AuthService } from '../AuthService';
import './RulesConfig.css';

interface Rules {
  max_party_size: number;
  pvp_enabled: boolean;
  permadeath: boolean;
  floor_progression: {
    elimination_rules: string;
  };
  combat: {
    turn_based: boolean;
    turn_timeout_seconds: number;
  };
  rewards: {
    participation_reward: boolean;
    floor_based_rewards: boolean;
    ranking_rewards: boolean;
  };
}

export default function RulesConfig() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await AuthService.apiRequest<{ success: boolean; rules: Rules }>(
        '/api/admin/rules'
      );
      if (data.success) {
        setRules(data.rules);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!rules) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await AuthService.apiRequest('/api/admin/rules', {
        method: 'PUT',
        body: JSON.stringify({ rules }),
      });

      setSuccess('Rules saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rules');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('Are you sure you want to reset to default rules? This will discard all changes.')) {
      return;
    }
    loadRules();
  };

  const updateRules = (updates: Partial<Rules>) => {
    if (!rules) return;
    setRules({ ...rules, ...updates });
  };

  const updateNested = (path: string[], value: any) => {
    if (!rules) return;
    const newRules = { ...rules };
    let current: any = newRules;
    for (let i = 0; i < path.length - 1; i++) {
      current[path[i]] = { ...current[path[i]] };
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    setRules(newRules);
  };

  if (loading) return <div>Loading rules...</div>;
  if (!rules) return <div className="error-message">Failed to load rules</div>;

  return (
    <div className="rules-config">
      <div className="rules-config-header">
        <h2>Global Rules Configuration</h2>
        <p>Configure global labyrinth rules and defaults.</p>
      </div>

      {error && <div className="error-message">Error: {error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="rules-form">
        <div className="rules-section">
          <h3>Party Settings</h3>
          <div className="form-group">
            <label>Max Party Size:</label>
            <input
              type="number"
              min="1"
              max="10"
              value={rules.max_party_size}
              onChange={(e) => updateRules({ max_party_size: parseInt(e.target.value) })}
            />
          </div>
        </div>

        <div className="rules-section">
          <h3>Game Mode</h3>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={rules.pvp_enabled}
                onChange={(e) => updateRules({ pvp_enabled: e.target.checked })}
              />
              PvP Enabled
            </label>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={rules.permadeath}
                onChange={(e) => updateRules({ permadeath: e.target.checked })}
              />
              Permadeath
            </label>
          </div>
        </div>

        <div className="rules-section">
          <h3>Floor Progression</h3>
          <div className="form-group">
            <label>Elimination Rules:</label>
            <select
              value={rules.floor_progression.elimination_rules}
              onChange={(e) =>
                updateNested(['floor_progression', 'elimination_rules'], e.target.value)
              }
            >
              <option value="last_player_standing">Last Player Standing</option>
              <option value="last_party_standing">Last Party Standing</option>
              <option value="time_limit">Time Limit</option>
            </select>
          </div>
        </div>

        <div className="rules-section">
          <h3>Combat Settings</h3>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={rules.combat.turn_based}
                onChange={(e) => updateNested(['combat', 'turn_based'], e.target.checked)}
              />
              Turn-Based Combat
            </label>
          </div>
          <div className="form-group">
            <label>Turn Timeout (seconds):</label>
            <input
              type="number"
              min="5"
              max="300"
              value={rules.combat.turn_timeout_seconds}
              onChange={(e) =>
                updateNested(['combat', 'turn_timeout_seconds'], parseInt(e.target.value))
              }
            />
          </div>
        </div>

        <div className="rules-section">
          <h3>Reward Settings</h3>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={rules.rewards.participation_reward}
                onChange={(e) =>
                  updateNested(['rewards', 'participation_reward'], e.target.checked)
                }
              />
              Participation Reward
            </label>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={rules.rewards.floor_based_rewards}
                onChange={(e) =>
                  updateNested(['rewards', 'floor_based_rewards'], e.target.checked)
                }
              />
              Floor-Based Rewards
            </label>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={rules.rewards.ranking_rewards}
                onChange={(e) =>
                  updateNested(['rewards', 'ranking_rewards'], e.target.checked)
                }
              />
              Ranking Rewards
            </label>
          </div>
        </div>

        <div className="rules-actions">
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Rules'}
          </button>
          <button className="btn-secondary" onClick={handleReset} disabled={saving}>
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
