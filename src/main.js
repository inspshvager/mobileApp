import { setupCanvas } from './render.js';
import { initEventListeners } from './input.js';

window.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  setupCanvas();
});