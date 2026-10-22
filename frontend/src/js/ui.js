/**
 * User Interface Controller
 * Manages file tabs, creation/deletion modals, language switching,
 * downloads, workspace metrics, and health indicators.
 */

import { getLanguages, getLanguageById } from './language.js';
import { getEditorPrefs, saveEditorPrefs } from './storage.js';
import {
  switchToFileModel,
  createFileModel,
  disposeFileModel,
  resetCurrentFileModel,
  getEditorCode,
  updateEditorPreferences
} from './editor.js';
import {
  getFiles,
  getActiveFile,
  getActiveFileId,
  setActiveFileId,
  createFile,
  deleteFile,
  resetFileContent,
  validateFileName,
  getLanguageForFilename,
  DEFAULT_EXTENSIONS
} from './files.js';
import { fetchHealth } from './api.js';

let filePendingDeletion = null;
let toastTimeout = null;

export function initUI({ onLanguageChange } = {}) {
  populateLanguageSelector();
  setupLanguageChangeHandler(onLanguageChange);
  setupFileTabs();
  setupCreateFileModal();
  setupDeleteFileModal();
  setupClearCodeModal();
  setupPreferencesModal();
  setupDownloadButton();
  setupToastContainer();

  const activeFile = getActiveFile();
  updateWorkspaceInfo(activeFile);
  renderFileTabs();
  checkBackendHealth();
}

/**
 * Return current active file's language ID
 */
export function getSelectedLanguageId() {
  const active = getActiveFile();
  return active ? active.languageId : 'cpp';
}

/**
 * Populate top navigation language dropdown
 */
