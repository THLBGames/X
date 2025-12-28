const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: Get platform info
  getPlatform: () => process.platform,
  
  // Example: Steam integration methods (if needed)
  // steam: {
  //   getAppId: () => ipcRenderer.invoke('steam:getAppId'),
  //   setAchievement: (achievementId) => ipcRenderer.invoke('steam:setAchievement', achievementId),
  // },
});

