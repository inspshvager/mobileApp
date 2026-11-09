export const CONFIG = {
  GRID_SIZE: 8,
  MAP_WIDTH: 64,
  MAP_HEIGHT: 64,
  PALETTE: [
    { name: 'Blue', value: '#0000FF' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Teal', value: '#14B8A6' },
    { name: 'Yellow', value: '#FACC15' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Red', value: '#EF4444' }
  ],
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
