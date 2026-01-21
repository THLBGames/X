import { useState, useEffect } from 'react';
import { AuthService } from '../AuthService';
import './MonsterManager.css';

interface Monster {
  id: string;
  name: string;
  description: string | null;
  nameKey?: string;
  descriptionKey?: string;
  tier: number;
  level: number;
  stats: {
    health: number;
    maxHealth: number;
    mana: number;
    maxMana: number;
    attack: number;
    defense: number;
    magicAttack: number;
    magicDefense: number;
    speed: number;
    criticalChance: number;
    criticalDamage: number;
  };
  abilities?: Array<{
    id: string;
    name: string;
    type: string;
    chance: number;
    effect: Record<string, any>;
  }>;
  lootTable?: Array<{
    itemId: string;
    chance: number;
    min?: number;
    max?: number;
    quantity?: number;
  }>;
  experienceReward: number;
  goldReward?: {
    min: number;
    max: number;
  } | null;
}

export default function MonsterManager() {
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [filterTier, setFilterTier] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMonster, setEditingMonster] = useState<Monster | null>(null);

  useEffect(() => {
    loadMonsters();
  }, []);

  const loadMonsters = async () => {
    try {
      setLoading(true);
      const data = await AuthService.apiRequest<{ success: boolean; monsters: Monster[] }>(
        '/api/admin/monsters'
      );
      if (data.success) {
        setMonsters(data.monsters);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monsters');
    } finally {
      setLoading(false);
    }
  };

  const handleViewMonster = async (id: string) => {
    try {
      const data = await AuthService.apiRequest<{ success: boolean; monster: Monster }>(
        `/api/admin/monsters/${id}`
      );
      if (data.success) {
        setSelectedMonster(data.monster);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load monster details');
    }
  };

  const handleConfigureRewards = (monsterId: string) => {
    // Navigate to monster rewards manager with this monster selected
    window.location.href = `/admin/monster-rewards?monster=${monsterId}`;
  };

  const handleAdd = () => {
    setEditingMonster(null);
    setShowForm(true);
  };

  const handleEdit = (monster: Monster) => {
    setEditingMonster(monster);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this monster?')) return;
    try {
      await AuthService.apiRequest(`/api/admin/monsters/${id}`, { method: 'DELETE' });
      loadMonsters();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete monster');
    }
  };

  const filteredMonsters = monsters.filter((monster) => {
    const matchesSearch =
      monster.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      monster.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = filterTier === null || monster.tier === filterTier;
    return matchesSearch && matchesTier;
  });

  if (loading) return <div>Loading monsters...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="monster-manager">
      <div className="monster-manager-header">
        <div>
          <h2>Monster Manager</h2>
          <p>Browse and manage monsters. Configure rewards in the Monster Rewards section.</p>
        </div>
        <button className="btn-primary" onClick={handleAdd}>
          Create Monster
        </button>
      </div>

      <div className="monster-filters">
        <input
          type="text"
          placeholder="Search monsters..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="monster-search"
        />
        <select
          value={filterTier || ''}
          onChange={(e) => setFilterTier(e.target.value ? parseInt(e.target.value) : null)}
          className="monster-tier-filter"
        >
          <option value="">All Tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
      </div>

      <table className="monster-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Tier</th>
            <th>Level</th>
            <th>HP</th>
            <th>Attack</th>
            <th>Defense</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredMonsters.length === 0 ? (
            <tr>
              <td colSpan={8} className="empty-state">
                No monsters found.
              </td>
            </tr>
          ) : (
            filteredMonsters.map((monster) => (
              <tr key={monster.id}>
                <td>{monster.id}</td>
                <td>{monster.name}</td>
                <td>
                  <span className={`tier-badge tier-${monster.tier}`}>Tier {monster.tier}</span>
                </td>
                <td>{monster.level}</td>
                <td>{monster.stats.maxHealth}</td>
                <td>{monster.stats.attack}</td>
                <td>{monster.stats.defense}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-view" onClick={() => handleViewMonster(monster.id)}>
                      View
                    </button>
                    <button className="btn-edit" onClick={() => handleEdit(monster)}>
                      Edit
                    </button>
                    <button
                      className="btn-rewards"
                      onClick={() => handleConfigureRewards(monster.id)}
                    >
                      Rewards
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(monster.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {selectedMonster && (
        <div className="monster-modal" onClick={() => setSelectedMonster(null)}>
          <div className="monster-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="monster-modal-header">
              <h3>{selectedMonster.name}</h3>
              <button className="modal-close" onClick={() => setSelectedMonster(null)}>
                ×
              </button>
            </div>
            <div className="monster-modal-body">
              <p className="monster-description">{selectedMonster.description}</p>
              <div className="monster-details">
                <div className="detail-row">
                  <strong>ID:</strong> {selectedMonster.id}
                </div>
                <div className="detail-row">
                  <strong>Tier:</strong> {selectedMonster.tier}
                </div>
                <div className="detail-row">
                  <strong>Level:</strong> {selectedMonster.level}
                </div>
                <div className="detail-row">
                  <strong>Experience Reward:</strong> {selectedMonster.experienceReward}
                </div>
                {selectedMonster.goldReward && (
                  <div className="detail-row">
                    <strong>Gold Reward:</strong> {selectedMonster.goldReward.min} -{' '}
                    {selectedMonster.goldReward.max}
                  </div>
                )}
                <div className="stats-section">
                  <h4>Stats</h4>
                  <div className="stats-grid">
                    <div>Health: {selectedMonster.stats.maxHealth}</div>
                    <div>Attack: {selectedMonster.stats.attack}</div>
                    <div>Defense: {selectedMonster.stats.defense}</div>
                    <div>Speed: {selectedMonster.stats.speed}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <MonsterFormModal
          monster={editingMonster || undefined}
          onSave={() => {
            setShowForm(false);
            setEditingMonster(null);
            loadMonsters();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingMonster(null);
          }}
        />
      )}
    </div>
  );
}

interface MonsterFormModalProps {
  monster?: Monster;
  onSave: () => void;
  onCancel: () => void;
}

function MonsterFormModal({ monster, onSave, onCancel }: MonsterFormModalProps) {
  const [formData, setFormData] = useState({
    id: monster?.id || '',
    name: monster?.name || '',
    description: monster?.description || '',
    nameKey: monster?.nameKey || '',
    descriptionKey: monster?.descriptionKey || '',
    tier: monster?.tier || 1,
    level: monster?.level || 1,
    stats: JSON.stringify(monster?.stats || {
      health: 50,
      maxHealth: 50,
      mana: 0,
      maxMana: 0,
      attack: 10,
      defense: 5,
      magicAttack: 0,
      magicDefense: 0,
      speed: 10,
      criticalChance: 5,
      criticalDamage: 1.5,
    }, null, 2),
    abilities: JSON.stringify(monster?.abilities || [], null, 2),
    lootTable: JSON.stringify(monster?.lootTable || [], null, 2),
    experienceReward: monster?.experienceReward || 10,
    goldReward: JSON.stringify(monster?.goldReward || { min: 5, max: 10 }, null, 2),
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate JSON fields
    let stats, abilities, lootTable, goldReward;
    try {
      stats = JSON.parse(formData.stats);
    } catch (err) {
      setFormError('Invalid JSON in stats field');
      return;
    }
    try {
      abilities = JSON.parse(formData.abilities);
    } catch (err) {
      setFormError('Invalid JSON in abilities field');
      return;
    }
    try {
      lootTable = JSON.parse(formData.lootTable);
    } catch (err) {
      setFormError('Invalid JSON in lootTable field');
      return;
    }
    try {
      goldReward = JSON.parse(formData.goldReward);
    } catch (err) {
      setFormError('Invalid JSON in goldReward field');
      return;
    }

    if (!formData.id || !formData.name) {
      setFormError('ID and name are required');
      return;
    }

    try {
      setSaving(true);
      if (monster) {
        // Update
        await AuthService.apiRequest(`/api/admin/monsters/${monster.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            nameKey: formData.nameKey || null,
            descriptionKey: formData.descriptionKey || null,
            tier: formData.tier,
            level: formData.level,
            stats,
            abilities,
            lootTable,
            experienceReward: formData.experienceReward,
            goldReward,
          }),
        });
      } else {
        // Create
        await AuthService.apiRequest('/api/admin/monsters', {
          method: 'POST',
          body: JSON.stringify({
            id: formData.id,
            name: formData.name,
            description: formData.description || null,
            nameKey: formData.nameKey || null,
            descriptionKey: formData.descriptionKey || null,
            tier: formData.tier,
            level: formData.level,
            stats,
            abilities,
            lootTable,
            experienceReward: formData.experienceReward,
            goldReward,
          }),
        });
      }
      onSave();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save monster');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content monster-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{monster ? 'Edit Monster' : 'Create Monster'}</h3>
          <button className="modal-close" onClick={onCancel}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="monster-form">
          {formError && <div className="error-message">{formError}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>ID:</label>
              <input
                type="text"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                required
                disabled={!!monster}
                placeholder="e.g., goblin"
              />
              {monster && <small>ID cannot be changed</small>}
            </div>
            <div className="form-group">
              <label>Name:</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Description:</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Tier:</label>
              <input
                type="number"
                min="1"
                max="5"
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: parseInt(e.target.value) })}
                required
              />
            </div>
            <div className="form-group">
              <label>Level:</label>
              <input
                type="number"
                min="1"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                required
              />
            </div>
            <div className="form-group">
              <label>Experience Reward:</label>
              <input
                type="number"
                min="0"
                value={formData.experienceReward}
                onChange={(e) =>
                  setFormData({ ...formData, experienceReward: parseInt(e.target.value) })
                }
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Stats (JSON):</label>
            <textarea
              value={formData.stats}
              onChange={(e) => setFormData({ ...formData, stats: e.target.value })}
              rows={8}
              className="json-editor"
              required
            />
          </div>
          <div className="form-group">
            <label>Abilities (JSON):</label>
            <textarea
              value={formData.abilities}
              onChange={(e) => setFormData({ ...formData, abilities: e.target.value })}
              rows={6}
              className="json-editor"
            />
          </div>
          <div className="form-group">
            <label>Loot Table (JSON):</label>
            <textarea
              value={formData.lootTable}
              onChange={(e) => setFormData({ ...formData, lootTable: e.target.value })}
              rows={6}
              className="json-editor"
              required
            />
          </div>
          <div className="form-group">
            <label>Gold Reward (JSON):</label>
            <textarea
              value={formData.goldReward}
              onChange={(e) => setFormData({ ...formData, goldReward: e.target.value })}
              rows={3}
              className="json-editor"
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
