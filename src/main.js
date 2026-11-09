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
  interactionMode: 'draw',
  startX: 0,
  startY: 0,
  hoverCoord: { x: -1, y: -1 },
  pinchDistance: null,
  pinchScaleStart: 1.0
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

  const modeToggleButton = document.getElementById('mode-toggle-btn');
  const updateModeButton = () => {
    if (!modeToggleButton) return;
    modeToggleButton.textContent = state.interactionMode === 'move' ? 'Move' : 'Draw';
    modeToggleButton.setAttribute('aria-label', `Toggle drawing or moving mode: ${state.interactionMode === 'move' ? 'move' : 'draw'}`);
  };

  modeToggleButton?.addEventListener('click', () => {
    state.interactionMode = state.interactionMode === 'draw' ? 'move' : 'draw';
    state.isPanning = false;
    state.isPainting = false;
    updateModeButton();
    canvas.style.cursor = state.interactionMode === 'move' ? 'grab' : 'crosshair';
  });

  updateModeButton();

  // Exit Button
  document.getElementById('exit-btn')?.addEventListener('click', async () => {
    await getCurrentWebviewWindow().close();
  });

  document.getElementById('zoom-in-btn')?.addEventListener('click', () => {
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const nextScale = Math.min(CONFIG.ZOOM.MAX, state.scale + 0.5);
    zoomAtPoint(nextScale, centerX, centerY);
    draw();
  });

  document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const nextScale = Math.max(CONFIG.ZOOM.MIN, state.scale - 0.5);
    zoomAtPoint(nextScale, centerX, centerY);
    draw();
  });

  // Touch / Pinch on Mobile
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      state.isPanning = false;
      const [a, b] = Array.from(e.touches);
      state.pinchDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      state.pinchScaleStart = state.scale;
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;

      if (state.interactionMode === 'move') {
        state.isPanning = true;
        state.startX = touch.clientX - state.offsetX;
        state.startY = touch.clientY - state.offsetY;
        canvas.style.cursor = 'grabbing';
        return;
      }

      state.isPainting = true;
      updateHoverFromScreen(touchX, touchY);
      paintTile(false);
      canvas.style.cursor = 'crosshair';
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && state.pinchDistance) {
      e.preventDefault();
      const [a, b] = Array.from(e.touches);
      const rect = canvas.getBoundingClientRect();
      const midpointX = (a.clientX + b.clientX) / 2 - rect.left;
      const midpointY = (a.clientY + b.clientY) / 2 - rect.top;
      const newDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const scaleRatio = newDistance / state.pinchDistance;
      zoomAtPoint(state.pinchScaleStart * scaleRatio, midpointX, midpointY);
      draw();
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;

      if (state.interactionMode === 'move' && state.isPanning) {
        e.preventDefault();
        const worldWidth = CONFIG.MAP_WIDTH * CONFIG.GRID_SIZE * state.scale;
        const worldHeight = CONFIG.MAP_HEIGHT * CONFIG.GRID_SIZE * state.scale;
        state.offsetX = clampOffset(touch.clientX - state.startX, worldWidth, canvas.width);
        state.offsetY = clampOffset(touch.clientY - state.startY, worldHeight, canvas.height);
        draw();
        return;
      }

      if (state.interactionMode === 'draw' && state.isPainting) {
        updateHoverFromScreen(touchX, touchY);
        if (state.hoverCoord.x >= 0 && state.hoverCoord.x < CONFIG.MAP_WIDTH && state.hoverCoord.y >= 0 && state.hoverCoord.y < CONFIG.MAP_HEIGHT) {
          paintTile(false);
        }
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    if (e.touches.length === 0) {
      state.pinchDistance = null;
      state.pinchScaleStart = 1.0;
      state.isPanning = false;
      state.isPainting = false;
      canvas.style.cursor = 'crosshair';
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;

      if (state.interactionMode === 'move') {
        state.isPanning = false;
        canvas.style.cursor = 'crosshair';
      } else {
        state.isPainting = false;
        updateHoverFromScreen(touchX, touchY);
      }
    }
  });

  // Mouse Down
  canvas.addEventListener('mousedown', e => {
    if (state.interactionMode === 'move') {
      if (e.button === 2) {
        state.isPanning = true;
        state.startX = e.clientX - state.offsetX;
        state.startY = e.clientY - state.offsetY;
        canvas.style.cursor = 'grabbing';
      }
      return;
    }

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

function zoomAtPoint(newScale, anchorX, anchorY) {
  const clampedScale = Math.min(Math.max(CONFIG.ZOOM.MIN, newScale), CONFIG.ZOOM.MAX);

  const worldX = (anchorX - state.offsetX) / state.scale;
  const worldY = (anchorY - state.offsetY) / state.scale;

  const worldWidth = CONFIG.MAP_WIDTH * CONFIG.GRID_SIZE * clampedScale;
  const worldHeight = CONFIG.MAP_HEIGHT * CONFIG.GRID_SIZE * clampedScale;

  state.offsetX = clampOffset(anchorX - worldX * clampedScale, worldWidth, canvas.width);
  state.offsetY = clampOffset(anchorY - worldY * clampedScale, worldHeight, canvas.height);
  state.scale = clampedScale;
}

function updateHoverFromScreen(screenX, screenY) {
  const gridX = Math.floor((screenX - state.offsetX) / (CONFIG.GRID_SIZE * state.scale));
  const gridY = Math.floor((screenY - state.offsetY) / (CONFIG.GRID_SIZE * state.scale));

  const nextHover = { x: gridX, y: gridY };
  if (gridX >= 0 && gridX < CONFIG.MAP_WIDTH && gridY >= 0 && gridY < CONFIG.MAP_HEIGHT) {
    if (nextHover.x !== state.hoverCoord.x || nextHover.y !== state.hoverCoord.y) {
      state.hoverCoord = nextHover;
      draw();
    }
  } else if (state.hoverCoord.x !== -1) {
    state.hoverCoord = { x: -1, y: -1 };
    draw();
  }
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
    updateHoverFromScreen(mouseX, mouseY);
    if (state.isPainting) paintTile(e.shiftKey);
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