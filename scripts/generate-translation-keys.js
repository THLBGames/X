const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

// Entity type mappings
const entityTypes = {
  items: 'item',
  monsters: 'monster',
  skills: 'skill',
  classes: 'class',
  dungeons: 'dungeon',
  achievements: 'achievement',
  upgrades: 'upgrade',
  mercenaries: 'mercenary',
  quests: 'quest',
};

/**
 * Generate translation key for an entity
 */
function generateTranslationKey(entityType, entityId, field) {
  return `${entityType}.${entityId}.${field}`;
}

/**
 * Process a single JSON file and add translation keys
 */
function processFile(filePath, entityType) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    // Skip if already has translation keys
    if (data.nameKey && data.descriptionKey) {
      return false;
    }

    let modified = false;

    // Add nameKey if missing
    if (data.id && data.name && !data.nameKey) {
      data.nameKey = generateTranslationKey(entityType, data.id, 'name');
      modified = true;
    }

    // Add descriptionKey if missing and description exists
    if (data.id && data.description && !data.descriptionKey) {
      data.descriptionKey = generateTranslationKey(entityType, data.id, 'description');
      modified = true;
    }

    if (modified) {
      // Write back with proper formatting
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Process all files in a directory
 */
function processDirectory(dirPath, entityType) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory not found: ${dirPath}`);
    return { processed: 0, updated: 0 };
  }

  const files = fs.readdirSync(dirPath);
  let processed = 0;
  let updated = 0;

  for (const file of files) {
    if (file.endsWith('.json') && file !== 'items.json' && file !== 'monsters.json' 
        && file !== 'skills.json' && file !== 'classes.json' && file !== 'dungeons.json'
        && file !== 'achievements.json' && file !== 'upgrades.json' && file !== 'mercenaries.json'
        && file !== 'quests.json') {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        processed++;
        if (processFile(filePath, entityType)) {
          updated++;
          console.log(`Updated: ${filePath}`);
        }
      }
    }
  }

  return { processed, updated };
}

/**
 * Main function
 */
function main() {
  console.log('Generating translation keys for game data files...\n');

  let totalProcessed = 0;
  let totalUpdated = 0;

  // Process each entity type
  for (const [dirName, entityType] of Object.entries(entityTypes)) {
    const dirPath = path.join(dataDir, dirName);
    console.log(`Processing ${dirName}...`);
    
    const result = processDirectory(dirPath, entityType);
    totalProcessed += result.processed;
    totalUpdated += result.updated;
    
    console.log(`  Processed: ${result.processed}, Updated: ${result.updated}\n`);
  }

  console.log(`\nTotal: Processed ${totalProcessed} files, Updated ${totalUpdated} files`);
}

main();

