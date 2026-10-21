/**
 * Theme switcher (Dark / Light)
 */

import { getTheme, saveTheme } from './storage.js';
import { setEditorTheme } from './editor.js';

let currentTheme = 'dark';

export function initTheme() {
  currentTheme = getTheme('dark');
  applyTheme(currentTheme);

  const toggleBtn = document.getElementById('btn-theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }
}

export function applyTheme(theme) {
  currentTheme = theme;
  saveTheme(theme);
  document.documentElement.setAttribute('data-theme', theme);
  setEditorTheme(theme);

  const toggleBtn = document.getElementById('btn-theme-toggle');
  if (toggleBtn) {
    toggleBtn.title = `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`;
    const icon = toggleBtn.querySelector('.theme-icon');
    if (icon) {
      icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }
}

export function getCurrentTheme() {
  return currentTheme;
}
