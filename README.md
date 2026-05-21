# Glep

A lightweight desktop app for browsing and previewing 3D print files. Point it at a folder (local or NAS), click a file, and see the model rendered immediately.

## Features

- Supports **STL**, **3MF**, and **OBJ** files
- Recursive directory scan — finds files nested inside subdirectories
- Orbit, pan, and zoom with the mouse; preset views (Front, Back, Right, Left, Top, Bottom, Iso)
- Adjustable model color via color picker
- Light, Dark, and Solar viewport themes
- Inline file rename directly from the toolbar
- Remembers your last-opened folder between sessions

## Requirements

- [Node.js](https://nodejs.org/) 18+

## Getting Started

```bash
npm install
npm start
```

## Usage

1. Click **Open Folder** in the sidebar and select the directory containing your 3D files.
2. Click any file in the list to load and preview it.
3. Use the mouse to interact with the model:
   - **Left drag** — orbit
   - **Right drag / middle drag** — pan
   - **Scroll** — zoom
4. Use the **View** bar to jump to a preset camera angle.
5. Click the model name in the toolbar to rename the file.

## Tech Stack

| Layer | Library |
|---|---|
| Desktop shell | [Electron](https://www.electronjs.org/) 33 |
| 3D rendering | [Three.js](https://threejs.org/) 0.170 |
| 3MF parsing | [adm-zip](https://github.com/cthackers/adm-zip) + [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) |

No bundler — Three.js is loaded via a native ES import map, which Electron's Chromium supports out of the box.

## Project Structure

```
glep/
├── main.js           # Electron main process — window, IPC, file scanning, parsing dispatch
├── preload.js        # contextBridge surface exposed to the renderer
├── src/
│   ├── stl-parser.js # Binary and ASCII STL parser
│   ├── 3mf-parser.js # ZIP + XML 3MF parser
│   └── obj-parser.js # OBJ parser
└── renderer/
    ├── index.html    # App shell
    ├── renderer.js   # Three.js scene, controls, UI logic
    └── style.css     # Styles
```
