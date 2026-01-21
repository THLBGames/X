const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'admin_token';

export interface AdminUser {
  id: string;
  username: string;
  email: string | null;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: AdminUser;
  message?: string;
}

/**
 * Admin authentication service
 */
export class AuthService {
  /**
   * Get stored JWT token
   */
  static getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Store JWT token
   */
  static setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * Remove JWT token
   */
  static removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Login with username and password
   */
  static async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success && data.token) {
        this.setToken(data.token);
        return { success: true, token: data.token, user: data.user };
      }

      return { success: false, message: data.message || 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  /**
   * Logout
   */
  static logout(): void {
    this.removeToken();
    window.location.href = '/admin/login';
  }

  /**
   * Verify token and get current user
   */
  static async verifyToken(): Promise<AdminUser | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.user) {
        return data.user;
      }

      // Token is invalid, remove it
      this.removeToken();
      return null;
    } catch (error) {
      console.error('Token verification error:', error);
      this.removeToken();
      return null;
    }
  }

  /**
   * Get authorization header for API requests
   */
  static getAuthHeader(): { Authorization: string } | {} {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Make authenticated API request
   */
  static async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token expired or invalid
      this.removeToken();
      window.location.href = '/admin/login';
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}
