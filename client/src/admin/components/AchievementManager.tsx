import { useState, useEffect } from 'react';
import { AuthService } from '../AuthService';
import './AchievementManager.css';

interface Achievement {
  id: string;
  name: string;
  description: string | null;
  category: string;
  requirements: Record<string, any>;
  rewards: Record<string, any>;
  hidden: boolean;
  created_at: string;
  updated_at: string;
}

export default function AchievementManager() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      setLoading(true);
      const data = await AuthService.apiRequest<{ success: boolean; achievements: Achievement[] }>(
        '/api/admin/achievements'
      );
      if (data.success) {
        setAchievements(data.achievements);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load achievements');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this achievement?')) return;
    try {
      await AuthService.apiRequest(`/api/admin/achievements/${id}`, { method: 'DELETE' });
      loadAchievements();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete achievement');
    }
  };

  const handleEdit = (achievement: Achievement) => {
    setEditingAchievement(achievement);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingAchievement(null);
    setShowForm(true);
  };

  const categories = Array.from(new Set(achievements.map((a) => a.category)));

  const filteredAchievements = achievements.filter((achievement) => {
    const matchesSearch =
      achievement.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      achievement.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (achievement.description &&
        achievement.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !filterCategory || achievement.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) return <div>Loading achievements...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="achievement-manager">
      <div className="achievement-manager-header">
        <h2>Achievement Management</h2>
        <button className="btn-primary" onClick={handleAdd}>
          Create Achievement
        </button>
      </div>

      <div className="achievement-filters">
        <input
          type="text"
          placeholder="Search achievements..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="achievement-search"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="category-filter"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <table className="achievement-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Category</th>
            <th>Hidden</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredAchievements.length === 0 ? (
            <tr>
              <td colSpan={6} className="empty-state">
                No achievements found.
              </td>
            </tr>
          ) : (
            filteredAchievements.map((achievement) => (
              <tr key={achievement.id}>
                <td>{achievement.id}</td>
                <td>{achievement.name}</td>
                <td>
                  <span className="category-badge">{achievement.category}</span>
                </td>
                <td>{achievement.hidden ? 'Yes' : 'No'}</td>
                <td>{new Date(achievement.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-edit" onClick={() => handleEdit(achievement)}>
                      Edit
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(achievement.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {showForm && (
        <AchievementFormModal
          achievement={editingAchievement || undefined}
          onSave={() => {
            setShowForm(false);
            setEditingAchievement(null);
            loadAchievements();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingAchievement(null);
          }}
        />
      )}
    </div>
  );
}

interface AchievementFormModalProps {
  achievement?: Achievement;
  onSave: () => void;
  onCancel: () => void;
}

function AchievementFormModal({ achievement, onSave, onCancel }: AchievementFormModalProps) {
  const [formData, setFormData] = useState({
    id: achievement?.id || '',
    name: achievement?.name || '',
    description: achievement?.description || '',
    category: achievement?.category || 'milestone',
    requirements: JSON.stringify(achievement?.requirements || {}, null, 2),
    rewards: JSON.stringify(achievement?.rewards || {}, null, 2),
    hidden: achievement?.hidden || false,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate JSON fields
    let requirements, rewards;
    try {
      requirements = JSON.parse(formData.requirements);
    } catch (err) {
      setFormError('Invalid JSON in requirements field');
      return;
    }
    try {
      rewards = JSON.parse(formData.rewards);
    } catch (err) {
      setFormError('Invalid JSON in rewards field');
      return;
    }

    if (!formData.id || !formData.name || !formData.category) {
      setFormError('ID, name, and category are required');
      return;
    }

    try {
      setSaving(true);
      if (achievement) {
        // Update
        await AuthService.apiRequest(`/api/admin/achievements/${achievement.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            category: formData.category,
            requirements,
            rewards,
            hidden: formData.hidden,
          }),
        });
      } else {
        // Create
        await AuthService.apiRequest('/api/admin/achievements', {
          method: 'POST',
          body: JSON.stringify({
            id: formData.id,
            name: formData.name,
            description: formData.description || null,
            category: formData.category,
            requirements,
            rewards,
            hidden: formData.hidden,
          }),
        });
      }
      onSave();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save achievement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content achievement-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{achievement ? 'Edit Achievement' : 'Create Achievement'}</h3>
          <button className="modal-close" onClick={onCancel}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="achievement-form">
          {formError && <div className="error-message">{formError}</div>}
          <div className="form-group">
            <label>ID:</label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              required
              disabled={!!achievement}
              placeholder="e.g., collect_first_item"
            />
            {achievement && <small>ID cannot be changed</small>}
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
          <div className="form-group">
            <label>Description:</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Category:</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
            >
              <option value="collection">Collection</option>
              <option value="combat">Combat</option>
              <option value="completion">Completion</option>
              <option value="milestone">Milestone</option>
              <option value="skilling">Skilling</option>
            </select>
          </div>
          <div className="form-group">
            <label>Requirements (JSON):</label>
            <textarea
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              rows={6}
              className="json-editor"
              required
            />
            <small>Enter valid JSON object</small>
          </div>
          <div className="form-group">
            <label>Rewards (JSON):</label>
            <textarea
              value={formData.rewards}
              onChange={(e) => setFormData({ ...formData, rewards: e.target.value })}
              rows={6}
              className="json-editor"
              required
            />
            <small>Enter valid JSON object</small>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.hidden}
                onChange={(e) => setFormData({ ...formData, hidden: e.target.checked })}
              />
              Hidden
            </label>
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
