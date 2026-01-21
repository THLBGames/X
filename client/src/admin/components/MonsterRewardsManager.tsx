import { useState, useEffect } from 'react';
import { AuthService } from '../AuthService';
import './MonsterRewardsManager.css';

interface MonsterReward {
  id?: string;
  monster_id: string;
  reward_type: 'item' | 'gold' | 'experience' | 'title' | 'achievement';
  reward_id: string;
  quantity?: number;
  chance: number;
  min_quantity?: number;
  max_quantity?: number;
}

interface Monster {
  id: string;
  name: string;
}

interface Labyrinth {
  id: string;
  name: string;
}

interface Floor {
  id: string;
  floor_number: number;
  labyrinth_id: string;
}

export default function MonsterRewardsManager() {
  const [activeTab, setActiveTab] = useState<'global' | 'floor'>('global');
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [labyrinths, setLabyrinths] = useState<Labyrinth[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedMonster, setSelectedMonster] = useState<string>('');
  const [selectedLabyrinth, setSelectedLabyrinth] = useState<string>('');
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [rewards, setRewards] = useState<MonsterReward[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingReward, setEditingReward] = useState<MonsterReward | null>(null);
  const [showRewardForm, setShowRewardForm] = useState(false);

  useEffect(() => {
    loadMonsters();
    loadLabyrinths();
  }, []);

  useEffect(() => {
    if (activeTab === 'global' && selectedMonster) {
      loadGlobalRewards();
    } else if (activeTab === 'floor' && selectedFloor && selectedMonster) {
      loadFloorRewards();
    } else {
      setRewards([]);
    }
  }, [activeTab, selectedMonster, selectedFloor]);

  useEffect(() => {
    if (selectedLabyrinth) {
      loadFloors();
    } else {
      setFloors([]);
      setSelectedFloor('');
    }
  }, [selectedLabyrinth]);

  const loadMonsters = async () => {
    try {
      const data = await AuthService.apiRequest<{ success: boolean; monsters: Monster[] }>(
        '/api/admin/monsters'
      );
      if (data.success) {
        setMonsters(data.monsters);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monsters');
    }
  };

  const loadLabyrinths = async () => {
    try {
      const data = await AuthService.apiRequest<{ success: boolean; labyrinths: Labyrinth[] }>(
        '/api/admin/labyrinths'
      );
      if (data.success) {
        setLabyrinths(data.labyrinths);
      }
    } catch (err) {
      console.error('Failed to load labyrinths:', err);
    }
  };

  const loadFloors = async () => {
    if (!selectedLabyrinth) return;
    try {
      const data = await AuthService.apiRequest<{ success: boolean; floors: Floor[] }>(
        `/api/admin/labyrinths/${selectedLabyrinth}`
      );
      if (data.success) {
        setFloors(data.floors || []);
      }
    } catch (err) {
      console.error('Failed to load floors:', err);
    }
  };

  const loadGlobalRewards = async () => {
    if (!selectedMonster) return;
    try {
      setLoading(true);
      const data = await AuthService.apiRequest<{ success: boolean; rewards: MonsterReward[] }>(
        `/api/admin/monster-rewards?monster_id=${selectedMonster}`
      );
      if (data.success) {
        setRewards(data.rewards);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const loadFloorRewards = async () => {
    if (!selectedFloor || !selectedMonster) return;
    try {
      setLoading(true);
      const data = await AuthService.apiRequest<{ success: boolean; rewards: MonsterReward[] }>(
        `/api/admin/monster-rewards/floors/${selectedFloor}`
      );
      if (data.success) {
        // Filter rewards for selected monster
        const filtered = data.rewards.filter((r) => r.monster_id === selectedMonster);
        setRewards(filtered);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load floor rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReward = async (reward: MonsterReward) => {
    try {
      setLoading(true);
      if (activeTab === 'global') {
        // Get all rewards for this monster, update the list, then save all
        const updatedRewards = editingReward
          ? rewards.map((r) =>
              r.reward_type === editingReward.reward_type &&
              r.reward_id === editingReward.reward_id &&
              r.monster_id === editingReward.monster_id
                ? reward
                : r
            )
          : [...rewards, reward];

        await AuthService.apiRequest(`/api/admin/monster-rewards/${selectedMonster}`, {
          method: 'PUT',
          body: JSON.stringify({ rewards: updatedRewards }),
        });
      } else {
        // Floor-specific rewards
        const updatedRewards = editingReward
          ? rewards.map((r) =>
              r.reward_type === editingReward.reward_type &&
              r.reward_id === editingReward.reward_id &&
              r.monster_id === editingReward.monster_id
                ? reward
                : r
            )
          : [...rewards, reward];

        await AuthService.apiRequest(
          `/api/admin/monster-rewards/floors/${selectedFloor}/${selectedMonster}`,
          {
            method: 'PUT',
            body: JSON.stringify({ rewards: updatedRewards }),
          }
        );
      }
      setShowRewardForm(false);
      setEditingReward(null);
      if (activeTab === 'global') {
        loadGlobalRewards();
      } else {
        loadFloorRewards();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save reward');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReward = async (reward: MonsterReward) => {
    if (!confirm('Are you sure you want to delete this reward?')) return;

    try {
      setLoading(true);
      const updatedRewards = rewards.filter(
        (r) =>
          !(
            r.reward_type === reward.reward_type &&
            r.reward_id === reward.reward_id &&
            r.monster_id === reward.monster_id
          )
      );

      if (activeTab === 'global') {
        await AuthService.apiRequest(`/api/admin/monster-rewards/${selectedMonster}`, {
          method: 'PUT',
          body: JSON.stringify({ rewards: updatedRewards }),
        });
        loadGlobalRewards();
      } else {
        await AuthService.apiRequest(
          `/api/admin/monster-rewards/floors/${selectedFloor}/${selectedMonster}`,
          {
            method: 'PUT',
            body: JSON.stringify({ rewards: updatedRewards }),
          }
        );
        loadFloorRewards();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete reward');
    } finally {
      setLoading(false);
    }
  };

  const handleEditReward = (reward: MonsterReward) => {
    setEditingReward(reward);
    setShowRewardForm(true);
  };

  const handleAddReward = () => {
    if (!selectedMonster) {
      alert('Please select a monster first');
      return;
    }
    if (activeTab === 'floor' && !selectedFloor) {
      alert('Please select a floor first');
      return;
    }
    setEditingReward(null);
    setShowRewardForm(true);
  };

  return (
    <div className="monster-rewards-manager">
      <div className="monster-rewards-header">
        <h2>Monster Rewards Configuration</h2>
        <p>Configure global and floor-specific monster rewards.</p>
      </div>

      <div className="rewards-tabs">
        <button
          className={activeTab === 'global' ? 'active' : ''}
          onClick={() => setActiveTab('global')}
        >
          Global Rewards
        </button>
        <button
          className={activeTab === 'floor' ? 'active' : ''}
          onClick={() => setActiveTab('floor')}
        >
          Floor-Specific Rewards
        </button>
      </div>

      <div className="rewards-filters">
        {activeTab === 'global' ? (
          <div className="filter-group">
            <label>Monster:</label>
            <select
              value={selectedMonster}
              onChange={(e) => setSelectedMonster(e.target.value)}
              className="monster-select"
            >
              <option value="">Select a monster...</option>
              {monsters.map((monster) => (
                <option key={monster.id} value={monster.id}>
                  {monster.name} ({monster.id})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="filter-group">
              <label>Labyrinth:</label>
              <select
                value={selectedLabyrinth}
                onChange={(e) => {
                  setSelectedLabyrinth(e.target.value);
                  setSelectedFloor('');
                }}
                className="labyrinth-select"
              >
                <option value="">Select a labyrinth...</option>
                {labyrinths.map((labyrinth) => (
                  <option key={labyrinth.id} value={labyrinth.id}>
                    {labyrinth.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Floor:</label>
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="floor-select"
                disabled={!selectedLabyrinth}
              >
                <option value="">Select a floor...</option>
                {floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    Floor {floor.floor_number}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Monster:</label>
              <select
                value={selectedMonster}
                onChange={(e) => setSelectedMonster(e.target.value)}
                className="monster-select"
                disabled={!selectedFloor}
              >
                <option value="">Select a monster...</option>
                {monsters.map((monster) => (
                  <option key={monster.id} value={monster.id}>
                    {monster.name} ({monster.id})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {error && <div className="error-message">Error: {error}</div>}

      <div className="rewards-actions">
        <button
          className="btn-primary"
          onClick={handleAddReward}
          disabled={!selectedMonster || (activeTab === 'floor' && !selectedFloor)}
        >
          Add Reward
        </button>
      </div>

      {loading ? (
        <div>Loading rewards...</div>
      ) : (
        <table className="rewards-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Reward ID</th>
              <th>Quantity</th>
              <th>Chance</th>
              <th>Min Qty</th>
              <th>Max Qty</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rewards.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  No rewards configured. Add one to get started.
                </td>
              </tr>
            ) : (
              rewards.map((reward, index) => (
                <tr key={reward.id || `${reward.reward_type}-${reward.reward_id}-${index}`}>
                  <td>{reward.reward_type}</td>
                  <td>{reward.reward_id}</td>
                  <td>{reward.quantity || '-'}</td>
                  <td>{(reward.chance * 100).toFixed(2)}%</td>
                  <td>{reward.min_quantity || '-'}</td>
                  <td>{reward.max_quantity || '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-edit" onClick={() => handleEditReward(reward)}>
                        Edit
                      </button>
                      <button className="btn-delete" onClick={() => handleDeleteReward(reward)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {showRewardForm && (
        <RewardFormModal
          reward={editingReward || undefined}
          monsterId={selectedMonster}
          onSave={handleSaveReward}
          onCancel={() => {
            setShowRewardForm(false);
            setEditingReward(null);
          }}
        />
      )}
    </div>
  );
}

interface RewardFormModalProps {
  reward?: MonsterReward;
  monsterId: string;
  onSave: (reward: MonsterReward) => void;
  onCancel: () => void;
}

function RewardFormModal({ reward, monsterId, onSave, onCancel }: RewardFormModalProps) {
  const [formData, setFormData] = useState<MonsterReward>({
    monster_id: monsterId,
    reward_type: reward?.reward_type || 'item',
    reward_id: reward?.reward_id || '',
    quantity: reward?.quantity || 1,
    chance: reward?.chance || 1.0,
    min_quantity: reward?.min_quantity,
    max_quantity: reward?.max_quantity,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reward_id) {
      alert('Reward ID is required');
      return;
    }
    if (formData.chance < 0 || formData.chance > 1) {
      alert('Chance must be between 0 and 1');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{reward ? 'Edit Reward' : 'Add Reward'}</h3>
          <button className="modal-close" onClick={onCancel}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="reward-form">
          <div className="form-group">
            <label>Reward Type:</label>
            <select
              value={formData.reward_type}
              onChange={(e) =>
                setFormData({ ...formData, reward_type: e.target.value as MonsterReward['reward_type'] })
              }
              required
            >
              <option value="item">Item</option>
              <option value="gold">Gold</option>
              <option value="experience">Experience</option>
              <option value="title">Title</option>
              <option value="achievement">Achievement</option>
            </select>
          </div>
          <div className="form-group">
            <label>Reward ID:</label>
            <input
              type="text"
              value={formData.reward_id}
              onChange={(e) => setFormData({ ...formData, reward_id: e.target.value })}
              required
              placeholder="e.g., gold, health_potion, title_id"
            />
          </div>
          <div className="form-group">
            <label>Quantity:</label>
            <input
              type="number"
              value={formData.quantity || ''}
              onChange={(e) =>
                setFormData({ ...formData, quantity: e.target.value ? parseInt(e.target.value) : undefined })
              }
              min="1"
            />
          </div>
          <div className="form-group">
            <label>Chance (0-1):</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={formData.chance}
              onChange={(e) => setFormData({ ...formData, chance: parseFloat(e.target.value) })}
              required
            />
          </div>
          <div className="form-group">
            <label>Min Quantity (optional):</label>
            <input
              type="number"
              value={formData.min_quantity || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  min_quantity: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              min="1"
            />
          </div>
          <div className="form-group">
            <label>Max Quantity (optional):</label>
            <input
              type="number"
              value={formData.max_quantity || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  max_quantity: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              min="1"
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
