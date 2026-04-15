import { contextBridge } from 'electron';
import { ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('checkersApi', {
  platform: process.platform,
  checkForUpdates: () => ipcRenderer.invoke('updates:check-now'),
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  }
});
