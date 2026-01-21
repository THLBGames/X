-- Create admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Create index on username for fast lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- Create a default admin user (password: admin123 - should be changed!)
-- NOTE: The password hash below is a placeholder. You must generate a proper bcrypt hash.
-- To generate: Use bcrypt.hash('admin123', 10) or an online bcrypt generator
-- This is just for initial setup - should be changed immediately
-- For production, remove this insert and create admin users through the admin panel
INSERT INTO admin_users (username, password_hash, email) 
VALUES ('admin123', '$2b$10$dShbPc5/wzOWX0IFgOEFeeFkrsgSE83jFrLIFaub1eWlbgilMiCb6', 'c.wagner7443@gmail.com')
ON CONFLICT (username) DO NOTHING;
