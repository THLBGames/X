const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const localesDir = path.join(__dirname, '..', 'client', 'src', 'locales', 'en');

// Ensure locales directory exists
if (!fs.existsSync(localesDir)) {
  fs.mkdirSync(localesDir, { recursive: true });
}

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
 * Process a single JSON file and extract translations
 */
function extractTranslations(filePath, entityType) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    const translations = {};

    if (data.nameKey && data.name) {
      translations[data.nameKey] = data.name;
    }

    if (data.descriptionKey && data.description) {
      translations[data.descriptionKey] = data.description;
    }

    return translations;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return {};
  }
}

/**
 * Process all files in a directory
 */
function processDirectory(dirPath, entityType) {
  if (!fs.existsSync(dirPath)) {
    return {};
  }

  const files = fs.readdirSync(dirPath);
  const translations = {};

  for (const file of files) {
    if (file.endsWith('.json') && file !== 'items.json' && file !== 'monsters.json' 
        && file !== 'skills.json' && file !== 'classes.json' && file !== 'dungeons.json'
        && file !== 'achievements.json' && file !== 'upgrades.json' && file !== 'mercenaries.json'
        && file !== 'quests.json') {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        const fileTranslations = extractTranslations(filePath, entityType);
        Object.assign(translations, fileTranslations);
      }
    }
  }

  return translations;
}

/**
 * Generate gameData.json translation file
 */
function generateGameDataTranslations() {
  console.log('Generating gameData.json translations...\n');

  const gameData = {
    item: {},
    monster: {},
    skill: {},
    class: {},
    dungeon: {},
    achievement: {},
    upgrade: {},
    mercenary: {},
    quest: {},
  };

  // Process each entity type
  for (const [dirName, entityType] of Object.entries(entityTypes)) {
    const dirPath = path.join(dataDir, dirName);
    console.log(`Processing ${dirName}...`);
    
    const translations = processDirectory(dirPath, entityType);
    
    // Organize by entity type
    for (const [key, value] of Object.entries(translations)) {
      const parts = key.split('.');
      if (parts.length === 3 && parts[0] === entityType) {
        const entityId = parts[1];
        const field = parts[2];
        
        if (!gameData[entityType][entityId]) {
          gameData[entityType][entityId] = {};
        }
        gameData[entityType][entityId][field] = value;
      }
    }
    
    const count = Object.keys(translations).length / 2; // name + description per entity
    console.log(`  Extracted ${Math.floor(count)} translations\n`);
  }

  // Write gameData.json
  const gameDataPath = path.join(localesDir, 'gameData.json');
  fs.writeFileSync(
    gameDataPath,
    JSON.stringify(gameData, null, 2) + '\n',
    'utf8'
  );

  console.log(`Generated ${gameDataPath}`);
  return gameData;
}

generateGameDataTranslations();

