// Script to copy data files to client public directory for Vite
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const publicDataDir = path.join(__dirname, '../client/public/data');

// Create public/data directory if it doesn't exist
if (!fs.existsSync(publicDataDir)) {
  fs.mkdirSync(publicDataDir, { recursive: true });
}

// Copy data directory recursively
function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

copyRecursive(dataDir, publicDataDir);
console.log('Data files copied to client/public/data');

// Generate items manifest
const itemsDir = path.join(publicDataDir, 'items');
if (fs.existsSync(itemsDir)) {
  const itemFiles = fs.readdirSync(itemsDir).filter(file => file.endsWith('.json'));
  const itemIds = itemFiles.map(file => file.replace('.json', '')).sort();
  
  const manifest = {
    items: itemIds
  };
  
  const manifestPath = path.join(publicDataDir, 'items', 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Generated items manifest with ${itemIds.length} items`);
}

