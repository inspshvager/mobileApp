import { CONFIG } from './config.js';
import { state } from './state.js';
import { canvas, ctx } from './canvas.js';

export function setupCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const worldWidth = CONFIG.MAP_WIDTH * CONFIG.GRID_SIZE * state.scale;
  const worldHeight = CONFIG.MAP_HEIGHT * CONFIG.GRID_SIZE * state.scale;
  state.offsetX = (canvas.width - worldWidth) / 2;
  state.offsetY = (canvas.height - worldHeight) / 2;

  draw();
}

export function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  const curTileSize = CONFIG.GRID_SIZE * state.scale;
  const worldPxW = CONFIG.MAP_WIDTH * curTileSize;
  const worldPxH = CONFIG.MAP_HEIGHT * curTileSize;
  const borderW = Math.max(1, Math.round(2 * state.scale));

  ctx.fillStyle = CONFIG.COLORS.VOID;
  ctx.fillRect(Math.floor(state.offsetX), Math.floor(state.offsetY), Math.ceil(worldPxW), Math.ceil(worldPxH));

  drawGrid(curTileSize, worldPxW, worldPxH);
  drawTiles(curTileSize, borderW);
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
    const isErasing = state.interactionMode === 'erase' || state.isShiftPressed;
    ctx.fillStyle = isErasing ? CONFIG.COLORS.ERASE_HOVER : CONFIG.COLORS.HOVER;
    ctx.fillRect(
      Math.floor(state.hoverCoord.x * curTileSize + state.offsetX),
      Math.floor(state.hoverCoord.y * curTileSize + state.offsetY),
      Math.ceil(curTileSize),
      Math.ceil(curTileSize)
    );
  }
}
