/**
 * Compilix — Main Frontend Application Entry
 */

import '../styles/variables.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/responsive.css';

import { initTheme } from './theme.js';
import { initFilesStore, getActiveFile, getFiles } from './files.js';
import { initEditor, getEditorCode, onCodeChange, onStatsChange, layoutEditor } from './editor.js';
import { initConsole, getCustomStdin, showExecutionLoading, renderExecutionResult } from './input-output.js';
import { initUI, updateSaveStatus, updateCursorStats, showToast, openCreateFileModal } from './ui.js';
import { fetchLanguages, executeCode } from './api.js';
import { setLanguages } from './language.js';

let isExecuting = false;
let saveDebounceTimer = null;

async function bootstrap() {
  // 1. Fetch backend language metadata if available
  try {
    const serverLanguages = await fetchLanguages();
    if (serverLanguages && serverLanguages.languages) {
      setLanguages(serverLanguages.languages);
    }
  } catch (err) {
    console.warn('Could not fetch server language definitions, using defaults:', err);
  }

  // 2. Initialize Theme (dark/light)
  initTheme();

  // 3. Initialize File Store (loads LocalStorage or sets defaults)
  const { files, activeFile } = initFilesStore();

  // 4. Initialize UI elements, file tabs, and modals
  initUI({
    onLanguageChange: () => {
      updateSaveStatus(true);
    }
  });

  // 5. Initialize Monaco Editor with all files and set active model
  const editorContainer = document.getElementById('monaco-editor');
  initEditor(editorContainer, activeFile, files, handleRunCode);

  // 6. Connect Editor Event Listeners
  onCodeChange(() => {
    updateSaveStatus(false);
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      updateSaveStatus(true);
    }, 600);
  });

  onStatsChange((stats) => {
    updateCursorStats(stats);
  });

  // 7. Initialize Console Panel (tabs, stdin, resizer)
  initConsole();

  // 8. Bind Run Code Button
  const runBtn = document.getElementById('btn-run-code');
  if (runBtn) {
    runBtn.addEventListener('click', handleRunCode);
  }

  // 9. Handle global keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl+S / Cmd+S -> Save
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      updateSaveStatus(true);
      showToast('All changes saved locally', 'info');
    }

    // Alt+N or Ctrl+Alt+N -> Open Create File modal
    if ((e.altKey && e.key.toLowerCase() === 'n') || (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n')) {
      e.preventDefault();
      const current = getActiveFile();
      openCreateFileModal(current ? current.languageId : 'cpp');
    }
  });

  // 10. Resize listener for editor
  window.addEventListener('resize', () => {
    layoutEditor();
  });
}

async function handleRunCode() {
  if (isExecuting) return; // Prevent concurrent double executions

  const activeFile = getActiveFile();
  if (!activeFile) {
    showToast('No active file open. Please create a file to run code.', 'error');
    return;
  }

  const runBtn = document.getElementById('btn-run-code');
  const runBtnText = document.getElementById('btn-run-text');
  const runBtnSpinner = document.getElementById('btn-run-spinner');

  const language = activeFile.languageId;
  const rawCode = getEditorCode();
  const stdin = getCustomStdin();

  if (!rawCode || !rawCode.trim()) {
    showToast('Please enter some code to execute.', 'error');
    return;
  }

  try {
    isExecuting = true;
    if (runBtn) runBtn.disabled = true;
    if (runBtnSpinner) runBtnSpinner.style.display = 'inline-block';
    if (runBtnText) runBtnText.textContent = 'Running...';

    showExecutionLoading();

    const result = await executeCode({
      language,
      code: rawCode,
      stdin,
      filename: activeFile.name
    });

    renderExecutionResult(result);
  } catch (error) {
    renderExecutionResult({
      success: false,
      status: 'execution_error',
      stdout: '',
      stderr: `An unexpected client error occurred: ${error.message}`,
      exitCode: 1,
      executionTimeMs: 0
    });
  } finally {
    isExecuting = false;
    if (runBtn) runBtn.disabled = false;
    if (runBtnSpinner) runBtnSpinner.style.display = 'none';
    if (runBtnText) runBtnText.textContent = 'Run';
  }
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
