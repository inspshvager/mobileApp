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
    if (state.isPainting) paintTile(state.interactionMode === 'erase' || e.shiftKey);
  }
}

export function initEventListeners() {
  window.addEventListener('resize', setupCanvas);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  const appContainer = document.getElementById('app-container');
  const hudControls = document.querySelector('.floating-controls');
  const colorMenu = document.getElementById('color-menu');
  const colorSwatches = Array.from(document.querySelectorAll('.color-swatch'));
  const selectedColorLabel = document.getElementById('selected-color-label');
  const colorMenuHandle = document.getElementById('color-menu-handle');

  const updateHudVisibility = () => {
    if (!hudControls) return;
    const shouldHide = state.isPanning || state.isPainting || Boolean(state.pinchDistance);
    hudControls.classList.toggle('is-hidden', shouldHide);
  };

  const updateSelectedColor = () => {
    const activeColorName = CONFIG.PALETTE.find(item => item.value.toLowerCase() === state.selectedColor.toLowerCase())?.name ?? 'Blue';
    if (selectedColorLabel) selectedColorLabel.textContent = activeColorName;
    colorSwatches.forEach(swatch => {
      const selected = swatch.dataset.color.toLowerCase() === state.selectedColor.toLowerCase();
      swatch.classList.toggle('is-selected', selected);
      swatch.setAttribute('aria-pressed', String(selected));
    });
  };

  const toggleColorMenu = (isOpen) => {
    if (!colorMenu || !appContainer) return;
    state.isColorMenuOpen = isOpen;
    colorMenu.classList.toggle('is-open', isOpen);
    colorMenu.setAttribute('aria-expanded', String(isOpen));
    appContainer.classList.toggle('color-menu-open', isOpen);
    updateSelectedColor();
    requestAnimationFrame(() => updateSelectedColor());
  };

  colorSwatches.forEach(swatch => {
    swatch.addEventListener('pointerdown', event => {
      event.preventDefault();
      state.selectedColor = swatch.dataset.color;
      updateSelectedColor();
      requestAnimationFrame(() => updateSelectedColor());
      toggleColorMenu(false);
    });
  });

  let swipeStartY = 0;
  colorMenuHandle?.addEventListener('pointerdown', event => {
    swipeStartY = event.clientY;
    colorMenuHandle.setPointerCapture(event.pointerId);
  });

  colorMenuHandle?.addEventListener('pointerup', event => {
    const deltaY = event.clientY - swipeStartY;
    if (deltaY < -30) {
      toggleColorMenu(true);
    } else if (deltaY > 30) {
      toggleColorMenu(false);
    } else {
      toggleColorMenu(!state.isColorMenuOpen);
    }
  });

  const modeToggleButton = document.getElementById('mode-toggle-btn');
  const updateModeButton = () => {
    if (!modeToggleButton) return;

    const modeLabel =
      state.interactionMode === 'draw' ? 'Draw' :
      state.interactionMode === 'erase' ? 'Erase' : 'Move';

    modeToggleButton.textContent = modeLabel;
    modeToggleButton.dataset.mode = state.interactionMode;
    modeToggleButton.classList.toggle('mode-draw', state.interactionMode === 'draw');
    modeToggleButton.classList.toggle('mode-erase', state.interactionMode === 'erase');
    modeToggleButton.classList.toggle('mode-move', state.interactionMode === 'move');
    modeToggleButton.setAttribute(
      'aria-label',
      `Toggle editing mode: ${state.interactionMode}`
    );
  };

  modeToggleButton?.addEventListener('click', () => {
    if (state.interactionMode === 'draw') {
      state.interactionMode = 'erase';
    } else if (state.interactionMode === 'erase') {
      state.interactionMode = 'move';
    } else {
      state.interactionMode = 'draw';
    }

    state.isPanning = false;
    state.isPainting = false;
    updateModeButton();
    updateHudVisibility();
    canvas.style.cursor = state.interactionMode === 'move' ? 'grab' : 'crosshair';
  });

  updateModeButton();
  updateHudVisibility();

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
      updateHudVisibility();
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
        updateHudVisibility();
        canvas.style.cursor = 'grabbing';
        return;
      }

      state.isPainting = true;
      updateHudVisibility();
      updateHoverFromScreen(touchX, touchY);
      paintTile(state.interactionMode === 'erase');
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
      updateHudVisibility();
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

      if ((state.interactionMode === 'draw' || state.interactionMode === 'erase') && state.isPainting) {
        updateHoverFromScreen(touchX, touchY);
        if (state.hoverCoord.x >= 0 && state.hoverCoord.x < CONFIG.MAP_WIDTH && state.hoverCoord.y >= 0 && state.hoverCoord.y < CONFIG.MAP_HEIGHT) {
          paintTile(state.interactionMode === 'erase');
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
      updateHudVisibility();
      canvas.style.cursor = 'crosshair';
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
      updateHudVisibility();
      canvas.style.cursor = 'grabbing';
    } else if (e.button === 0) {
      state.isPainting = true;
      updateHudVisibility();
      paintTile(state.interactionMode === 'erase' || e.shiftKey);
    }
  });

  window.addEventListener('mousemove', handleMouseMove);

  window.addEventListener('mouseup', e => {
    if (e.button === 0) state.isPainting = false;
    if (e.button === 2) {
      state.isPanning = false;
      canvas.style.cursor = 'crosshair';
    }
    updateHudVisibility();
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
