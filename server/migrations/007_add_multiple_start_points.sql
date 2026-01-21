-- Migration: Add support for multiple start points per floor
-- This replaces the single start_node_id on labyrinth_floors with is_start_point flag on nodes

-- Step 1: Add is_start_point column to labyrinth_floor_nodes
ALTER TABLE labyrinth_floor_nodes 
ADD COLUMN IF NOT EXISTS is_start_point BOOLEAN DEFAULT false;

-- Step 2: Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_floor_nodes_start_point ON labyrinth_floor_nodes(floor_id, is_start_point) WHERE is_start_point = true;

-- Step 3: Migrate existing start_node_id values to is_start_point
-- Mark all nodes that are currently referenced as start nodes
UPDATE labyrinth_floor_nodes
SET is_start_point = true
WHERE id IN (
  SELECT start_node_id 
  FROM labyrinth_floors 
  WHERE start_node_id IS NOT NULL
);

-- Step 4: For floors without a start_node_id, mark the first node as start point
-- This ensures backward compatibility
DO $$
DECLARE
  floor_record RECORD;
  first_node_id UUID;
BEGIN
  FOR floor_record IN 
    SELECT id FROM labyrinth_floors 
    WHERE start_node_id IS NULL
  LOOP
    -- Get the first node for this floor (by creation time)
    SELECT id INTO first_node_id
    FROM labyrinth_floor_nodes
    WHERE floor_id = floor_record.id
    ORDER BY created_at
    LIMIT 1;
    
    -- Mark it as start point if found
    IF first_node_id IS NOT NULL THEN
      UPDATE labyrinth_floor_nodes
      SET is_start_point = true
      WHERE id = first_node_id;
    END IF;
  END LOOP;
END $$;

-- Step 5: Drop the foreign key constraint first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'labyrinth_floors_start_node_id_fkey'
  ) THEN
    ALTER TABLE labyrinth_floors
    DROP CONSTRAINT labyrinth_floors_start_node_id_fkey;
  END IF;
END $$;

-- Step 6: Remove start_node_id column from labyrinth_floors
ALTER TABLE labyrinth_floors 
DROP COLUMN IF EXISTS start_node_id;
