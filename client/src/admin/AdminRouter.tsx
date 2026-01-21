import { useEffect, useState } from 'react';
import { AuthService } from './AuthService';
import AdminLogin from './components/AdminLogin';
import AdminLayout from './components/AdminLayout';
import type { AdminUser } from './AuthService';

export default function AdminRouter() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Check if we're on login page
      const path = window.location.pathname;
      if (path === '/admin/login') {
        // If already logged in, redirect to dashboard
        if (AuthService.isAuthenticated()) {
          const verifiedUser = await AuthService.verifyToken();
          if (verifiedUser) {
            window.location.href = '/admin/dashboard';
            return;
          }
        }
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      // For other admin pages, verify authentication
      if (AuthService.isAuthenticated()) {
        const verifiedUser = await AuthService.verifyToken();
        if (verifiedUser) {
          setIsAuthenticated(true);
          setUser(verifiedUser);
        } else {
          window.location.href = '/admin/login';
        }
      } else {
        window.location.href = '/admin/login';
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="admin-loading">
        <div>Loading...</div>
      </div>
    );
  }

  // Show login page
  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  // Show admin layout for authenticated users
  return <AdminLayout user={user} />;
}
