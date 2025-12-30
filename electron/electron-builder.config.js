module.exports = {
  appId: 'com.idlerpg.game',
  productName: 'Tales of Heroes, Legends & Beasts',
  directories: {
    output: 'dist-electron',
  },
  files: [
    'electron/**/*',
    'client/dist/**/*',
    'package.json',
  ],
  win: {
    target: 'nsis',
    icon: 'build/icon.ico',
  },
  mac: {
    target: 'dmg',
    icon: 'build/icon.icns',
    category: 'games',
  },
  linux: {
    target: 'AppImage',
    icon: 'build/icon.png',
    category: 'Game',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
};

