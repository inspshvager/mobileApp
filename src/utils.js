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
  } else {
    const currentColor = state.placedTiles.get(tileKey);
    if (currentColor !== state.selectedColor) {
      state.placedTiles.set(tileKey, state.selectedColor);
      draw();
    }
  }
}
