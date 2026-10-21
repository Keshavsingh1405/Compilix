/**
 * Compilix — Main Frontend Application Entry
 */

import '../styles/variables.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/responsive.css';

import { initTheme } from './theme.js';
import { initEditor, getEditorCode, onCodeChange, onStatsChange, layoutEditor } from './editor.js';
import { initConsole, getCustomStdin, showExecutionLoading, renderExecutionResult } from './input-output.js';
import { initUI, getSelectedLanguageId, updateSaveStatus, updateCursorStats } from './ui.js';
import { fetchLanguages, executeCode } from './api.js';
import { setLanguages } from './language.js';

let isExecuting = false;
let saveDebounceTimer = null;

async function bootstrap() {
  // 1. Fetch backend language metadata if available
  const serverLanguages = await fetchLanguages();
  if (serverLanguages && serverLanguages.languages) {
    setLanguages(serverLanguages.languages);
  }

  // 2. Initialize Theme (dark/light)
  initTheme();

  // 3. Initialize UI elements and modals
  initUI({
    onLanguageChange: () => {
      updateSaveStatus(true);
    }
  });

  // 4. Initialize Monaco Editor
  const editorContainer = document.getElementById('monaco-editor');
  const initialLanguage = getSelectedLanguageId();

  initEditor(editorContainer, initialLanguage, handleRunCode);

  // 5. Connect Editor Event Listeners
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

  // 6. Initialize Console Panel (tabs, stdin, resizer)
  initConsole();

  // 7. Bind Run Code Button
  const runBtn = document.getElementById('btn-run-code');
  if (runBtn) {
    runBtn.addEventListener('click', handleRunCode);
  }

  // 8. Handle global keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl+S / Cmd+S -> Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      updateSaveStatus(true);
    }
  });

  // 9. Resize listener for editor
  window.addEventListener('resize', () => {
    layoutEditor();
  });
}

async function handleRunCode() {
  if (isExecuting) return; // Prevent concurrent double executions

  const runBtn = document.getElementById('btn-run-code');
  const runBtnText = document.getElementById('btn-run-text');
  const runBtnSpinner = document.getElementById('btn-run-spinner');

  const language = getSelectedLanguageId();
  const code = getEditorCode();
  const stdin = getCustomStdin();

  if (!code || !code.trim()) {
    alert('Please enter some code to execute.');
    return;
  }

  try {
    isExecuting = true;
    if (runBtn) runBtn.disabled = true;
    if (runBtnSpinner) runBtnSpinner.style.display = 'inline-block';
    if (runBtnText) runBtnText.textContent = 'Running...';

    showExecutionLoading();

    const result = await executeCode({ language, code, stdin });
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
