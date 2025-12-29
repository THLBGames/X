const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data', 'upgrades');
const publicDataDir = path.join(__dirname, '..', 'client', 'public', 'data', 'upgrades');

// Ensure directories exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(publicDataDir)) {
  fs.mkdirSync(publicDataDir, { recursive: true });
}

const skillIds = [
  'mining',
  'fishing',
  'woodcutting',
  'herbalism',
  'hunting',
  'archaeology',
  'quarrying',
  'foraging',
  'treasure_hunting',
  'thieving',
  'trapping',
  'divination',
  'cooking',
  'blacksmithing',
  'alchemy',
  'enchanting',
  'tailoring',
  'leatherworking',
  'jewelcrafting',
  'engineering',
  'runecrafting',
  'farming',
];

const categories = ['gathering', 'production', 'hybrid'];
const tiers = ['I', 'II', 'III', 'IV', 'V'];

// Tier bonus multipliers (cumulative)
const tierBonuses = {
  I: { exp: 1.1, speed: 0.95, yield: 1.05, success: 0.05 },
  II: { exp: 1.15, speed: 0.92, yield: 1.08, success: 0.08 },
  III: { exp: 1.2, speed: 0.88, yield: 1.12, success: 0.12 },
  IV: { exp: 1.25, speed: 0.85, yield: 1.15, success: 0.15 },
  V: { exp: 1.3, speed: 0.8, yield: 1.2, success: 0.2 },
};

// Base prices
const basePrice = 1000;
const categoryBasePrice = 2000;

// Price scaling: basePrice * (tierNumber ^ 1.5)
function getPrice(base, tier) {
  const tierNum = tiers.indexOf(tier) + 1;
  return Math.floor(base * Math.pow(tierNum, 1.5));
}

// Generate permanent skill upgrades
for (const skillId of skillIds) {
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const bonus = tierBonuses[tier];
    const previousTier = i > 0 ? tiers[i - 1] : null;
    
    const upgrade = {
      id: `${skillId}_upgrade_${tier}`,
      name: `${skillId.charAt(0).toUpperCase() + skillId.slice(1).replace(/_/g, ' ')} Upgrade ${tier}`,
      description: `Permanently increases ${skillId.replace(/_/g, ' ')} XP gain by ${Math.round((bonus.exp - 1) * 100)}%, speed by ${Math.round((1 - bonus.speed) * 100)}%, and yield by ${Math.round((bonus.yield - 1) * 100)}%`,
      type: 'permanent',
      scope: 'skill',
      skillId: skillId,
      tier: tier,
      price: getPrice(basePrice, tier),
      bonuses: {
        experienceMultiplier: bonus.exp,
        speedMultiplier: bonus.speed,
        yieldMultiplier: bonus.yield,
        successRateBonus: bonus.success,
      },
      requirements: previousTier ? {
        previousTierId: `${skillId}_upgrade_${previousTier}`,
      } : {},
    };

    const filename = `${skillId}_upgrade_${tier}.json`;
    fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(upgrade, null, 2));
    fs.writeFileSync(path.join(publicDataDir, filename), JSON.stringify(upgrade, null, 2));
  }
}

// Generate permanent category upgrades
for (const category of categories) {
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const bonus = tierBonuses[tier];
    const previousTier = i > 0 ? tiers[i - 1] : null;
    
    const upgrade = {
      id: `${category}_upgrade_${tier}`,
      name: `${category.charAt(0).toUpperCase() + category.slice(1)} Upgrade ${tier}`,
      description: `Permanently increases all ${category} skill XP gain by ${Math.round((bonus.exp - 1) * 100)}%, speed by ${Math.round((1 - bonus.speed) * 100)}%, and yield by ${Math.round((bonus.yield - 1) * 100)}%`,
      type: 'permanent',
      scope: 'category',
      category: category,
      tier: tier,
      price: getPrice(categoryBasePrice, tier),
      bonuses: {
        experienceMultiplier: bonus.exp,
        speedMultiplier: bonus.speed,
        yieldMultiplier: bonus.yield,
        successRateBonus: bonus.success,
      },
      requirements: previousTier ? {
        previousTierId: `${category}_upgrade_${previousTier}`,
      } : {},
    };

    const filename = `${category}_upgrade_${tier}.json`;
    fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(upgrade, null, 2));
    fs.writeFileSync(path.join(publicDataDir, filename), JSON.stringify(upgrade, null, 2));
  }
}

// Generate consumable skill boosts
for (const skillId of skillIds) {
  const upgrade = {
    id: `${skillId}_boost_consumable`,
    name: `${skillId.charAt(0).toUpperCase() + skillId.slice(1).replace(/_/g, ' ')} Boost`,
    description: `Temporarily increases ${skillId.replace(/_/g, ' ')} speed by 30% for 50 actions`,
    type: 'consumable',
    scope: 'skill',
    skillId: skillId,
    price: 500,
    bonuses: {
      speedMultiplier: 0.7, // 30% faster
      experienceMultiplier: 1.2, // 20% more XP
    },
    actionDuration: 50,
    requirements: {},
  };

  const filename = `${skillId}_boost_consumable.json`;
  fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(upgrade, null, 2));
  fs.writeFileSync(path.join(publicDataDir, filename), JSON.stringify(upgrade, null, 2));
}

// Generate consumable category boosts
for (const category of categories) {
  const upgrade = {
    id: `${category}_boost_consumable`,
    name: `${category.charAt(0).toUpperCase() + category.slice(1)} Boost`,
    description: `Temporarily increases all ${category} skill speed by 25% for 75 actions`,
    type: 'consumable',
    scope: 'category',
    category: category,
    price: 1000,
    bonuses: {
      speedMultiplier: 0.75, // 25% faster
      experienceMultiplier: 1.15, // 15% more XP
    },
    actionDuration: 75,
    requirements: {},
  };

  const filename = `${category}_boost_consumable.json`;
  fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(upgrade, null, 2));
  fs.writeFileSync(path.join(publicDataDir, filename), JSON.stringify(upgrade, null, 2));
}

console.log('Generated upgrade files:');
console.log(`- ${skillIds.length * 5} permanent skill upgrades`);
console.log(`- ${categories.length * 5} permanent category upgrades`);
console.log(`- ${skillIds.length} consumable skill boosts`);
console.log(`- ${categories.length} consumable category boosts`);
console.log(`Total: ${skillIds.length * 5 + categories.length * 5 + skillIds.length + categories.length} files`);

