export const CONFIG = {
  GRID_SIZE: 8,
  MAP_WIDTH: 64,
  MAP_HEIGHT: 64,
  PALETTE: [
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#FFFFFF' },
    { name: 'Blue', value: '#0000FF' },
    { name: 'Deep Blue', value: '#0070C0' },
    { name: 'Sky Blue', value: '#00B0F0' },
    { name: 'Teal', value: '#14B8A6' },
    { name: 'Green', value: '#00B050' },
    { name: 'Light Green', value: '#92D050' },
    { name: 'Yellow', value: '#FACC15' },
    { name: 'Gold', value: '#FFC000' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Dark Orange', value: '#E46C0A' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Dark Red', value: '#C00000' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Violet', value: '#7030A0' },
    { name: 'Gray', value: '#A5A5A5' },
    { name: 'Peach', value: '#F4B183' },
    { name: 'Soft Green', value: '#A9D18E' },
    { name: 'Light Blue', value: '#BDD7EE' }
  ],
  TILE_STYLES: [
    { id: 'smart-connect', label: 'Smart' },
    { id: 'solid', label: 'Fill' },
    { id: 'border-all', label: 'Border' },
    { id: 'border-top', label: 'Top' },
    { id: 'border-bottom', label: 'Bottom' },
    { id: 'border-right', label: 'Right' },
    { id: 'border-left', label: 'Left' }
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
