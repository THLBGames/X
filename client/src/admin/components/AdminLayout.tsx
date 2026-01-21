import { useState, useEffect } from 'react';
import { AuthService, type AdminUser } from '../AuthService';
import LabyrinthList from './LabyrinthList';
import LabyrinthForm from './LabyrinthForm';
import MonsterManager from './MonsterManager';
import MonsterRewardsManager from './MonsterRewardsManager';
import AchievementManager from './AchievementManager';
import RulesConfig from './RulesConfig';
import UserManager from './UserManager';
import './AdminLayout.css';

interface AdminLayoutProps {
  user: AdminUser | null;
}

type AdminSection = 'dashboard' | 'labyrinths' | 'labyrinth-edit' | 'monsters' | 'monster-rewards' | 'achievements' | 'rules' | 'users';

export default function AdminLayout({ user }: AdminLayoutProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [editingLabyrinthId, setEditingLabyrinthId] = useState<string | null>(null);

  const updateActiveSection = () => {
    // Parse URL to determine active section
    const path = window.location.pathname;
    if (path.startsWith('/admin/labyrinths/') && path.includes('/edit')) {
      const id = path.split('/')[3];
      setEditingLabyrinthId(id);
      setActiveSection('labyrinth-edit');
    } else if (path === '/admin/labyrinths' || path === '/admin/labyrinths/') {
      setActiveSection('labyrinths');
    } else if (path === '/admin/monsters' || path === '/admin/monsters/') {
      setActiveSection('monsters');
    } else if (path === '/admin/monster-rewards' || path === '/admin/monster-rewards/') {
      setActiveSection('monster-rewards');
    } else if (path === '/admin/achievements' || path === '/admin/achievements/') {
      setActiveSection('achievements');
    } else if (path === '/admin/rules' || path === '/admin/rules/') {
      setActiveSection('rules');
    } else if (path === '/admin/users' || path === '/admin/users/') {
      setActiveSection('users');
    } else {
      setActiveSection('dashboard');
    }
  };

  useEffect(() => {
    // Initial load
    updateActiveSection();

    // Listen for popstate events (browser back/forward)
    const handlePopState = () => {
      updateActiveSection();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigateTo = (section: AdminSection, labyrinthId?: string) => {
    setActiveSection(section);
    if (labyrinthId) {
      setEditingLabyrinthId(labyrinthId);
      window.history.pushState({}, '', `/admin/labyrinths/${labyrinthId}/edit`);
    } else {
      const paths: Record<AdminSection, string> = {
        dashboard: '/admin/dashboard',
        labyrinths: '/admin/labyrinths',
        'labyrinth-edit': `/admin/labyrinths/${editingLabyrinthId}/edit`,
        monsters: '/admin/monsters',
        'monster-rewards': '/admin/monster-rewards',
        achievements: '/admin/achievements',
        rules: '/admin/rules',
        users: '/admin/users',
      };
      window.history.pushState({}, '', paths[section]);
    }
  };

  const handleLogout = () => {
    AuthService.logout();
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="admin-dashboard">
            <h2>Admin Dashboard</h2>
            <p>Welcome, {user?.username}!</p>
            <div className="admin-dashboard-stats">
              <div className="admin-stat-card">
                <h3>Labyrinths</h3>
                <p>Manage labyrinth configurations</p>
                <button onClick={() => navigateTo('labyrinths')}>View Labyrinths</button>
              </div>
              <div className="admin-stat-card">
                <h3>Monsters</h3>
                <p>Browse and view monsters</p>
                <button onClick={() => navigateTo('monsters')}>View Monsters</button>
              </div>
              <div className="admin-stat-card">
                <h3>Monster Rewards</h3>
                <p>Configure monster rewards</p>
                <button onClick={() => navigateTo('monster-rewards')}>Configure Rewards</button>
              </div>
              <div className="admin-stat-card">
                <h3>Achievements</h3>
                <p>Manage achievements</p>
                <button onClick={() => navigateTo('achievements')}>View Achievements</button>
              </div>
              <div className="admin-stat-card">
                <h3>Rules</h3>
                <p>Configure global rules</p>
                <button onClick={() => navigateTo('rules')}>Configure Rules</button>
              </div>
            </div>
          </div>
        );
      case 'labyrinths':
        return <LabyrinthList onEdit={(id) => navigateTo('labyrinth-edit', id)} />;
      case 'labyrinth-edit':
        return (
          <LabyrinthForm
            labyrinthId={editingLabyrinthId}
            onSave={() => navigateTo('labyrinths')}
            onCancel={() => navigateTo('labyrinths')}
          />
        );
      case 'monsters':
        return <MonsterManager />;
      case 'monster-rewards':
        return <MonsterRewardsManager />;
      case 'achievements':
        return <AchievementManager />;
      case 'rules':
        return <RulesConfig />;
      case 'users':
        return <UserManager />;
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className="admin-layout">
      <div className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2>Admin Portal</h2>
          <p className="admin-user-info">{user?.username}</p>
        </div>
        <nav className="admin-nav">
          <button
            className={activeSection === 'dashboard' ? 'active' : ''}
            onClick={() => navigateTo('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={activeSection === 'labyrinths' || activeSection === 'labyrinth-edit' ? 'active' : ''}
            onClick={() => navigateTo('labyrinths')}
          >
            Labyrinths
          </button>
          <button
            className={activeSection === 'monsters' ? 'active' : ''}
            onClick={() => navigateTo('monsters')}
          >
            Monsters
          </button>
          <button
            className={activeSection === 'monster-rewards' ? 'active' : ''}
            onClick={() => navigateTo('monster-rewards')}
          >
            Monster Rewards
          </button>
          <button
            className={activeSection === 'achievements' ? 'active' : ''}
            onClick={() => navigateTo('achievements')}
          >
            Achievements
          </button>
          <button
            className={activeSection === 'rules' ? 'active' : ''}
            onClick={() => navigateTo('rules')}
          >
            Rules
          </button>
          <button
            className={activeSection === 'users' ? 'active' : ''}
            onClick={() => navigateTo('users')}
          >
            Users
          </button>
        </nav>
        <div className="admin-sidebar-footer">
          <button className="admin-logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
      <div className="admin-content">
        {renderContent()}
      </div>
    </div>
  );
}
