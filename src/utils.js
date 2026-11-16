import { CONFIG } from './config.js';
import { state } from './state.js';
import { draw } from './render.js';

export function clampOffset(offset, worldDim, canvasDim) {
  if (worldDim < canvasDim) return (canvasDim - worldDim) / 2;
  return Math.min(0, Math.max(canvasDim - worldDim, offset));
}

export function paintTile(isErasing = false) {
  const { x, y } = state.hoverCoord;
  if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) return;

  const tileKey = `${x},${y}`;
  if (isErasing) {
    if (state.placedTiles.has(tileKey)) {
      state.placedTiles.delete(tileKey);
      draw();
    }
    return;
  }

  const currentTile = state.placedTiles.get(tileKey);
  const currentColor = typeof currentTile === 'string' ? currentTile : currentTile?.color;
  const currentStyle = typeof currentTile === 'string' ? 'smart-connect' : currentTile?.style ?? 'smart-connect';

  if (currentColor !== state.selectedColor || currentStyle !== state.tileStyle) {
    state.placedTiles.set(tileKey, {
      color: state.selectedColor,
      style: state.tileStyle
    });
    draw();
  }
}
