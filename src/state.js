export const state = {
  placedTiles: new Map(),
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,
  isPanning: false,
  isPainting: false,
  isShiftPressed: false,
  interactionMode: 'draw',
  selectedColor: '#0000FF',
  isColorMenuOpen: false,
  startX: 0,
  startY: 0,
  hoverCoord: { x: -1, y: -1 },
  pinchDistance: null,
  pinchScaleStart: 1.0
};
