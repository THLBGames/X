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

