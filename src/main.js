const { invoke } = window.__TAURI__.core;
const { getCurrentWebviewWindow } = window.__TAURI__.webviewWindow;

/**
 * --- 1. CONFIGURATION ---
 */
const CONFIG = {
  GRID_SIZE: 16,
  MAP_WIDTH: 128,
  MAP_HEIGHT: 128,
  COLORS: {
    GRID: '#444',
    VOID: '#111',
    TILE_BASE: '#0000FF',
    TILE_BORDER: '#FFFFFF',
    HOVER: 'rgba(255, 255, 255, 0.2)',
    ERASE_HOVER: 'rgba(255, 0, 0, 0.5)'
  },
  ZOOM: {
    MIN: 1.0,
    MAX: 4.0,
    SPEED: 0.001
  }
};

/**
 * --- 2. STATE MANAGEMENT ---
 */
const state = {
  placedTiles: new Set(),
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,
  isPanning: false,
  isPainting: false,
  isShiftPressed: false,
  startX: 0,
  startY: 0,
  hoverCoord: { x: -1, y: -1 }
};

const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');

/**
 * --- 3. INITIALIZATION ---
 */
window.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  setupCanvas();
});

function setupCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  // Initial Centering
  const worldWidth = CONFIG.MAP_WIDTH * CONFIG.GRID_SIZE * state.scale;
  const worldHeight = CONFIG.MAP_HEIGHT * CONFIG.GRID_SIZE * state.scale;
  state.offsetX = (canvas.width - worldWidth) / 2;
  state.offsetY = (canvas.height - worldHeight) / 2;

  draw();
}

/**
 * --- 4. RENDERING ENGINE ---
 */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  const curTileSize = CONFIG.GRID_SIZE * state.scale;
  const worldPxW = CONFIG.MAP_WIDTH * curTileSize;
  const worldPxH = CONFIG.MAP_HEIGHT * curTileSize;
  const borderW = Math.max(1, Math.round(2 * state.scale));

  // Layer 1: Background
  ctx.fillStyle = CONFIG.COLORS.VOID;
  ctx.fillRect(Math.floor(state.offsetX), Math.floor(state.offsetY), Math.ceil(worldPxW), Math.ceil(worldPxH));

  // Layer 2: Grid Lines
  drawGrid(curTileSize, worldPxW, worldPxH);

  // Layer 3: Tiles
  drawTiles(curTileSize, borderW);

  // Layer 4: UI/Hover
  drawHover(curTileSize);
}

function drawGrid(curTileSize, worldPxW, worldPxH) {
  ctx.beginPath();
  ctx.strokeStyle = CONFIG.COLORS.GRID;
  ctx.lineWidth = 1;

  for (let i = 0; i <= CONFIG.MAP_WIDTH; i++) {
    const x = Math.floor(i * curTileSize + state.offsetX);
    ctx.moveTo(x, Math.floor(state.offsetY));
    ctx.lineTo(x, Math.floor(state.offsetY + worldPxH));
  }
  for (let j = 0; j <= CONFIG.MAP_HEIGHT; j++) {
    const y = Math.floor(j * curTileSize + state.offsetY);
    ctx.moveTo(Math.floor(state.offsetX), y);
    ctx.lineTo(Math.floor(state.offsetX + worldPxW), y);
  }
  ctx.stroke();
}

function drawTiles(curTileSize, borderW) {
  state.placedTiles.forEach(tileKey => {
    const [tx, ty] = tileKey.split(',').map(Number);
    const x = Math.floor(tx * curTileSize + state.offsetX);
    const y = Math.floor(ty * curTileSize + state.offsetY);
    const size = Math.ceil(curTileSize);

    // Neighbor check for connectivity
    const neighbors = {
      t: state.placedTiles.has(`${tx},${ty - 1}`),
      b: state.placedTiles.has(`${tx},${ty + 1}`),
      l: state.placedTiles.has(`${tx - 1},${ty}`),
      r: state.placedTiles.has(`${tx + 1},${ty}`)
    };

    ctx.fillStyle = CONFIG.COLORS.TILE_BASE;
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = CONFIG.COLORS.TILE_BORDER;
    if (!neighbors.t) ctx.fillRect(x, y, size, borderW);
    if (!neighbors.b) ctx.fillRect(x, y + size - borderW, size, borderW);
    if (!neighbors.l) ctx.fillRect(x, y, borderW, size);
    if (!neighbors.r) ctx.fillRect(x + size - borderW, y, borderW, size);
  });
}

