import { useState, useEffect } from 'react';
import { AuthService, type AdminUser } from '../AuthService';
import './UserManager.css';

interface User extends Omit<AdminUser, 'password_hash'> {
  last_login: string | null;
  is_active: boolean;
  created_at: string;
}

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    const user = await AuthService.verifyToken();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await AuthService.apiRequest<{ success: boolean; users: User[] }>(
        '/api/admin/users'
      );
      if (data.success) {
        setUsers(data.users);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await AuthService.apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
      loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  if (loading) return <div>Loading users...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="user-manager">
      <div className="user-manager-header">
        <h2>Admin User Management</h2>
        <button className="btn-primary" onClick={handleAdd}>
          Create User
        </button>
      </div>

      <table className="user-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Active</th>
            <th>Last Login</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td colSpan={6} className="empty-state">
                No users found.
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email || '-'}</td>
                <td>
                  <span className={user.is_active ? 'status-active' : 'status-inactive'}>
                    {user.is_active ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>
                  {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-edit" onClick={() => handleEdit(user)}>
                      Edit
                    </button>
                    {user.id !== currentUserId && (
                      <button className="btn-delete" onClick={() => handleDelete(user.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {showForm && (
        <UserFormModal
          user={editingUser || undefined}
          isCurrentUser={editingUser?.id === currentUserId}
          onSave={() => {
            setShowForm(false);
            setEditingUser(null);
            loadUsers();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}

interface UserFormModalProps {
  user?: User;
  isCurrentUser: boolean;
  onSave: () => void;
  onCancel: () => void;
}

function UserFormModal({ user, isCurrentUser, onSave, onCancel }: UserFormModalProps) {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    is_active: user?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user && !formData.password) {
      setFormError('Password is required for new users');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }

    try {
      setSaving(true);
      if (user) {
        // Update
        const updates: any = {};
        if (formData.email !== user.email) updates.email = formData.email;
        if (formData.password) updates.password = formData.password;
        if (!isCurrentUser && formData.is_active !== user.is_active) {
          updates.is_active = formData.is_active;
        }

        await AuthService.apiRequest(`/api/admin/users/${user.id}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        });
      } else {
        // Create
        if (!formData.username) {
          setFormError('Username is required');
          return;
        }
        await AuthService.apiRequest('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({
            username: formData.username,
            password: formData.password,
            email: formData.email || null,
          }),
        });
      }
      onSave();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content user-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{user ? 'Edit User' : 'Create User'}</h3>
          <button className="modal-close" onClick={onCancel}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="user-form">
          {formError && <div className="error-message">{formError}</div>}
          {!user && (
            <div className="form-group">
              <label>Username:</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                placeholder="Enter username"
              />
            </div>
          )}
          {user && (
            <div className="form-group">
              <label>Username:</label>
              <input type="text" value={user.username} disabled />
              <small>Username cannot be changed</small>
            </div>
          )}
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter email (optional)"
            />
          </div>
          <div className="form-group">
            <label>{user ? 'New Password (leave blank to keep current):' : 'Password:'}</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!user}
              placeholder={user ? 'Enter new password or leave blank' : 'Enter password'}
            />
            {user && <small>Leave blank to keep current password</small>}
          </div>
          {!isCurrentUser && (
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                Active
              </label>
            </div>
          )}
          {isCurrentUser && (
            <div className="form-group">
              <label>Status:</label>
              <input type="text" value="Active (cannot change own status)" disabled />
            </div>
          )}
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
