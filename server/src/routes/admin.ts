import { Express, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { LabyrinthModel } from '../models/Labyrinth.js';
import { LabyrinthFloorModel } from '../models/LabyrinthFloor.js';
import { LabyrinthManager } from '../services/LabyrinthManager.js';
import { FloorNodeModel } from '../models/FloorNode.js';
import { FloorConnectionModel } from '../models/FloorConnection.js';
import { ProceduralGenerator } from '../services/ProceduralGenerator.js';
import { pool } from '../config/database.js';

export function setupAdminRoutes(app: Express) {
  // All admin routes require authentication

  /**
   * Get all labyrinths (admin view - includes all statuses)
   */
  app.get('/api/admin/labyrinths', authenticateToken, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        'SELECT * FROM labyrinths ORDER BY created_at DESC'
      );
      const labyrinths = result.rows.map((row) => ({
        ...row,
        rules_config: typeof row.rules_config === 'string' ? JSON.parse(row.rules_config) : row.rules_config,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      }));
      res.json({ success: true, labyrinths });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch labyrinths',
      });
    }
  });

  /**
   * Create new labyrinth
   */
  app.post('/api/admin/labyrinths', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { name, scheduled_start, total_floors, max_initial_players, rules_config, metadata, floors } = req.body;

      if (!name || !scheduled_start || !total_floors || !max_initial_players) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: name, scheduled_start, total_floors, max_initial_players',
        });
      }

      if (!floors || !Array.isArray(floors) || floors.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one floor is required',
        });
      }

      // Validate floors
      for (let i = 0; i < floors.length; i++) {
        const floor = floors[i];
        if (!floor.floor_number || !floor.max_players) {
          return res.status(400).json({
            success: false,
            message: `Floor ${i + 1} is missing required fields: floor_number, max_players`,
          });
        }
      }

      const result = await LabyrinthManager.createLabyrinth(
        {
          name,
          scheduled_start: new Date(scheduled_start),
          total_floors,
          max_initial_players,
          rules_config: rules_config || {},
          metadata: metadata || {},
        },
        floors
      );

      res.json({ success: true, labyrinth: result.labyrinth, floors: result.floors });
    } catch (error) {
      console.error('Create labyrinth error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create labyrinth',
      });
    }
  });

  /**
   * Get labyrinth details with floors
   */
  app.get('/api/admin/labyrinths/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const labyrinth = await LabyrinthModel.findById(req.params.id);
      if (!labyrinth) {
        return res.status(404).json({ success: false, message: 'Labyrinth not found' });
      }

      const floors = await LabyrinthFloorModel.findByLabyrinthId(req.params.id);
      res.json({ success: true, labyrinth, floors });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch labyrinth',
      });
    }
  });

  /**
   * Update labyrinth
   */
  app.put('/api/admin/labyrinths/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { name, scheduled_start, total_floors, max_initial_players, rules_config, metadata, floors } = req.body;
      const labyrinthId = req.params.id;

      // Check if labyrinth exists
      const existingLabyrinth = await LabyrinthModel.findById(labyrinthId);
      if (!existingLabyrinth) {
        return res.status(404).json({ success: false, message: 'Labyrinth not found' });
      }

      // Warn if labyrinth is active or completed
      if (existingLabyrinth.status === 'active' || existingLabyrinth.status === 'completed') {
        // Still allow update, but this is a warning case
      }

      // Update labyrinth basic info
      if (name || scheduled_start || total_floors !== undefined || max_initial_players !== undefined || rules_config || metadata) {
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (name !== undefined) {
          updates.push(`name = $${paramCount++}`);
          values.push(name);
        }
        if (scheduled_start !== undefined) {
          updates.push(`scheduled_start = $${paramCount++}`);
          values.push(new Date(scheduled_start));
        }
        if (total_floors !== undefined) {
          updates.push(`total_floors = $${paramCount++}`);
          values.push(total_floors);
        }
        if (max_initial_players !== undefined) {
          updates.push(`max_initial_players = $${paramCount++}`);
          values.push(max_initial_players);
        }
        if (rules_config !== undefined) {
          updates.push(`rules_config = $${paramCount++}`);
          values.push(JSON.stringify(rules_config));
        }
        if (metadata !== undefined) {
          updates.push(`metadata = $${paramCount++}`);
          values.push(JSON.stringify(metadata));
        }

        if (updates.length > 0) {
          updates.push(`updated_at = CURRENT_TIMESTAMP`);
          values.push(labyrinthId);

          await pool.query(
            `UPDATE labyrinths SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
          );
        }
      }

      // Update floors if provided
      if (floors && Array.isArray(floors)) {
        // Delete existing floors
        await pool.query('DELETE FROM labyrinth_floors WHERE labyrinth_id = $1', [labyrinthId]);

        // Create new floors
        for (const floorInput of floors) {
          await LabyrinthFloorModel.create({
            ...floorInput,
            labyrinth_id: labyrinthId,
          });
        }
      }

      // Fetch updated labyrinth and floors
      const updatedLabyrinth = await LabyrinthModel.findById(labyrinthId);
      const updatedFloors = await LabyrinthFloorModel.findByLabyrinthId(labyrinthId);

      res.json({ success: true, labyrinth: updatedLabyrinth, floors: updatedFloors });
    } catch (error) {
      console.error('Update labyrinth error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update labyrinth',
      });
    }
  });

  /**
   * Delete labyrinth
   */
  app.delete('/api/admin/labyrinths/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const labyrinthId = req.params.id;
      const labyrinth = await LabyrinthModel.findById(labyrinthId);

      if (!labyrinth) {
        return res.status(404).json({ success: false, message: 'Labyrinth not found' });
      }

      // Prevent deletion of active labyrinths
      if (labyrinth.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete an active labyrinth. Cancel it first.',
        });
      }

      // Delete floors first (cascade should handle this, but being explicit)
      await pool.query('DELETE FROM labyrinth_floors WHERE labyrinth_id = $1', [labyrinthId]);

      // Delete labyrinth
      await pool.query('DELETE FROM labyrinths WHERE id = $1', [labyrinthId]);

      res.json({ success: true, message: 'Labyrinth deleted successfully' });
    } catch (error) {
      console.error('Delete labyrinth error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete labyrinth',
      });
    }
  });

  /**
   * Start scheduled labyrinth
   */
  app.post('/api/admin/labyrinths/:id/start', authenticateToken, async (req: Request, res: Response) => {
    try {
      const labyrinth = await LabyrinthManager.startLabyrinth(req.params.id);
      if (!labyrinth) {
        return res.status(404).json({ success: false, message: 'Labyrinth not found or cannot be started' });
      }
      res.json({ success: true, labyrinth });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start labyrinth',
      });
    }
  });

  /**
   * Cancel labyrinth
   */
  app.post('/api/admin/labyrinths/:id/cancel', authenticateToken, async (req: Request, res: Response) => {
    try {
      const labyrinth = await LabyrinthModel.findById(req.params.id);
      if (!labyrinth) {
        return res.status(404).json({ success: false, message: 'Labyrinth not found' });
      }

      if (labyrinth.status === 'completed' || labyrinth.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel a ${labyrinth.status} labyrinth`,
        });
      }

      const updated = await LabyrinthModel.updateStatus(req.params.id, 'cancelled');
      res.json({ success: true, labyrinth: updated });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to cancel labyrinth',
      });
    }
  });

  /**
   * Update floor configuration
   */
  app.put('/api/admin/labyrinths/:id/floors/:floorId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { floorId } = req.params;
      const { max_players, monster_pool, loot_table, environment_type, rules } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (max_players !== undefined) {
        updates.push(`max_players = $${paramCount++}`);
        values.push(max_players);
      }
      if (monster_pool !== undefined) {
        updates.push(`monster_pool = $${paramCount++}`);
        values.push(JSON.stringify(monster_pool));
      }
      if (loot_table !== undefined) {
        updates.push(`loot_table = $${paramCount++}`);
        values.push(JSON.stringify(loot_table));
      }
      if (environment_type !== undefined) {
        updates.push(`environment_type = $${paramCount++}`);
        values.push(environment_type);
      }
      if (rules !== undefined) {
        updates.push(`rules = $${paramCount++}`);
        values.push(JSON.stringify(rules));
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      values.push(floorId);

      const result = await pool.query(
        `UPDATE labyrinth_floors SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Floor not found' });
      }

      const floor = result.rows[0];
      res.json({
        success: true,
        floor: {
          ...floor,
          monster_pool: typeof floor.monster_pool === 'string' ? JSON.parse(floor.monster_pool) : floor.monster_pool,
          loot_table: typeof floor.loot_table === 'string' ? JSON.parse(floor.loot_table) : floor.loot_table,
          rules: typeof floor.rules === 'string' ? JSON.parse(floor.rules) : floor.rules,
        },
      });
    } catch (error) {
      console.error('Update floor error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update floor',
      });
    }
  });

  /**
   * Get all global monster rewards
   */
  app.get('/api/admin/monster-rewards', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { monster_id } = req.query;
      let query = 'SELECT * FROM global_monster_rewards';
      const params: any[] = [];

      if (monster_id) {
        query += ' WHERE monster_id = $1';
        params.push(monster_id);
      }

      query += ' ORDER BY monster_id, reward_type';

      const result = await pool.query(query, params);
      res.json({ success: true, rewards: result.rows });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch monster rewards',
      });
    }
  });

  /**
   * Update global monster rewards for a specific monster
   */
  app.put('/api/admin/monster-rewards/:monsterId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { monsterId } = req.params;
      const { rewards } = req.body; // Array of reward objects

      if (!Array.isArray(rewards)) {
        return res.status(400).json({
          success: false,
          message: 'Rewards must be an array',
        });
      }

      // Delete existing rewards for this monster
      await pool.query('DELETE FROM global_monster_rewards WHERE monster_id = $1', [monsterId]);

      // Insert new rewards
      for (const reward of rewards) {
        await pool.query(
          `INSERT INTO global_monster_rewards 
           (monster_id, reward_type, reward_id, quantity, chance, min_quantity, max_quantity)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            monsterId,
            reward.reward_type,
            reward.reward_id,
            reward.quantity || 1,
            reward.chance || 1.0,
            reward.min_quantity || null,
            reward.max_quantity || null,
          ]
        );
      }

      res.json({ success: true, message: 'Monster rewards updated successfully' });
    } catch (error) {
      console.error('Update monster rewards error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update monster rewards',
      });
    }
  });

  /**
   * Get floor-specific monster rewards
   */
  app.get('/api/admin/monster-rewards/floors/:floorId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { floorId } = req.params;
      const result = await pool.query(
        'SELECT * FROM floor_monster_rewards WHERE floor_id = $1 ORDER BY monster_id, reward_type',
        [floorId]
      );
      res.json({ success: true, rewards: result.rows });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch floor monster rewards',
      });
    }
  });

  /**
   * Set floor-specific monster rewards (overrides)
   */
  app.put('/api/admin/monster-rewards/floors/:floorId/:monsterId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { floorId, monsterId } = req.params;
      const { rewards } = req.body; // Array of reward objects

      if (!Array.isArray(rewards)) {
        return res.status(400).json({
          success: false,
          message: 'Rewards must be an array',
        });
      }

      // Delete existing overrides for this floor/monster combination
      await pool.query(
        'DELETE FROM floor_monster_rewards WHERE floor_id = $1 AND monster_id = $2',
        [floorId, monsterId]
      );

      // Insert new overrides
      for (const reward of rewards) {
        await pool.query(
          `INSERT INTO floor_monster_rewards 
           (floor_id, monster_id, reward_type, reward_id, quantity, chance, min_quantity, max_quantity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            floorId,
            monsterId,
            reward.reward_type,
            reward.reward_id,
            reward.quantity || 1,
            reward.chance || 1.0,
            reward.min_quantity || null,
            reward.max_quantity || null,
          ]
        );
      }

      res.json({ success: true, message: 'Floor monster rewards updated successfully' });
    } catch (error) {
      console.error('Update floor monster rewards error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update floor monster rewards',
      });
    }
  });

  /**
   * Get global rules configuration
   */
  app.get('/api/admin/rules', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { GlobalRulesModel } = await import('../models/GlobalRules.js');
      const globalRules = await GlobalRulesModel.get();
      if (!globalRules) {
        return res.status(404).json({
          success: false,
          message: 'Rules not found',
        });
      }
      res.json({ success: true, rules: globalRules.rules });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch rules',
      });
    }
  });

  /**
   * Update global rules configuration
   */
  app.put('/api/admin/rules', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { rules } = req.body;
      if (!rules || typeof rules !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Rules object is required',
        });
      }
      const { GlobalRulesModel } = await import('../models/GlobalRules.js');
      const updated = await GlobalRulesModel.update(rules);
      if (!updated) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update rules',
        });
      }
      res.json({ success: true, message: 'Rules updated successfully', rules: updated.rules });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update rules',
      });
    }
  });

  /**
   * Get all achievements
   */
  app.get('/api/admin/achievements', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { AchievementModel } = await import('../models/Achievement.js');
      const achievements = await AchievementModel.listAll();
      res.json({ success: true, achievements });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch achievements',
      });
    }
  });

  /**
   * Get single achievement
   */
  app.get('/api/admin/achievements/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { AchievementModel } = await import('../models/Achievement.js');
      const achievement = await AchievementModel.findById(id);
      if (!achievement) {
        return res.status(404).json({ success: false, message: 'Achievement not found' });
      }
      res.json({ success: true, achievement });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch achievement',
      });
    }
  });

  /**
   * Create new achievement
   */
  app.post('/api/admin/achievements', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id, name, description, category, requirements, rewards, hidden } = req.body;
      if (!id || !name || !category) {
        return res.status(400).json({
          success: false,
          message: 'id, name, and category are required',
        });
      }
      const { AchievementModel } = await import('../models/Achievement.js');
      
      // Check if achievement already exists
      const existing = await AchievementModel.findById(id);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Achievement with this ID already exists',
        });
      }

      const achievement = await AchievementModel.create({
        id,
        name,
        description,
        category,
        requirements: requirements || {},
        rewards: rewards || {},
        hidden: hidden ?? false,
      });
      res.json({ success: true, achievement });
    } catch (error) {
      console.error('Create achievement error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create achievement',
      });
    }
  });

  /**
   * Update achievement
   */
  app.put('/api/admin/achievements/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, category, requirements, rewards, hidden } = req.body;
      const { AchievementModel } = await import('../models/Achievement.js');
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (requirements !== undefined) updates.requirements = requirements;
      if (rewards !== undefined) updates.rewards = rewards;
      if (hidden !== undefined) updates.hidden = hidden;

      const achievement = await AchievementModel.update(id, updates);
      if (!achievement) {
        return res.status(404).json({ success: false, message: 'Achievement not found' });
      }
      res.json({ success: true, achievement });
    } catch (error) {
      console.error('Update achievement error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update achievement',
      });
    }
  });

  /**
   * Delete achievement
   */
  app.delete('/api/admin/achievements/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { AchievementModel } = await import('../models/Achievement.js');
      const deleted = await AchievementModel.delete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Achievement not found' });
      }
      res.json({ success: true, message: 'Achievement deleted successfully' });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete achievement',
      });
    }
  });

  /**
   * Get all monsters (from database)
   */
  app.get('/api/admin/monsters', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { MonsterModel } = await import('../models/Monster.js');
      const monsters = await MonsterModel.listAll();
      
      // Convert to format expected by frontend (camelCase)
      const formattedMonsters = monsters.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        nameKey: m.name_key,
        descriptionKey: m.description_key,
        tier: m.tier,
        level: m.level,
        stats: m.stats,
        abilities: m.abilities,
        lootTable: m.loot_table,
        experienceReward: m.experience_reward,
        goldReward: m.gold_reward,
      }));
      
      res.json({ success: true, monsters: formattedMonsters });
    } catch (error) {
      console.error('Get monsters error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch monsters',
      });
    }
  });

  /**
   * Get single monster by ID
   */
  app.get('/api/admin/monsters/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { MonsterModel } = await import('../models/Monster.js');
      const monster = await MonsterModel.findById(id);
      
      if (!monster) {
        return res.status(404).json({ success: false, message: 'Monster not found' });
      }
      
      // Convert to format expected by frontend (camelCase)
      const formattedMonster = {
        id: monster.id,
        name: monster.name,
        description: monster.description,
        nameKey: monster.name_key,
        descriptionKey: monster.description_key,
        tier: monster.tier,
        level: monster.level,
        stats: monster.stats,
        abilities: monster.abilities,
        lootTable: monster.loot_table,
        experienceReward: monster.experience_reward,
        goldReward: monster.gold_reward,
      };
      
      res.json({ success: true, monster: formattedMonster });
    } catch (error) {
      console.error('Get monster error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch monster',
      });
    }
  });

  /**
   * Create new monster
   */
  app.post('/api/admin/monsters', authenticateToken, async (req: Request, res: Response) => {
    try {
      const {
        id,
        name,
        description,
        nameKey,
        descriptionKey,
        tier,
        level,
        stats,
        abilities,
        lootTable,
        experienceReward,
        goldReward,
      } = req.body;

      if (!id || !name || tier === undefined || level === undefined || !stats || !experienceReward) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: id, name, tier, level, stats, experienceReward',
        });
      }

      const { MonsterModel } = await import('../models/Monster.js');
      
      // Check if monster already exists
      const existing = await MonsterModel.findById(id);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Monster with this ID already exists',
        });
      }

      const monster = await MonsterModel.create({
        id,
        name,
        description,
        name_key: nameKey,
        description_key: descriptionKey,
        tier,
        level,
        stats,
        abilities,
        loot_table: lootTable,
        experience_reward: experienceReward,
        gold_reward: goldReward,
      });

      res.json({ success: true, monster });
    } catch (error) {
      console.error('Create monster error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create monster',
      });
    }
  });

  /**
   * Update monster
   */
  app.put('/api/admin/monsters/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        nameKey,
        descriptionKey,
        tier,
        level,
        stats,
        abilities,
        lootTable,
        experienceReward,
        goldReward,
      } = req.body;

      const { MonsterModel } = await import('../models/Monster.js');
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (nameKey !== undefined) updates.name_key = nameKey;
      if (descriptionKey !== undefined) updates.description_key = descriptionKey;
      if (tier !== undefined) updates.tier = tier;
      if (level !== undefined) updates.level = level;
      if (stats !== undefined) updates.stats = stats;
      if (abilities !== undefined) updates.abilities = abilities;
      if (lootTable !== undefined) updates.loot_table = lootTable;
      if (experienceReward !== undefined) updates.experience_reward = experienceReward;
      if (goldReward !== undefined) updates.gold_reward = goldReward;

      const monster = await MonsterModel.update(id, updates);
      if (!monster) {
        return res.status(404).json({ success: false, message: 'Monster not found' });
      }
      res.json({ success: true, monster });
    } catch (error) {
      console.error('Update monster error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update monster',
      });
    }
  });

  /**
   * Delete monster
   */
  app.delete('/api/admin/monsters/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { MonsterModel } = await import('../models/Monster.js');
      const deleted = await MonsterModel.delete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Monster not found' });
      }
      res.json({ success: true, message: 'Monster deleted successfully' });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete monster',
      });
    }
  });

  /**
   * Get all admin users
   */
  app.get('/api/admin/users', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { AdminUserModel } = await import('../models/AdminUser.js');
      const users = await AdminUserModel.listAll();
      // Remove password hashes from response
      const safeUsers = users.map(({ password_hash, ...user }) => user);
      res.json({ success: true, users: safeUsers });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch users',
      });
    }
  });

  /**
   * Create new admin user
   */
  app.post('/api/admin/users', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { username, password, email } = req.body;
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required',
        });
      }
      const { AdminUserModel } = await import('../models/AdminUser.js');
      const user = await AdminUserModel.create({ username, password, email });
      const { password_hash, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create user',
      });
    }
  });

  /**
   * Update admin user
   */
  app.put('/api/admin/users/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email, is_active, password } = req.body;
      const { AdminUserModel } = await import('../models/AdminUser.js');
      const user = await AdminUserModel.update(id, { email, is_active, password });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const { password_hash, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update user',
      });
    }
  });

  /**
   * Delete admin user
   */
  app.delete('/api/admin/users/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const authReq = req as AuthRequest;
      
      // Prevent self-deletion
      if (authReq.user && authReq.user.id === id) {
        return res.status(400).json({
          success: false,
          message: 'You cannot delete your own account',
        });
      }

      const { AdminUserModel } = await import('../models/AdminUser.js');
      const deleted = await AdminUserModel.delete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete user',
      });
    }
  });

  /**
   * Get all items
   */
  app.get('/api/admin/items', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { ItemModel } = await import('../models/Item.js');
      const items = await ItemModel.listAll();
      res.json({ success: true, items });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch items',
      });
    }
  });

  /**
   * Get single item
   */
  app.get('/api/admin/items/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { ItemModel } = await import('../models/Item.js');
      const item = await ItemModel.findById(id);
      if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }
      res.json({ success: true, item });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch item',
      });
    }
  });

  /**
   * Get all classes
   */
  app.get('/api/admin/classes', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { ClassModel } = await import('../models/Class.js');
      const classes = await ClassModel.listAll();
      res.json({ success: true, classes });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch classes',
      });
    }
  });

  /**
   * Get single class
   */
  app.get('/api/admin/classes/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { ClassModel } = await import('../models/Class.js');
      const cls = await ClassModel.findById(id);
      if (!cls) {
        return res.status(404).json({ success: false, message: 'Class not found' });
      }
      res.json({ success: true, class: cls });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch class',
      });
    }
  });

  /**
   * Get all skills
   */
  app.get('/api/admin/skills', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { SkillModel } = await import('../models/Skill.js');
      const skills = await SkillModel.listAll();
      res.json({ success: true, skills });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch skills',
      });
    }
  });

  /**
   * Get single skill
   */
  app.get('/api/admin/skills/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { SkillModel } = await import('../models/Skill.js');
      const skill = await SkillModel.findById(id);
      if (!skill) {
        return res.status(404).json({ success: false, message: 'Skill not found' });
      }
      res.json({ success: true, skill });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch skill',
      });
    }
  });

  /**
   * Get all dungeons
   */
  app.get('/api/admin/dungeons', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { DungeonModel } = await import('../models/Dungeon.js');
      const dungeons = await DungeonModel.listAll();
      res.json({ success: true, dungeons });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch dungeons',
      });
    }
  });

  /**
   * Get single dungeon
   */
  app.get('/api/admin/dungeons/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { DungeonModel } = await import('../models/Dungeon.js');
      const dungeon = await DungeonModel.findById(id);
      if (!dungeon) {
        return res.status(404).json({ success: false, message: 'Dungeon not found' });
      }
      res.json({ success: true, dungeon });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch dungeon',
      });
    }
  });

  /**
   * Get all quests
   */
  app.get('/api/admin/quests', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { QuestModel } = await import('../models/Quest.js');
      const quests = await QuestModel.listAll();
      res.json({ success: true, quests });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch quests',
      });
    }
  });

  /**
   * Get single quest
   */
  app.get('/api/admin/quests/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { QuestModel } = await import('../models/Quest.js');
      const quest = await QuestModel.findById(id);
      if (!quest) {
        return res.status(404).json({ success: false, message: 'Quest not found' });
      }
      res.json({ success: true, quest });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch quest',
      });
    }
  });

  /**
   * Get full floor layout (nodes and connections)
   */
  app.get('/api/admin/labyrinths/:id/floors/:floorId/layout', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id: labyrinth_id, floorId } = req.params;

      console.log(`[Load Layout] Loading floor ${floorId} for labyrinth ${labyrinth_id}`);

      // Verify floor belongs to labyrinth
      const floor = await LabyrinthFloorModel.findById(floorId);
      if (!floor || floor.labyrinth_id !== labyrinth_id) {
        console.log(`[Load Layout] Floor ${floorId} not found or doesn't belong to labyrinth ${labyrinth_id}`);
        return res.status(404).json({ success: false, message: 'Floor not found' });
      }

      // Get all nodes and connections
      const nodes = await FloorNodeModel.findByFloorId(floorId);
      const connections = await FloorConnectionModel.findByFloorId(floorId);

      console.log(`[Load Layout] Loaded ${nodes.length} nodes, ${connections.length} connections for floor ${floorId}`);

      res.json({
        success: true,
        floor,
        nodes: nodes || [],
        connections: connections || [],
      });
    } catch (error) {
      console.error('[Load Layout] Error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch floor layout',
      });
    }
  });

  /**
   * Save floor layout (bulk update nodes and connections)
   */
  app.post('/api/admin/labyrinths/:id/floors/:floorId/layout', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id: labyrinth_id, floorId } = req.params;
      const { nodes, connections, settings } = req.body;

      console.log(`[Save Layout] Floor ${floorId}: Saving ${nodes?.length || 0} nodes, ${connections?.length || 0} connections`);

      // Verify floor belongs to labyrinth
      const floor = await LabyrinthFloorModel.findById(floorId);
      if (!floor || floor.labyrinth_id !== labyrinth_id) {
        return res.status(404).json({ success: false, message: 'Floor not found' });
      }

      // Update floor settings if provided
      if (settings) {
        const updates: any = {};
        if (settings.time_limit_hours !== undefined) updates.time_limit_hours = settings.time_limit_hours;
        if (settings.movement_regen_rate !== undefined) updates.movement_regen_rate = settings.movement_regen_rate;
        if (settings.max_movement_points !== undefined) updates.max_movement_points = settings.max_movement_points;
        if (settings.environment_type !== undefined) {
          // Update environment_type in the floor record
          await pool.query(
            'UPDATE labyrinth_floors SET environment_type = $1 WHERE id = $2',
            [settings.environment_type, floorId]
          );
        }

        // Update other fields via rules if needed
        if (Object.keys(updates).length > 0) {
          await pool.query(
            `UPDATE labyrinth_floors 
             SET ${Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')}
             WHERE id = $1`,
            [floorId, ...Object.values(updates)]
          );
        }
      }

      // Handle bulk node operations
      let nodeIdMap = new Map<string, string>(); // old_id -> new_id
      
      // Always process nodes array (even if empty) to ensure consistency
      const nodesArray = Array.isArray(nodes) ? nodes : [];
      
      // Get existing node IDs for this floor
      const existingNodes = await FloorNodeModel.findByFloorId(floorId);
      const existingNodeIds = new Set(existingNodes.map(n => n.id));
      const newNodeIds = new Set(nodesArray.filter(n => n && n.id).map(n => n.id));

      console.log(`[Save Layout] Existing nodes: ${existingNodes.length}, New nodes: ${nodesArray.length}`);

      // Delete nodes that are not in the new list
      const nodesToDelete = existingNodes.filter(n => !newNodeIds.has(n.id));
      console.log(`[Save Layout] Deleting ${nodesToDelete.length} nodes`);
      for (const nodeToDelete of nodesToDelete) {
        await FloorNodeModel.delete(nodeToDelete.id);
      }

      // Create/update nodes, preserving IDs when provided
      for (const nodeData of nodesArray) {
        if (!nodeData) continue; // Skip null/undefined entries
        
        const newNode = await FloorNodeModel.create({
          id: nodeData.id, // Preserve existing ID if provided
          floor_id: floorId,
          node_type: nodeData.node_type,
          x_coordinate: nodeData.x_coordinate,
          y_coordinate: nodeData.y_coordinate,
          name: nodeData.name,
          description: nodeData.description,
          metadata: nodeData.metadata || {},
          required_boss_defeated: nodeData.required_boss_defeated || null,
          is_revealed: nodeData.is_revealed ?? false,
          is_start_point: nodeData.is_start_point ?? false,
          leads_to_floor_number: nodeData.leads_to_floor_number || null,
          capacity_limit: nodeData.capacity_limit || null,
        });
        
        // Map old ID to new ID (should be same if ID was preserved)
        if (nodeData.id) {
          nodeIdMap.set(nodeData.id, newNode.id);
        }
      }

      // Handle bulk connection operations
      // Always process connections array (even if empty) to ensure consistency
      const connectionsArray = Array.isArray(connections) ? connections : [];
      
      // Get existing connection IDs for this floor
      const existingConnections = await FloorConnectionModel.findByFloorId(floorId);
      const existingConnectionIds = new Set(existingConnections.map(c => c.id));
      const newConnectionIds = new Set(connectionsArray.filter(c => c && c.id).map(c => c.id));

      console.log(`[Save Layout] Existing connections: ${existingConnections.length}, New connections: ${connectionsArray.length}`);

      // Delete connections that are not in the new list
      const connectionsToDelete = existingConnections.filter(c => !newConnectionIds.has(c.id));
      console.log(`[Save Layout] Deleting ${connectionsToDelete.length} connections`);
      for (const connToDelete of connectionsToDelete) {
        await FloorConnectionModel.delete(connToDelete.id);
      }

      // Create/update connections with mapped node IDs, preserving IDs when provided
      for (const connData of connectionsArray) {
        if (!connData) continue; // Skip null/undefined entries
        
        // Map old node IDs to new node IDs
        const newFromId = nodeIdMap.get(connData.from_node_id) || connData.from_node_id;
        const newToId = nodeIdMap.get(connData.to_node_id) || connData.to_node_id;
        
        // Verify both nodes exist (in case mapping failed)
        const fromNode = await FloorNodeModel.findById(newFromId);
        const toNode = await FloorNodeModel.findById(newToId);
        
        if (!fromNode || fromNode.floor_id !== floorId) {
          console.warn(`[Save Layout] Skipping connection: invalid from_node_id ${newFromId}`);
          continue;
        }
        
        if (!toNode || toNode.floor_id !== floorId) {
          console.warn(`[Save Layout] Skipping connection: invalid to_node_id ${newToId}`);
          continue;
        }
        
        await FloorConnectionModel.create({
          id: connData.id, // Preserve existing ID if provided
          floor_id: floorId,
          from_node_id: newFromId,
          to_node_id: newToId,
          movement_cost: connData.movement_cost || 1,
          is_bidirectional: connData.is_bidirectional ?? true,
          required_item: connData.required_item || null,
          visibility_requirement: connData.visibility_requirement || null,
        });
      }

      console.log(`[Save Layout] Successfully saved floor ${floorId}`);

      // Reload updated layout to verify persistence
      const updatedNodes = await FloorNodeModel.findByFloorId(floorId);
      const updatedConnections = await FloorConnectionModel.findByFloorId(floorId);
      const updatedFloor = await LabyrinthFloorModel.findById(floorId);

      console.log(`[Save Layout] Reloaded: ${updatedNodes.length} nodes, ${updatedConnections.length} connections`);

      if (updatedNodes.length === 0 && nodesArray.length > 0) {
        console.error(`[Save Layout] WARNING: Saved ${nodesArray.length} nodes but reloaded 0!`);
      }

      res.json({
        success: true,
        floor: updatedFloor,
        nodes: updatedNodes,
        connections: updatedConnections,
      });
    } catch (error) {
      console.error('[Save Layout] Error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save floor layout',
      });
    }
  });

  /**
   * Generate procedural layout for a floor
   */
  app.post('/api/admin/labyrinths/:id/floors/:floorId/generate', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id: labyrinth_id, floorId } = req.params;
      const { config } = req.body;

      // Verify floor belongs to labyrinth
      const floor = await LabyrinthFloorModel.findById(floorId);
      if (!floor || floor.labyrinth_id !== labyrinth_id) {
        return res.status(404).json({ success: false, message: 'Floor not found' });
      }

      // If config.replace is true, clear existing layout first
      if (config.replace) {
        await FloorNodeModel.deleteByFloorId(floorId);
        await FloorConnectionModel.deleteByFloorId(floorId);
      }

      // Generate layout
      const layout = await ProceduralGenerator.generateFloorLayout({
        floor_id: floorId,
        totalNodes: config.totalNodes || 50,
        bossCount: config.bossCount || 3,
        safeZoneCount: config.safeZoneCount || 5,
        craftingCount: config.craftingCount || 5,
        stairCount: config.stairCount || 2,
        startPointCount: config.startPointCount,
        layoutType: config.layoutType || 'maze',
        connectionDensity: config.connectionDensity || 0.5,
        poiWaveCombatEnabled: config.poiWaveCombatEnabled,
        poiWaveCombatPercentage: config.poiWaveCombatPercentage,
        poiWaveConfig: config.poiWaveConfig,
      });

      res.json({
        success: true,
        nodes: layout.nodes,
        connections: layout.connections,
      });
    } catch (error) {
      console.error('Generate layout error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate layout',
      });
    }
  });

  /**
   * Export floor layout as JSON
   */
  app.post('/api/admin/labyrinths/:id/floors/:floorId/export', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id: labyrinth_id, floorId } = req.params;

      // Verify floor belongs to labyrinth
      const floor = await LabyrinthFloorModel.findById(floorId);
      if (!floor || floor.labyrinth_id !== labyrinth_id) {
        return res.status(404).json({ success: false, message: 'Floor not found' });
      }

      // Get nodes and connections
      const nodes = await FloorNodeModel.findByFloorId(floorId);
      const connections = await FloorConnectionModel.findByFloorId(floorId);

      const exportData = {
        version: '1.0.0',
        floor_id: floorId,
        floor_number: floor.floor_number,
        settings: {
          time_limit_hours: floor.time_limit_hours,
          movement_regen_rate: floor.movement_regen_rate,
          max_movement_points: floor.max_movement_points,
          environment_type: floor.environment_type,
        },
        nodes: nodes.map(n => ({
          id: n.id,
          node_type: n.node_type,
          x_coordinate: n.x_coordinate,
          y_coordinate: n.y_coordinate,
          name: n.name,
          description: n.description,
          metadata: n.metadata,
          required_boss_defeated: n.required_boss_defeated,
          is_revealed: n.is_revealed,
          is_start_point: n.is_start_point,
          leads_to_floor_number: n.leads_to_floor_number,
          capacity_limit: n.capacity_limit,
        })),
        connections: connections.map(c => ({
          id: c.id,
          from_node_id: c.from_node_id,
          to_node_id: c.to_node_id,
          movement_cost: c.movement_cost,
          is_bidirectional: c.is_bidirectional,
          required_item: c.required_item,
          visibility_requirement: c.visibility_requirement,
        })),
      };

      res.json({ success: true, data: exportData });
    } catch (error) {
      console.error('Export floor layout error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to export floor layout',
      });
    }
  });

  /**
   * Import floor layout from JSON
   */
  app.post('/api/admin/labyrinths/:id/floors/:floorId/import', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id: labyrinth_id, floorId } = req.params;
      const { data } = req.body;

      // Verify floor belongs to labyrinth
      const floor = await LabyrinthFloorModel.findById(floorId);
      if (!floor || floor.labyrinth_id !== labyrinth_id) {
        return res.status(404).json({ success: false, message: 'Floor not found' });
      }

      // Validate import data
      if (!data || !data.nodes || !Array.isArray(data.nodes)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid import data: nodes array is required',
        });
      }

      // Update floor settings if provided
      if (data.settings) {
        const updates: any = {};
        if (data.settings.time_limit_hours !== undefined) updates.time_limit_hours = data.settings.time_limit_hours;
        if (data.settings.movement_regen_rate !== undefined) updates.movement_regen_rate = data.settings.movement_regen_rate;
        if (data.settings.max_movement_points !== undefined) updates.max_movement_points = data.settings.max_movement_points;
        if (data.settings.environment_type !== undefined) {
          await pool.query(
            'UPDATE labyrinth_floors SET environment_type = $1 WHERE id = $2',
            [data.settings.environment_type, floorId]
          );
        }

        if (Object.keys(updates).length > 0) {
          await pool.query(
            `UPDATE labyrinth_floors 
             SET ${Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ')}
             WHERE id = $1`,
            [floorId, ...Object.values(updates)]
          );
        }
      }

      // Clear existing layout
      await FloorNodeModel.deleteByFloorId(floorId);
      await FloorConnectionModel.deleteByFloorId(floorId);

      // Import nodes
      const nodeIdMap = new Map<string, string>(); // old_id -> new_id
      for (const nodeData of data.nodes) {
        const newNode = await FloorNodeModel.create({
          floor_id: floorId,
          node_type: nodeData.node_type,
          x_coordinate: nodeData.x_coordinate,
          y_coordinate: nodeData.y_coordinate,
          name: nodeData.name,
          description: nodeData.description,
          metadata: nodeData.metadata || {},
          required_boss_defeated: nodeData.required_boss_defeated || null,
          is_revealed: nodeData.is_revealed ?? false,
          is_start_point: nodeData.is_start_point ?? false,
          leads_to_floor_number: nodeData.leads_to_floor_number || null,
          capacity_limit: nodeData.capacity_limit || null,
        });
        if (nodeData.id) {
          nodeIdMap.set(nodeData.id, newNode.id);
        }
      }

      // Import connections (map old IDs to new IDs)
      if (data.connections && Array.isArray(data.connections)) {
        for (const connData of data.connections) {
          const newFromId = nodeIdMap.get(connData.from_node_id) || connData.from_node_id;
          const newToId = nodeIdMap.get(connData.to_node_id) || connData.to_node_id;

          await FloorConnectionModel.create({
            floor_id: floorId,
            from_node_id: newFromId,
            to_node_id: newToId,
            movement_cost: connData.movement_cost || 1,
            is_bidirectional: connData.is_bidirectional ?? true,
            required_item: connData.required_item || null,
            visibility_requirement: connData.visibility_requirement || null,
          });
        }
      }

      // Start points are now handled via is_start_point flag on nodes
      // If importing old data with start_node_id in settings, mark that node as start point
      if (data.settings?.start_node_id && nodeIdMap.has(data.settings.start_node_id)) {
        const mappedNodeId = nodeIdMap.get(data.settings.start_node_id);
        if (mappedNodeId) {
          await FloorNodeModel.update(mappedNodeId, { is_start_point: true });
        }
      }

      // Reload layout
      const updatedNodes = await FloorNodeModel.findByFloorId(floorId);
      const updatedConnections = await FloorConnectionModel.findByFloorId(floorId);

      res.json({
        success: true,
        nodes: updatedNodes,
        connections: updatedConnections,
      });
    } catch (error) {
      console.error('Import floor layout error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import floor layout',
      });
    }
  });

  /**
   * Create a single floor node
   */
  app.post('/api/admin/floors/:floorId/nodes', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { floorId } = req.params;
      const { node_type, x_coordinate, y_coordinate, name, description, metadata } = req.body;

      // Verify floor exists
      const floor = await LabyrinthFloorModel.findById(floorId);
      if (!floor) {
        return res.status(404).json({ success: false, message: 'Floor not found' });
      }

      // Validate required fields
      if (!node_type || x_coordinate === undefined || y_coordinate === undefined) {
        return res.status(400).json({
          success: false,
          message: 'node_type, x_coordinate, and y_coordinate are required',
        });
      }

      const node = await FloorNodeModel.create({
        floor_id: floorId,
        node_type,
        x_coordinate: parseFloat(x_coordinate),
        y_coordinate: parseFloat(y_coordinate),
        name: name || null,
        description: description || null,
        metadata: metadata || {},
      });

      res.json({ success: true, node });
    } catch (error) {
      console.error('Create node error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create node',
      });
    }
  });

  /**
   * Update a single floor node
   */
  app.put('/api/admin/floors/nodes/:nodeId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const updates = req.body;

      // Verify node exists
      const existingNode = await FloorNodeModel.findById(nodeId);
      if (!existingNode) {
        return res.status(404).json({ success: false, message: 'Node not found' });
      }

      // Build update object
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
      if (updates.is_revealed !== undefined) updateData.is_revealed = updates.is_revealed;
      if (updates.is_start_point !== undefined) updateData.is_start_point = updates.is_start_point;
      if (updates.leads_to_floor_number !== undefined) updateData.leads_to_floor_number = updates.leads_to_floor_number;
      if (updates.capacity_limit !== undefined) updateData.capacity_limit = updates.capacity_limit;

      const updatedNode = await FloorNodeModel.update(nodeId, updateData);
      if (!updatedNode) {
        return res.status(404).json({ success: false, message: 'Node not found' });
      }

      res.json({ success: true, node: updatedNode });
    } catch (error) {
      console.error('Update node error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update node',
      });
    }
  });

  /**
   * Delete a single floor node
   */
  app.delete('/api/admin/floors/nodes/:nodeId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const success = await FloorNodeModel.delete(nodeId);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Node not found' });
      }
      res.json({ success: true, message: 'Node deleted' });
    } catch (error) {
      console.error('Delete node error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete node',
      });
    }
  });

  /**
   * Create a single floor connection
   */
  app.post('/api/admin/floors/:floorId/connections', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { floorId } = req.params;
      const { from_node_id, to_node_id, movement_cost, is_bidirectional, required_item, visibility_requirement } = req.body;

      // Verify floor exists
      const floor = await LabyrinthFloorModel.findById(floorId);
      if (!floor) {
        return res.status(404).json({ success: false, message: 'Floor not found' });
      }

      // Validate required fields
      if (!from_node_id || !to_node_id) {
        return res.status(400).json({
          success: false,
          message: 'from_node_id and to_node_id are required',
        });
      }

      // Verify both nodes exist and belong to the floor
      const fromNode = await FloorNodeModel.findById(from_node_id);
      const toNode = await FloorNodeModel.findById(to_node_id);

      if (!fromNode || fromNode.floor_id !== floorId) {
        return res.status(400).json({ success: false, message: 'Invalid from_node_id' });
      }

      if (!toNode || toNode.floor_id !== floorId) {
        return res.status(400).json({ success: false, message: 'Invalid to_node_id' });
      }

      // Check if connection already exists
      const existing = await FloorConnectionModel.findByNodes(from_node_id, to_node_id);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Connection already exists' });
      }

      const connection = await FloorConnectionModel.create({
        floor_id: floorId,
        from_node_id,
        to_node_id,
        movement_cost: movement_cost || 1,
        is_bidirectional: is_bidirectional !== undefined ? is_bidirectional : true,
        required_item: required_item || null,
        visibility_requirement: visibility_requirement || null,
      });

      res.json({ success: true, connection });
    } catch (error) {
      console.error('Create connection error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create connection',
      });
    }
  });

  /**
   * Delete a single floor connection
   */
  app.delete('/api/admin/floors/connections/:connectionId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params;
      const success = await FloorConnectionModel.delete(connectionId);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Connection not found' });
      }
      res.json({ success: true, message: 'Connection deleted' });
    } catch (error) {
      console.error('Delete connection error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete connection',
      });
    }
  });
}
