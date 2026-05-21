'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('glep', {
  openFolder:    ()          => ipcRenderer.invoke('dialog:open-folder'),
  scanDirectory: (dirPath)   => ipcRenderer.invoke('fs:scan-directory', dirPath),
  loadModel:     (filePath)  => ipcRenderer.invoke('model:load', filePath),
  getSettings:   ()                    => ipcRenderer.invoke('settings:get'),
  saveSettings:  (data)                => ipcRenderer.invoke('settings:set', data),
  renameFile:    (oldPath, newPath)    => ipcRenderer.invoke('file:rename', oldPath, newPath),
});
