import { CONFIG } from './config.js';
import { state } from './state.js';
import { canvas } from './canvas.js';
import { draw, setupCanvas } from './render.js';
import { clampOffset, paintTile } from './utils.js';
import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readDir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs';

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
  const colorMenuCloseButton = document.getElementById('color-menu-close');
  const colorSwatches = Array.from(document.querySelectorAll('.color-swatch'));
  const selectedColorLabel = document.getElementById('selected-color-label');
  const tileMenu = document.getElementById('tile-menu');
  const tileMenuCloseButton = document.getElementById('tile-menu-close');
  const tilePickerButton = document.getElementById('tile-picker-btn');
  const tileOptions = Array.from(document.querySelectorAll('.tile-option'));
  const colorPickerButton = document.getElementById('color-picker-btn');
  const colorPreview = document.getElementById('current-color-preview');
  const currentColorValue = document.getElementById('current-color-value');
  const redSlider = document.getElementById('red-slider');
  const greenSlider = document.getElementById('green-slider');
  const blueSlider = document.getElementById('blue-slider');

  const rgbToHex = (r, g, b) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

  const hexToRgb = (hex) => {
    const normalized = hex.replace('#', '').trim();
    if (normalized.length !== 6) return { r: 0, g: 0, b: 255 };

    const safe = normalized.match(/[0-9a-fA-F]{6}/)?.[0];
    if (!safe) return { r: 0, g: 0, b: 255 };

    const value = Number.parseInt(safe, 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  };

  const updateHudVisibility = () => {
    if (!hudControls) return;
    const shouldHide = state.isPanning || state.isPainting || Boolean(state.pinchDistance);
    hudControls.classList.toggle('is-hidden', shouldHide);
  };

  const updateSelectedColor = () => {
    const activeColorName = CONFIG.PALETTE.find(item => item.value.toLowerCase() === state.selectedColor.toLowerCase())?.name ?? 'Blue';
    if (selectedColorLabel) selectedColorLabel.textContent = activeColorName;
    if (colorPickerButton) colorPickerButton.style.setProperty('--picker-color', state.selectedColor);
    if (colorPreview) colorPreview.style.background = state.selectedColor;
    if (currentColorValue) currentColorValue.textContent = state.selectedColor.toUpperCase();

    const { r, g, b } = hexToRgb(state.selectedColor);
    if (redSlider) redSlider.value = String(r);
    if (greenSlider) greenSlider.value = String(g);
    if (blueSlider) blueSlider.value = String(b);

    colorSwatches.forEach(swatch => {
      const selected = swatch.dataset.color.toLowerCase() === state.selectedColor.toLowerCase();
      swatch.classList.toggle('is-selected', selected);
      swatch.setAttribute('aria-pressed', String(selected));
    });
  };

  const updateTilePicker = () => {
    tileOptions.forEach(option => {
      const selected = option.dataset.tileStyle === state.tileStyle;
      option.classList.toggle('is-selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
  };

  const toggleTileMenu = (isOpen) => {
    if (!tileMenu || !appContainer) return;
    tileMenu.classList.toggle('is-open', isOpen);
    tileMenu.setAttribute('aria-expanded', String(isOpen));
    appContainer.classList.toggle('tile-menu-open', isOpen);
    updateTilePicker();
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

  tilePickerButton?.addEventListener('click', event => {
    event.preventDefault();
    toggleTileMenu(!tileMenu?.classList.contains('is-open'));
  });

  tileMenuCloseButton?.addEventListener('click', () => {
    toggleTileMenu(false);
  });

  tileOptions.forEach(option => {
    option.addEventListener('pointerdown', event => {
      event.preventDefault();
      state.tileStyle = option.dataset.tileStyle;
      updateTilePicker();
      toggleTileMenu(false);
      draw();
    });
  });

  colorPickerButton?.addEventListener('click', event => {
    event.preventDefault();
    toggleColorMenu(!state.isColorMenuOpen);
  });

  colorMenuCloseButton?.addEventListener('click', () => {
    toggleColorMenu(false);
  });

  appContainer?.addEventListener('pointerdown', event => {
    const clickedTileButton = tilePickerButton?.contains(event.target);
    const clickedInsideTileMenu = tileMenu?.contains(event.target);
    const clickedColorTrigger = colorPickerButton?.contains(event.target);
    const clickedInsideColorMenu = colorMenu?.contains(event.target);

    if (tileMenu && !clickedTileButton && !clickedInsideTileMenu) {
      toggleTileMenu(false);
    }

    if (state.isColorMenuOpen && !clickedInsideColorMenu && !clickedColorTrigger) {
      toggleColorMenu(false);
    }
  });

  colorSwatches.forEach(swatch => {
    swatch.addEventListener('pointerdown', event => {
      event.preventDefault();
      state.selectedColor = swatch.dataset.color;
      updateSelectedColor();
      requestAnimationFrame(() => updateSelectedColor());
      toggleColorMenu(false);
    });
  });

  const syncColorFromRgb = () => {
    const r = Number(redSlider?.value ?? 0);
    const g = Number(greenSlider?.value ?? 0);
    const b = Number(blueSlider?.value ?? 255);
    state.selectedColor = rgbToHex(r, g, b);
    updateSelectedColor();
  };

  redSlider?.addEventListener('input', syncColorFromRgb);
  greenSlider?.addEventListener('input', syncColorFromRgb);
  blueSlider?.addEventListener('input', syncColorFromRgb);

  const getSaveDirectory = async () => {
    const appDir = await appDataDir();
    return await join(appDir, 'saves');
  };

  const loadMapFromPath = async (selectedPath) => {
    try {
      if (!selectedPath) return;
      const contents = await readTextFile(selectedPath);
      const parsed = JSON.parse(contents);
      const tiles = Array.isArray(parsed.tiles) ? parsed.tiles : [];

      state.placedTiles = new Map(
        tiles.map(({ x, y, color, style }) => [`${x},${y}`, {
          color: color ?? '#0000FF',
          style: style ?? 'smart-connect'
        }])
      );

      state.hoverCoord = { x: -1, y: -1 };
      draw();
      console.log('Map loaded from:', selectedPath);
    } catch (error) {
      console.error('Failed to load map:', error);
    }
  };

  const openSavedFilesMenu = async () => {
    const menu = document.getElementById('save-file-menu');
    const list = document.getElementById('save-file-list');
    const emptyState = document.getElementById('save-file-empty');
    const clearAllButton = document.getElementById('save-file-clear-all');

    if (!menu || !list || !emptyState || !clearAllButton) return;

    const refreshList = async () => {
      try {
        const saveDir = await getSaveDirectory();
        if (!(await exists(saveDir))) {
          await mkdir(saveDir, { recursive: true });
        }

        const entries = await readDir(saveDir);
        const files = entries
          .filter(entry => entry.isFile && typeof entry.name === 'string' && entry.name.toLowerCase().endsWith('.json'))
          .sort((a, b) => (b.name || '').localeCompare(a.name || ''));

        list.innerHTML = '';
        emptyState.style.display = files.length ? 'none' : 'block';

        for (const file of files) {
          const row = document.createElement('div');
          row.className = 'save-file-row';

          const fileButton = document.createElement('button');
          fileButton.type = 'button';
          fileButton.className = 'save-file-item';
          fileButton.textContent = file.name;
          fileButton.addEventListener('click', async () => {
            menu.classList.remove('is-open');
            menu.setAttribute('aria-expanded', 'false');
            const filePath = await join(saveDir, file.name);
            await loadMapFromPath(filePath);
          });

          const deleteButton = document.createElement('button');
          deleteButton.type = 'button';
          deleteButton.className = 'save-file-delete';
          deleteButton.textContent = 'Delete';
          deleteButton.addEventListener('click', async () => {
            const filePath = await join(saveDir, file.name);
            await remove(filePath);
            await refreshList();
          });

          row.appendChild(fileButton);
          row.appendChild(deleteButton);
          list.appendChild(row);
        }

        clearAllButton.onclick = async () => {
          for (const file of files) {
            const filePath = await join(saveDir, file.name);
            await remove(filePath);
          }
          await refreshList();
        };

        menu.classList.add('is-open');
        menu.setAttribute('aria-expanded', 'true');
      } catch (error) {
        console.error('Failed to list saved maps:', error);
        list.innerHTML = '';
        emptyState.style.display = 'block';
        emptyState.textContent = 'Unable to read saved maps.';
        menu.classList.add('is-open');
        menu.setAttribute('aria-expanded', 'true');
      }
    };

    await refreshList();
  };

  const saveMap = async (saveAs = false) => {
    const isTauriAvailable = Boolean(window.__TAURI__);
    if (!isTauriAvailable) {
      console.warn('Save is only available in the Tauri app.');
      return;
    }

    try {
      const saveDir = await getSaveDirectory();
      if (!(await exists(saveDir))) {
        await mkdir(saveDir, { recursive: true });
      }

      const baseName = saveAs ? window.prompt('Save as', 'map')?.trim() : null;
      const fileName = baseName ? baseName.replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-').toLowerCase() || 'map' : new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = await join(saveDir, `${saveAs ? 'map-' : ''}${fileName}.json`);

      const tiles = Array.from(state.placedTiles.entries()).map(([key, tileValue]) => {
        const [x, y] = key.split(',').map(Number);
        const parsedTile = typeof tileValue === 'string' ? { color: tileValue, style: 'smart-connect' } : tileValue;
        return {
          x,
          y,
          color: parsedTile.color,
          style: parsedTile.style ?? 'smart-connect'
        };
      });

      const payload = {
        version: 1,
        width: CONFIG.MAP_WIDTH,
        height: CONFIG.MAP_HEIGHT,
        gridSize: CONFIG.GRID_SIZE,
        tiles,
        savedAt: new Date().toISOString()
      };

      await writeTextFile(filePath, JSON.stringify(payload, null, 2));
      console.log('Map saved to:', filePath);
    } catch (error) {
      console.error('Failed to save map:', error);
    }
  };

  const settingsButton = document.getElementById('settings-button');
  const settingsMenu = document.getElementById('settings-menu');

  const toggleSettingsMenu = (isOpen) => {
    if (!settingsButton || !settingsMenu) return;
    settingsMenu.classList.toggle('is-open', isOpen);
    settingsMenu.setAttribute('aria-expanded', String(isOpen));
  };

  settingsButton?.addEventListener('click', (event) => {
    event.preventDefault();
    const isOpen = settingsMenu?.classList.contains('is-open');
    toggleSettingsMenu(!isOpen);
  });

  document.addEventListener('pointerdown', (event) => {
    const clickedInsideButton = settingsButton?.contains(event.target);
    const clickedInsideMenu = settingsMenu?.contains(event.target);
    if (!clickedInsideButton && !clickedInsideMenu) {
      toggleSettingsMenu(false);
    }
  });

  document.querySelectorAll('.settings-menu-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const action = item.dataset.action;
      toggleSettingsMenu(false);

      if (action === 'save') {
        await saveMap();
      } else if (action === 'save-as') {
        await saveMap(true);
      } else if (action === 'load') {
        await openSavedFilesMenu();
      } else if (action === 'export') {
        await saveMap(true);
      } else if (action === 'settings') {
        console.log('Settings action placeholder');
      } else if (action === 'new') {
        const confirmed = window.confirm('Start a new map? Unsaved changes will be lost.');
        if (confirmed) {
          state.placedTiles = new Map();
          state.hoverCoord = { x: -1, y: -1 };
          draw();
        }
      }
    });
  });

  document.getElementById('save-file-menu-close')?.addEventListener('click', () => {
    const menu = document.getElementById('save-file-menu');
    if (!menu) return;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
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

  updateTilePicker();
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
