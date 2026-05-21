'use strict';

const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('node:path');
const fs   = require('node:fs');
const { parseStl }  = require('./src/stl-parser');
const { parse3mf }  = require('./src/3mf-parser');
const { parseObj }  = require('./src/obj-parser');

app.setName('Glep');

// ── Settings ────────────────────────────────────────────────────────────────
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function getSettings() {
  try {
    if (fs.existsSync(settingsPath))
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {}
  return {};
}

function setSettings(data) {
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

// ── Directory scan ───────────────────────────────────────────────────────────
function scanDirectory(dirPath) {
  const results = [];

  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) { walk(fullPath); continue; }
      const ext = path.extname(e.name);
      if (/^\.(stl|3mf|obj)$/i.test(ext)) {
        results.push({
          fullPath,
          fileName: e.name,
          subPath: path.relative(dirPath, dir),
          ext: ext.slice(1).toUpperCase(),
        });
      }
    }
  };

  walk(dirPath);
  return results.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

// ── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.jpg'));

  const win = new BrowserWindow({
    width: 1200,
    height: 720,
    minWidth: 700,
    minHeight: 500,
    title: 'Glep',
    icon,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('renderer/index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// ── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('dialog:open-folder', async () => {
  const settings = getSettings();
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    defaultPath: settings.lastDirectory,
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('fs:scan-directory', (_, dirPath) => {
  return scanDirectory(dirPath);
});

ipcMain.handle('model:load', (_, filePath) => {
  try {
    const ext  = path.extname(filePath).toLowerCase();
    const data = ext === '.stl' ? parseStl(filePath)
               : ext === '.3mf' ? parse3mf(filePath)
               : parseObj(filePath);
    return data
      ? { ok: true, ...data }
      : { ok: false, error: 'Could not parse file' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('settings:get', ()       => getSettings());
ipcMain.handle('settings:set', (_, d)   => setSettings(d));

ipcMain.handle('file:rename', (_, oldPath, newPath) => {
  try {
    fs.renameSync(oldPath, newPath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
