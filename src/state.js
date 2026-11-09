export const state = {
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