function drawHover(curTileSize) {
  if (!state.isPanning && state.hoverCoord.x >= 0 && state.hoverCoord.x < CONFIG.MAP_WIDTH) {
    ctx.fillStyle = state.isShiftPressed ? CONFIG.COLORS.ERASE_HOVER : CONFIG.COLORS.HOVER;
    ctx.fillRect(
        Math.floor(state.hoverCoord.x * curTileSize + state.offsetX),
        Math.floor(state.hoverCoord.y * curTileSize + state.offsetY),
        Math.ceil(curTileSize),
        Math.ceil(curTileSize)
    );
  }
}

/**
 * --- 5. INPUT HANDLING ---
 */
function initEventListeners() {
  window.addEventListener('resize', setupCanvas);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Exit Button
  document.getElementById('exit-btn')?.addEventListener('click', async () => {
    await getCurrentWebviewWindow().close();
  });

  // Mouse Wheel (Zoom)
  canvas.addEventListener('wheel', handleZoom, { passive: false });

  // Mouse Down
  canvas.addEventListener('mousedown', e => {
    if (e.button === 2) { // Right Click
      state.isPanning = true;
      state.startX = e.clientX - state.offsetX;
      state.startY = e.clientY - state.offsetY;
      canvas.style.cursor = 'grabbing';
    } else if (e.button === 0) { // Left Click
      state.isPainting = true;
      paintTile(e.shiftKey);
    }
  });

  // Mouse Move
  window.addEventListener('mousemove', handleMouseMove);

  // Mouse Up
  window.addEventListener('mouseup', e => {
    if (e.button === 0) state.isPainting = false;
    if (e.button === 2) {
      state.isPanning = false;
      canvas.style.cursor = 'crosshair';
    }
  });

  // Keyboard (Shift Detection)
  window.addEventListener('keydown', e => { if (e.key === 'Shift') { state.isShiftPressed = true; draw(); } });
  window.addEventListener('keyup', e => { if (e.key === 'Shift') { state.isShiftPressed = false; draw(); } });
}

function handleZoom(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const worldX = (mouseX - state.offsetX) / state.scale;
  const worldY = (mouseY - state.offsetY) / state.scale;

  const newScale = Math.min(Math.max(CONFIG.ZOOM.MIN, state.scale - e.deltaY * CONFIG.ZOOM.SPEED), CONFIG.ZOOM.MAX);

  const worldWidth = CONFIG.MAP_WIDTH * CONFIG.GRID_SIZE * newScale;
  const worldHeight = CONFIG.MAP_HEIGHT * CONFIG.GRID_SIZE * newScale;

  state.offsetX = clampOffset(mouseX - worldX * newScale, worldWidth, canvas.width);
  state.offsetY = clampOffset(mouseY - worldY * newScale, worldHeight, canvas.height);
  state.scale = newScale;

  draw();
}

function handleMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (state.isPanning) {
    const worldWidth = CONFIG.MAP_WIDTH * CONFIG.GRID_SIZE * state.scale;
    const worldHeight = CONFIG.MAP_HEIGHT * CONFIG.GRID_SIZE * state.scale;
    state.offsetX = clampOffset(e.clientX - state.startX, worldWidth, canvas.width);
    state.offsetY = clampOffset(e.clientY - state.startY, worldHeight, canvas.height);
    draw();
  } else {
    const gridX = Math.floor((mouseX - state.offsetX) / (CONFIG.GRID_SIZE * state.scale));
    const gridY = Math.floor((mouseY - state.offsetY) / (CONFIG.GRID_SIZE * state.scale));

    if (gridX >= 0 && gridX < CONFIG.MAP_WIDTH && gridY >= 0 && gridY < CONFIG.MAP_HEIGHT) {
      if (gridX !== state.hoverCoord.x || gridY !== state.hoverCoord.y) {
        state.hoverCoord = { x: gridX, y: gridY };
        if (state.isPainting) paintTile(e.shiftKey);
        draw();
      }
    } else if (state.hoverCoord.x !== -1) {
      state.hoverCoord = { x: -1, y: -1 };
      draw();
    }
  }
}

/**
 * --- 6. UTILITIES ---
 */
function clampOffset(offset, worldDim, canvasDim) {
  if (worldDim < canvasDim) return (canvasDim - worldDim) / 2;
  return Math.min(0, Math.max(canvasDim - worldDim, offset));
}

function paintTile(isErasing = false) {
  const { x, y } = state.hoverCoord;
  if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) return;

  const tileKey = `${x},${y}`;
  if (isErasing) {
    if (state.placedTiles.has(tileKey)) {
      state.placedTiles.delete(tileKey);
      draw();
    }
  } else {
    if (!state.placedTiles.has(tileKey)) {
      state.placedTiles.add(tileKey);
      draw();
    }
  }
}