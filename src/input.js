import { CONFIG } from './config.js';
import { state } from './state.js';
import { canvas } from './canvas.js';
import { draw, setupCanvas } from './render.js';
import { clampOffset, paintTile } from './utils.js';

const { getCurrentWebviewWindow } = window.__TAURI__.webviewWindow;

export function zoomAtPoint(newScale, anchorX, anchorY) {
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

export function initEventListeners() {
  window.addEventListener('resize', setupCanvas);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  const modeToggleButton = document.getElementById('mode-toggle-btn');
  const updateModeButton = () => {
    if (!modeToggleButton) return;
    modeToggleButton.textContent = state.interactionMode === 'move' ? 'Move' : 'Draw';
    modeToggleButton.setAttribute(
      'aria-label',
      `Toggle drawing or moving mode: ${state.interactionMode === 'move' ? 'move' : 'draw'}`
    );
  };

  modeToggleButton?.addEventListener('click', () => {
    state.interactionMode = state.interactionMode === 'draw' ? 'move' : 'draw';
    state.isPanning = false;
    state.isPainting = false;
    updateModeButton();
    canvas.style.cursor = state.interactionMode === 'move' ? 'grab' : 'crosshair';
  });

  updateModeButton();

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

    if (e.button === 2) {
      state.isPanning = true;
      state.startX = e.clientX - state.offsetX;
      state.startY = e.clientY - state.offsetY;
      canvas.style.cursor = 'grabbing';
    } else if (e.button === 0) {
      state.isPainting = true;
      paintTile(e.shiftKey);
    }
  });

  window.addEventListener('mousemove', handleMouseMove);

  window.addEventListener('mouseup', e => {
    if (e.button === 0) state.isPainting = false;
    if (e.button === 2) {
      state.isPanning = false;
      canvas.style.cursor = 'crosshair';
    }
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Shift') {
      state.isShiftPressed = true;
      draw();
    }
  });

  window.addEventListener('keyup', e => {
    if (e.key === 'Shift') {
      state.isShiftPressed = false;
      draw();
    }
  });
}
