// Script to copy data files to client public directory for Vite
// Only copies combined JSON files, config, and schemas (excludes individual data files)
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const publicDataDir = path.join(__dirname, '../client/public/data');

// Create public/data directory if it doesn't exist
if (!fs.existsSync(publicDataDir)) {
  fs.mkdirSync(publicDataDir, { recursive: true });
}

// Data directories that have combined files (exclude individual files)
const dataDirectoriesWithCombinedFiles = [
  'classes',
  'monsters',
  'skills',
  'dungeons',
  'quests',
  'mercenaries',
  'upgrades',
  'achievements',
  'items',
];

// Directories to copy entirely (not data directories)
const fullCopyDirectories = ['config', 'schemas', 'chronicle', 'divination', 'enchantments', 'city'];

// Files to copy from root
const rootFiles = ['README.md'];

/**
 * Copy a file from source to destination
 */
function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

/**
 * Clean up old individual files from a data directory, keeping only the combined file
 */
function cleanupDataDirectory(dirPath, combinedFileName) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let deletedCount = 0;

  for (const entry of entries) {
    if (entry.isFile() && entry.name !== combinedFileName && entry.name.endsWith('.json')) {
      const filePath = path.join(dirPath, entry.name);
      fs.unlinkSync(filePath);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    console.log(`  Cleaned up ${deletedCount} old individual files from ${path.basename(dirPath)}/`);
  }
}

/**
 * Copy data directory, excluding individual JSON files in favor of combined files
 */
function copyDataSelectively(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Check if this is a data directory with combined files
      if (dataDirectoriesWithCombinedFiles.includes(entry.name)) {
        // Create the directory
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        
        // Only copy the combined {type}.json file
        const combinedFileName = `${entry.name}.json`;
        const combinedFileSrc = path.join(srcPath, combinedFileName);
        const combinedFileDest = path.join(destPath, combinedFileName);
        
        if (fs.existsSync(combinedFileSrc)) {
          copyFile(combinedFileSrc, combinedFileDest);
          console.log(`  Copied ${combinedFileName}`);
          // Clean up any old individual files that shouldn't be there
          cleanupDataDirectory(destPath, combinedFileName);
        } else {
          console.warn(`  Warning: Combined file ${combinedFileName} not found in ${entry.name}/`);
        }
      } else if (fullCopyDirectories.includes(entry.name)) {
        // Copy the entire directory (config, schemas, etc.)
        copyDirectoryRecursive(srcPath, destPath);
      }
      // Skip other directories
    } else if (entry.isFile()) {
      // Copy root-level files (README.md, etc.)
      if (rootFiles.includes(entry.name)) {
        copyFile(srcPath, destPath);
      }
    }
  }
}

/**
 * Recursively copy a directory and all its contents
 */
function copyDirectoryRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

// Copy data files selectively
console.log('Copying data files (combined JSON files only)...');
copyDataSelectively(dataDir, publicDataDir);
console.log('Data files copied to client/public/data');
