import { Express, Request, Response } from 'express';
import { AdminUserModel } from '../models/AdminUser.js';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth.js';

export function setupAuthRoutes(app: Express) {
  /**
   * Admin login endpoint
   */
  app.post('/api/admin/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required',
        });
      }

      // Find user by username
      const user = await AdminUserModel.findByUsername(username);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Account is disabled',
        });
      }

      // Verify password
      const isValidPassword = await AdminUserModel.verifyPassword(user, password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      // Update last login
      await AdminUserModel.updateLastLogin(user.id);

      // Generate JWT token
      const token = generateToken(user.id, user.username);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Login failed',
      });
    }
  });

  /**
   * Verify token endpoint
   */
  app.get('/api/admin/auth/verify', authenticateToken, (req: AuthRequest, res: Response) => {
    res.json({
      success: true,
      user: req.user,
    });
  });

  /**
   * Logout endpoint (client-side token removal, but server can invalidate if needed)
   */
  app.post('/api/admin/auth/logout', authenticateToken, (req: AuthRequest, res: Response) => {
    // JWT tokens are stateless, so logout is handled client-side
    // In production, you might want to implement a token blacklist
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  });
}
