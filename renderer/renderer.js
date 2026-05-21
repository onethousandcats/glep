import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

// ── Three.js setup ────────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');
const canvas    = document.getElementById('canvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xf1f5f9); // matches --viewport-bg

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100_000);
camera.position.set(100, 80, 100);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping  = true;
controls.dampingFactor  = 0.06;
controls.minDistance    = 0.01;

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const sun  = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(1, 2, 2.5);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.2);
fill.position.set(-2, -1, -1);
scene.add(fill);

// Handle canvas resize
new ResizeObserver(() => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}).observe(container);

// Render loop
(function tick() {
  requestAnimationFrame(tick);
  controls.update();
  renderer.render(scene, camera);
})();

// ── Model management ──────────────────────────────────────────────────────────
const material = new THREE.MeshPhongMaterial({
  color:     0x3b82f6,
  specular:  0x888888,
  shininess: 70,
  side:      THREE.DoubleSide,
});

let currentMesh = null;

function clearScene() {
  if (!currentMesh) return;
  scene.remove(currentMesh);
  currentMesh.geometry.dispose();
  currentMesh = null;
}

function buildScene(data) {
  clearScene();

  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.positions), 3));

  if (data.indices?.length)
    geo.setIndex(data.indices);

  // Weld coincident vertices so neighbouring faces can share edges.
  geo = mergeVertices(geo);

  // Compute normals with a crease angle: faces meeting at less than ~30°
  // get smooth averaged normals; faces meeting at sharper angles (like a
  // 90° box edge) keep a hard split — preserving rigid, mechanical shapes.
  geo = toCreasedNormals(geo, Math.PI / 6);
  geo.center();

  currentMesh = new THREE.Mesh(geo, material);
  currentMesh.rotation.x = -Math.PI / 2; // convert Z-up (3D print) → Y-up (Three.js)
  scene.add(currentMesh);
  fitCamera();
}

