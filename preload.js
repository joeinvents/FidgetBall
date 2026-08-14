const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  reportBall: (region) => ipcRenderer.send('overlay:ball', region),
  onCursor: (handler) => ipcRenderer.on('overlay:cursor', (_event, cursor) => handler(cursor)),
  onCommand: (handler) => ipcRenderer.on('overlay:command', (_event, name) => handler(name))
});