function populateLanguageSelector() {
  const select = document.getElementById('language-select');
  if (!select) return;

  const languages = getLanguages();
  select.innerHTML = '';

  const activeFile = getActiveFile();
  const currentLangId = activeFile ? activeFile.languageId : 'cpp';

  languages.forEach((lang) => {
    const opt = document.createElement('option');
    opt.value = lang.id;
    opt.textContent = `${lang.name}`;
    if (lang.id === currentLangId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

/**
 * Sync the top navbar language dropdown with a given language
 */
export function syncNavbarLanguage(languageId) {
  const select = document.getElementById('language-select');
  if (select && select.value !== languageId) {
    select.value = languageId;
  }
}

/**
 * Handle user changing the top navbar language selector
 */
function setupLanguageChangeHandler(onLanguageChange) {
  const select = document.getElementById('language-select');
  if (!select) return;

  select.addEventListener('change', (e) => {
    const targetLang = e.target.value;
    const files = getFiles();

    // 1. Look for an already open file in that language
    const existingFile = files.find((f) => f.languageId === targetLang);
    if (existingFile) {
      setActiveFileId(existingFile.id);
      switchToFileModel(existingFile);
      renderFileTabs();
      updateWorkspaceInfo(existingFile);
      if (onLanguageChange) onLanguageChange(targetLang);
    } else {
      // 2. Open Create File modal pre-populated with this language
      openCreateFileModal(targetLang);
    }
  });
}

/**
 * Get display icon or badge for a language
 */
function getLanguageIcon(languageId) {
  switch (languageId) {
    case 'cpp':
      return '⚙️';
    case 'java':
      return '☕';
    case 'python':
      return '🐍';
    case 'javascript':
      return '🟨';
    default:
      return '📄';
  }
}

/**
 * Render the list of file tabs in the editor toolbar
 */
export function renderFileTabs() {
  const tabsList = document.getElementById('file-tabs-list');
  if (!tabsList) return;

  const files = getFiles();
  const activeFile = getActiveFile();

  tabsList.innerHTML = '';

  files.forEach((file) => {
    const tab = document.createElement('div');
    tab.className = `file-tab ${activeFile && file.id === activeFile.id ? 'active' : ''}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-file-id', file.id);
    tab.title = `${file.name} (${getLanguageById(file.languageId)?.name || file.languageId})`;

    // Icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'tab-lang-icon';
    iconSpan.textContent = getLanguageIcon(file.languageId);
    tab.appendChild(iconSpan);

    // Filename
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tab-filename';
    nameSpan.textContent = file.name;
    tab.appendChild(nameSpan);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'tab-close-btn';
    deleteBtn.title = `Delete ${file.name}`;
    deleteBtn.setAttribute('aria-label', `Delete ${file.name}`);
    deleteBtn.innerHTML = '&times;';

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteFileModal(file);
    });

    tab.appendChild(deleteBtn);

    // Tab click: Switch to this file
    tab.addEventListener('click', () => {
      if (activeFile && file.id === activeFile.id) return;
      setActiveFileId(file.id);
      switchToFileModel(file);
      renderFileTabs();
      syncNavbarLanguage(file.languageId);
      updateWorkspaceInfo(file);
    });

    tabsList.appendChild(tab);
  });

  // Enable/disable execution and actions depending on file count
  const runBtn = document.getElementById('btn-run-code');
  const clearBtn = document.getElementById('btn-clear-code');
  const downloadBtn = document.getElementById('btn-download-code');

  if (files.length === 0) {
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.title = 'No files open. Create a file to run code.';
    }
    if (clearBtn) clearBtn.disabled = true;
    if (downloadBtn) downloadBtn.disabled = true;
  } else {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.title = 'Execute program (Ctrl+Enter)';
    }
    if (clearBtn) clearBtn.disabled = false;
    if (downloadBtn) downloadBtn.disabled = false;
  }
}

/**
 * Setup file tab bar and Add File triggers
 */
function setupFileTabs() {
  const addBtn = document.getElementById('btn-add-file');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const active = getActiveFile();
      openCreateFileModal(active ? active.languageId : 'cpp');
    });
  }

  const emptyStateAddBtn = document.getElementById('btn-empty-create-file');
  if (emptyStateAddBtn) {
    emptyStateAddBtn.addEventListener('click', () => {
      openCreateFileModal('cpp');
    });
  }
}

/**
 * Open Create File Modal
 */
export function openCreateFileModal(preselectedLang = 'cpp') {
  const modal = document.getElementById('modal-create-file');
  const langSelect = document.getElementById('modal-new-file-lang');
  const nameInput = document.getElementById('modal-new-file-name');
  const errorContainer = document.getElementById('modal-new-file-error');
  const hintContainer = document.getElementById('modal-new-file-hint');

  if (!modal) return;

  if (langSelect) langSelect.value = preselectedLang;
  if (nameInput) {
    nameInput.value = '';
    updateCreateFileHints(preselectedLang);
  }
  if (errorContainer) {
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
  }

  modal.classList.add('active');
  setTimeout(() => {
    if (nameInput) nameInput.focus();
  }, 50);
}

function updateCreateFileHints(langId) {
  const nameInput = document.getElementById('modal-new-file-name');
  const hintContainer = document.getElementById('modal-new-file-hint');

  const defaultExt = DEFAULT_EXTENSIONS[langId] || '.cpp';
  const sampleNames = {
    cpp: 'solution.cpp',
    java: 'Calculator.java',
    python: 'solution.py',
    javascript: 'app.js'
  };

  if (nameInput) {
    nameInput.placeholder = `e.g. ${sampleNames[langId] || 'file' + defaultExt}`;
  }

  if (hintContainer) {
    if (langId === 'java') {
      hintContainer.textContent = 'Extension: .java (Class name will match the filename)';
    } else {
      hintContainer.textContent = `Default extension: ${defaultExt}`;
    }
  }
}

/**
 * Setup Create File Modal bindings
 */
function setupCreateFileModal() {
  const modal = document.getElementById('modal-create-file');
  const langSelect = document.getElementById('modal-new-file-lang');
  const nameInput = document.getElementById('modal-new-file-name');
  const errorContainer = document.getElementById('modal-new-file-error');
  const btnConfirm = document.getElementById('btn-confirm-create-file');
  const btnCancel = document.getElementById('btn-cancel-create-file');

  if (!modal) return;

  const closeModal = () => modal.classList.remove('active');

  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  // Changing language select updates placeholder and hints
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      updateCreateFileHints(e.target.value);
    });
  }

  // Auto-detect language as user types extension
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      if (errorContainer) errorContainer.style.display = 'none';

      const val = e.target.value.trim();
      const detected = getLanguageForFilename(val);
      if (detected && langSelect && langSelect.value !== detected) {
        langSelect.value = detected;
        updateCreateFileHints(detected);
      }
    });

    // Enter key submits modal
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitCreateFile();
      }
    });
  }

  const submitCreateFile = () => {
    const rawName = nameInput ? nameInput.value : '';
    const selectedLang = langSelect ? langSelect.value : 'cpp';

    const validation = validateFileName(rawName, selectedLang, getFiles());
    if (!validation.valid) {
      if (errorContainer) {
        errorContainer.textContent = validation.error;
        errorContainer.style.display = 'block';
      }
      return;
    }

    try {
      const newFile = createFile({
        name: validation.sanitizedName,
        languageId: validation.languageId
      });

      // Create editor model and activate
      createFileModel(newFile);
      switchToFileModel(newFile);

      renderFileTabs();
      syncNavbarLanguage(newFile.languageId);
      updateWorkspaceInfo(newFile);

      closeModal();
      showToast(`Created file "${newFile.name}"`, 'success');
    } catch (err) {
      if (errorContainer) {
        errorContainer.textContent = err.message;
        errorContainer.style.display = 'block';
      }
    }
  };

  if (btnConfirm) {
    btnConfirm.addEventListener('click', submitCreateFile);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

/**
 * Open Delete File Confirmation Modal
 */
export function openDeleteFileModal(file) {
  filePendingDeletion = file;
  const modal = document.getElementById('modal-delete-confirm');
  const nameLabel = document.getElementById('delete-file-name-label');

  if (!modal) return;

  if (nameLabel) {
    nameLabel.textContent = file.name;
  }

  modal.classList.add('active');
}

/**
 * Setup Delete File Confirmation Modal
 */
function setupDeleteFileModal() {
  const modal = document.getElementById('modal-delete-confirm');
  const btnCancel = document.getElementById('btn-cancel-delete');
  const btnConfirm = document.getElementById('btn-confirm-delete');

  if (!modal) return;

  const closeModal = () => {
    filePendingDeletion = null;
    modal.classList.remove('active');
  };

  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      if (!filePendingDeletion) return;

      const fileToDelete = filePendingDeletion;
      const { deletedFile, nextActiveFile } = deleteFile(fileToDelete.id);

      // Clean up Monaco model
      disposeFileModel(fileToDelete.id);

      // Switch editor to next file or empty state
      if (nextActiveFile) {
        switchToFileModel(nextActiveFile);
        syncNavbarLanguage(nextActiveFile.languageId);
        updateWorkspaceInfo(nextActiveFile);
      } else {
        switchToFileModel(null);
        updateWorkspaceInfo(null);
      }

      renderFileTabs();
      closeModal();
      showToast(`Deleted file "${deletedFile.name}"`, 'info');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

/**
 * Update Sidebar and Workspace labels
 */
export function updateWorkspaceInfo(file) {
  const sidebarFile = document.getElementById('sidebar-filename');
  const sidebarRuntime = document.getElementById('sidebar-runtime');
  const sidebarLang = document.getElementById('sidebar-lang-name');

  if (!file) {
    if (sidebarFile) sidebarFile.textContent = 'No file open';
    if (sidebarRuntime) sidebarRuntime.textContent = '—';
    if (sidebarLang) sidebarLang.textContent = '—';
    return;
  }

  const lang = getLanguageById(file.languageId);

  if (sidebarFile) sidebarFile.textContent = file.name;
  if (sidebarRuntime) sidebarRuntime.textContent = lang ? lang.version : '—';
  if (sidebarLang) sidebarLang.textContent = lang ? lang.name : file.languageId;
}

/**
 * Update save status indicator
 */
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

/**
 * Update cursor line/col metrics
 */
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

/**
 * Setup Clear / Reset Code Modal
 */
function setupClearCodeModal() {
  const btnTrigger = document.getElementById('btn-clear-code');
  const modal = document.getElementById('modal-clear-confirm');
  const btnConfirm = document.getElementById('btn-confirm-clear');
  const btnCancel = document.getElementById('btn-cancel-clear');
  const clearFileName = document.getElementById('clear-file-name-label');

  if (!btnTrigger || !modal) return;

  btnTrigger.addEventListener('click', () => {
    const active = getActiveFile();
    if (!active) return;
    if (clearFileName) clearFileName.textContent = active.name;
    modal.classList.add('active');
  });

  const closeModal = () => modal.classList.remove('active');

  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      const active = getActiveFile();
      if (active) {
        const resetFile = resetFileContent(active.id);
        resetCurrentFileModel(resetFile);
        updateSaveStatus(true);
        showToast(`Reset "${active.name}" to starter template`, 'info');
      }
      closeModal();
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

/**
 * Setup Preferences Modal
 */
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
      showToast('Editor preferences updated', 'success');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

/**
 * Setup Download Code Button
 */
function setupDownloadButton() {
  const btnDownload = document.getElementById('btn-download-code');
  if (!btnDownload) return;

  btnDownload.addEventListener('click', () => {
    const active = getActiveFile();
    if (!active) {
      showToast('No active file to download', 'error');
      return;
    }

    const code = getEditorCode();
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = active.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded "${active.name}"`, 'success');
  });
}

/**
 * Setup Toast Notifications
 */
function setupToastContainer() {
  let toastEl = document.getElementById('compilix-toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'compilix-toast';
    toastEl.className = 'compilix-toast';
    document.body.appendChild(toastEl);
  }
}

export function showToast(message, type = 'info') {
  const toastEl = document.getElementById('compilix-toast');
  if (!toastEl) return;

  clearTimeout(toastTimeout);
  toastEl.textContent = message;
  toastEl.className = `compilix-toast show ${type}`;

  toastTimeout = setTimeout(() => {
    toastEl.className = 'compilix-toast';
  }, 2800);
}

/**
 * Check backend and Docker health
 */
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