// ── Camera helpers ────────────────────────────────────────────────────────────
function viewDist() {
  if (!currentMesh) return 100;
  const box  = new THREE.Box3().setFromObject(currentMesh);
  const size = box.getSize(new THREE.Vector3());
  const max  = Math.max(size.x, size.y, size.z);
  return (max / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.8;
}

function fitCamera() {
  if (!currentMesh) return;
  const box    = new THREE.Box3().setFromObject(currentMesh);
  const center = box.getCenter(new THREE.Vector3());
  const size   = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fovRad = (camera.fov * Math.PI) / 180;
  const dist   = (maxDim / (2 * Math.tan(fovRad / 2))) * 1.8;

  camera.near = maxDim / 100;
  camera.far  = maxDim * 100;
  camera.up.set(0, 1, 0);
  camera.position.set(center.x + dist * 0.65, center.y + dist * 0.45, center.z - dist);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

// Smooth animated transition to a camera position / target / up-vector
let animFrame = null;
function animateTo(toPos, toTarget, toUp = new THREE.Vector3(0, 1, 0), ms = 500) {
  if (animFrame) cancelAnimationFrame(animFrame);

  const fromPos    = camera.position.clone();
  const fromTarget = controls.target.clone();
  const fromUp     = camera.up.clone();
  const t0         = performance.now();

  function step(now) {
    const t  = Math.min(1, (now - t0) / ms);
    const e  = 1 - Math.pow(1 - t, 3); // ease-out cubic

    camera.position.lerpVectors(fromPos, toPos, e);
    controls.target.lerpVectors(fromTarget, toTarget, e);
    camera.up.lerpVectors(fromUp, toUp, e).normalize();
    controls.update();

    if (t < 1) animFrame = requestAnimationFrame(step);
    else animFrame = null;
  }

  animFrame = requestAnimationFrame(step);
}

// Preset views
function setView(direction) {
  if (!currentMesh) return;
  const box    = new THREE.Box3().setFromObject(currentMesh);
  const center = box.getCenter(new THREE.Vector3());
  const d      = viewDist();
  const c      = center;

  const views = {
    front:  { pos: new THREE.Vector3(c.x,     c.y,     c.z - d), up: new THREE.Vector3(0,  1,  0) },
    back:   { pos: new THREE.Vector3(c.x,     c.y,     c.z + d), up: new THREE.Vector3(0,  1,  0) },
    right:  { pos: new THREE.Vector3(c.x + d, c.y,     c.z    ), up: new THREE.Vector3(0,  1,  0) },
    left:   { pos: new THREE.Vector3(c.x - d, c.y,     c.z    ), up: new THREE.Vector3(0,  1,  0) },
    top:    { pos: new THREE.Vector3(c.x,     c.y + d, c.z    ), up: new THREE.Vector3(0,  0, -1) },
    bottom: { pos: new THREE.Vector3(c.x,     c.y - d, c.z    ), up: new THREE.Vector3(0,  0,  1) },
    iso:    { pos: new THREE.Vector3(c.x + d * 0.65, c.y + d * 0.45, c.z - d), up: new THREE.Vector3(0, 1, 0) },
  };

  const v = views[direction];
  if (v) animateTo(v.pos, center, v.up);
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const elBtnFolder      = document.getElementById('btn-open-folder');
const elBtnReset       = document.getElementById('btn-reset-view');
const elColorPicker    = document.getElementById('color-picker');
const elThemePicker    = document.getElementById('theme-picker');
const elCurrentPath    = document.getElementById('current-path');
const elFileList       = document.getElementById('file-list');
const elFileCount      = document.getElementById('file-count');
const elModelName      = document.getElementById('model-name');
const elModelNameInput = document.getElementById('model-name-input');
const elStatus         = document.getElementById('status-text');
const elOverlayEmpty   = document.getElementById('overlay-empty');
const elOverlayLoading = document.getElementById('overlay-loading');

let selectedEl  = null;
let currentFile = null;

// ── File list ─────────────────────────────────────────────────────────────────
function renderFileList(files) {
  elFileList.innerHTML = '';
  elFileCount.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
  selectedEl = null;

  for (const file of files) {
    const extClass = file.ext === '3MF' ? 'mf3' : file.ext === 'OBJ' ? 'obj' : 'stl';
    const subHtml  = file.subPath
      ? `<span class="file-sub">${esc(file.subPath)}</span>`
      : '';

    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <span class="ext-badge ${extClass}">${esc(file.ext)}</span>
      <span class="file-info">
        <span class="file-name">${esc(file.fileName)}</span>
        ${subHtml}
      </span>`;

    item.addEventListener('click', () => onFileClick(item, file));
    elFileList.appendChild(item);
  }
}

// ── File selection ────────────────────────────────────────────────────────────
async function onFileClick(item, file) {
  if (selectedEl) selectedEl.classList.remove('selected');
  item.classList.add('selected');
  selectedEl = item;

  elModelName.textContent = file.fileName;
  elModelName.classList.remove('is-loaded');
  elBtnReset.disabled     = true;
  elOverlayEmpty.hidden   = true;
  elOverlayLoading.hidden = false;
  elStatus.textContent    = 'Loading\u2026';

  const result = await window.glep.loadModel(file.fullPath);

  elOverlayLoading.hidden = true;

  if (!result.ok) {
    elStatus.textContent      = `Error: ${result.error}`;
    elOverlayEmpty.hidden     = false;
    return;
  }

  currentFile = { ...file };
  buildScene(result);
  elModelName.classList.add('is-loaded');
  elBtnReset.disabled  = false;
  elStatus.textContent = 'Left drag \u00b7 rotate \u2003 Right drag \u00b7 pan \u2003 Scroll \u00b7 zoom';
}

// ── Rename ────────────────────────────────────────────────────────────────────
function startRename() {
  if (!currentFile) return;
  const baseName = currentFile.fileName.slice(0, currentFile.fileName.length - currentFile.ext.length - 1);
  elModelNameInput.value = baseName;
  elModelName.hidden     = true;
  elModelNameInput.hidden = false;
  elModelNameInput.select();
}

function cancelRename() {
  elModelNameInput.hidden = true;
  elModelName.hidden      = false;
}

async function confirmRename() {
  const raw = elModelNameInput.value.trim();
  if (!raw || !currentFile) { cancelRename(); return; }

  const newFileName = `${raw}.${currentFile.ext.toLowerCase()}`;
  if (newFileName === currentFile.fileName) { cancelRename(); return; }

  const dir     = currentFile.fullPath.slice(0, currentFile.fullPath.length - currentFile.fileName.length);
  const newPath = dir + newFileName;

  const result = await window.glep.renameFile(currentFile.fullPath, newPath);

  if (!result.ok) {
    elStatus.textContent = `Rename failed: ${result.error}`;
    cancelRename();
    return;
  }

  currentFile.fullPath = newPath;
  currentFile.fileName = newFileName;

  elModelName.textContent = newFileName;
  if (selectedEl) {
    const nameEl = selectedEl.querySelector('.file-name');
    if (nameEl) nameEl.textContent = newFileName;
  }

  cancelRename();
}

elModelName.addEventListener('click', () => {
  if (elModelName.classList.contains('is-loaded')) startRename();
});

elModelNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  { e.preventDefault(); confirmRename(); }
  if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
});

elModelNameInput.addEventListener('blur', cancelRename);

// ── Settings helpers ──────────────────────────────────────────────────────────
let _settings = {};

async function saveSettings(patch) {
  Object.assign(_settings, patch);
  await window.glep.saveSettings(_settings);
}

// ── Directory loading ─────────────────────────────────────────────────────────
async function loadDirectory(dirPath) {
  elCurrentPath.textContent = dirPath;
  elCurrentPath.title       = dirPath;

  const files = await window.glep.scanDirectory(dirPath);
  renderFileList(files);
  await saveSettings({ lastDirectory: dirPath });

  elStatus.textContent = files.length
    ? 'Select a file to preview it'
    : 'No STL, 3MF, or OBJ files found in this folder';
}

// ── Theme ─────────────────────────────────────────────────────────────────────
const viewportBg = { light: 0xf1f5f9, dark: 0x141414, solar: 0xf5efe0 };

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  renderer.setClearColor(viewportBg[theme] ?? viewportBg.light);
  elThemePicker.value = theme;
}

// ── Button / control handlers ─────────────────────────────────────────────────
elBtnFolder.addEventListener('click', async () => {
  const dir = await window.glep.openFolder();
  if (dir) await loadDirectory(dir);
});

elBtnReset.addEventListener('click', fitCamera);

elColorPicker.addEventListener('input', (e) => {
  material.color.set(e.target.value);
});

elThemePicker.addEventListener('change', async (e) => {
  applyTheme(e.target.value);
  await saveSettings({ theme: e.target.value });
});

document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

// ── Resizer ───────────────────────────────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const resizer = document.getElementById('resizer');

resizer.addEventListener('mousedown', (e) => {
  e.preventDefault();
  resizer.classList.add('is-dragging');
  document.body.style.cursor    = 'col-resize';
  document.body.style.userSelect = 'none';

  const onMove = (e) => {
    sidebar.style.width = `${Math.max(160, Math.min(520, e.clientX))}px`;
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', () => {
    resizer.classList.remove('is-dragging');
    document.body.style.cursor    = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMove);
  }, { once: true });
});

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  _settings = await window.glep.getSettings();
  if (_settings.theme) applyTheme(_settings.theme);
  if (_settings.lastDirectory) await loadDirectory(_settings.lastDirectory);
})();
