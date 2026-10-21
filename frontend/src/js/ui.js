/**
 * User Interface Controller (Language Switching, Modals, Downloads, Stats, Status Indicators)
 */

import { getLanguages, getLanguageById } from './language.js';
import { getActiveLanguage, setActiveLanguage, getEditorPrefs, saveEditorPrefs } from './storage.js';
import { setEditorLanguage, getEditorCode, resetEditorCodeToDefault, updateEditorPreferences } from './editor.js';
import { fetchHealth } from './api.js';

let activeLanguageId = 'cpp';

export function initUI({ onLanguageChange } = {}) {
  activeLanguageId = getActiveLanguage('cpp');

  populateLanguageSelector();
  setupLanguageChangeHandler(onLanguageChange);
  setupClearCodeModal();
  setupPreferencesModal();
  setupDownloadButton();
  updateWorkspaceInfo(activeLanguageId);
  checkBackendHealth();
}

export function getSelectedLanguageId() {
  return activeLanguageId;
}

function populateLanguageSelector() {
  const select = document.getElementById('language-select');
  if (!select) return;

  const languages = getLanguages();
  select.innerHTML = '';

  languages.forEach((lang) => {
    const opt = document.createElement('option');
    opt.value = lang.id;
    opt.textContent = `${lang.name}`;
    if (lang.id === activeLanguageId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function setupLanguageChangeHandler(onLanguageChange) {
  const select = document.getElementById('language-select');
  if (!select) return;

  select.addEventListener('change', (e) => {
    const newLang = e.target.value;
    activeLanguageId = newLang;
    setActiveLanguage(newLang);
    setEditorLanguage(newLang);
    updateWorkspaceInfo(newLang);

    if (onLanguageChange) {
      onLanguageChange(newLang);
    }
  });
}

export function updateWorkspaceInfo(langId) {
  const lang = getLanguageById(langId);
  if (!lang) return;

  // Update file tab label
  const fileTabLabel = document.getElementById('current-file-label');
  if (fileTabLabel) {
    fileTabLabel.textContent = lang.fileName;
  }

  // Update sidebar info
  const sidebarFile = document.getElementById('sidebar-filename');
  const sidebarRuntime = document.getElementById('sidebar-runtime');
  const sidebarLang = document.getElementById('sidebar-lang-name');

  if (sidebarFile) sidebarFile.textContent = lang.fileName;
  if (sidebarRuntime) sidebarRuntime.textContent = lang.version;
  if (sidebarLang) sidebarLang.textContent = lang.name;
}

export function updateSaveStatus(isSaved) {
  const dot = document.getElementById('save-status-dot');
  const label = document.getElementById('save-status-text');

  if (dot && label) {
    if (isSaved) {
      dot.className = 'status-dot';
      label.textContent = 'Saved';
    } else {
      dot.className = 'status-dot unsaved';
      label.textContent = 'Editing';
    }
  }
}

export function updateCursorStats({ line, column, totalLines, totalChars }) {
  const statsLineCol = document.getElementById('stats-cursor');
  const statsCounts = document.getElementById('stats-counts');

  if (statsLineCol) {
    statsLineCol.textContent = `Ln ${line}, Col ${column}`;
  }
  if (statsCounts) {
    statsCounts.textContent = `${totalLines} lines (${totalChars} chars)`;
  }
}

function setupClearCodeModal() {
  const btnTrigger = document.getElementById('btn-clear-code');
  const modal = document.getElementById('modal-clear-confirm');
  const btnConfirm = document.getElementById('btn-confirm-clear');
  const btnCancel = document.getElementById('btn-cancel-clear');

  if (!btnTrigger || !modal) return;

  btnTrigger.addEventListener('click', () => {
    modal.classList.add('active');
  });

  const closeModal = () => modal.classList.remove('active');

  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      resetEditorCodeToDefault(activeLanguageId);
      closeModal();
      updateSaveStatus(true);
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

function setupPreferencesModal() {
  const btnTrigger = document.getElementById('btn-editor-settings');
  const modal = document.getElementById('modal-editor-settings');
  const btnSave = document.getElementById('btn-save-settings');
  const btnCancel = document.getElementById('btn-cancel-settings');

  const fontSizeSelect = document.getElementById('pref-font-size');
  const tabSizeSelect = document.getElementById('pref-tab-size');
  const wordWrapSelect = document.getElementById('pref-word-wrap');
  const minimapSelect = document.getElementById('pref-minimap');

  if (!btnTrigger || !modal) return;

  const currentPrefs = getEditorPrefs();

  // Load current values into form
  const loadForm = () => {
    const p = getEditorPrefs();
    if (fontSizeSelect) fontSizeSelect.value = p.fontSize;
    if (tabSizeSelect) tabSizeSelect.value = p.tabSize;
    if (wordWrapSelect) wordWrapSelect.value = p.wordWrap;
    if (minimapSelect) minimapSelect.value = p.minimap ? 'true' : 'false';
  };

  btnTrigger.addEventListener('click', () => {
    loadForm();
    modal.classList.add('active');
  });

  const closeModal = () => modal.classList.remove('active');

  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const newPrefs = {
        fontSize: parseInt(fontSizeSelect.value, 10),
        tabSize: parseInt(tabSizeSelect.value, 10),
        wordWrap: wordWrapSelect.value,
        minimap: minimapSelect.value === 'true'
      };

      saveEditorPrefs(newPrefs);
      updateEditorPreferences(newPrefs);
      closeModal();
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

function setupDownloadButton() {
  const btnDownload = document.getElementById('btn-download-code');
  if (!btnDownload) return;

  btnDownload.addEventListener('click', () => {
    const lang = getLanguageById(activeLanguageId);
    const code = getEditorCode();
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = lang.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

async function checkBackendHealth() {
  const healthBadge = document.getElementById('backend-health-indicator');
  const dockerBadge = document.getElementById('docker-health-indicator');
  if (!healthBadge) return;

  const health = await fetchHealth();

  if (health.status === 'ok') {
    healthBadge.textContent = 'API Online';
    healthBadge.className = 'status-badge success';

    if (dockerBadge) {
      if (health.executionEngine?.dockerAvailable) {
        dockerBadge.textContent = 'Docker Sandbox Ready';
        dockerBadge.className = 'status-badge success';
      } else {
        dockerBadge.textContent = 'Docker Offline';
        dockerBadge.className = 'status-badge error';
        dockerBadge.title = 'Docker daemon not running on backend';
      }
    }
  } else {
    healthBadge.textContent = 'API Offline';
    healthBadge.className = 'status-badge error';
    healthBadge.title = 'Cannot reach backend server';
    if (dockerBadge) {
      dockerBadge.textContent = 'Sandbox Offline';
      dockerBadge.className = 'status-badge error';
    }
  }
}
