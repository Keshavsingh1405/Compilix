/**
 * Console Panel Controller (Tabs, Custom Stdin, Output Display, Resizer)
 */

import { getSavedStdin, saveStdin } from './storage.js';
import { layoutEditor } from './editor.js';

let activeTab = 'input'; // 'input' | 'output' | 'errors'

export function initConsole({ onStdinChange } = {}) {
  const stdinTextarea = document.getElementById('stdin-input');
  const clearStdinBtn = document.getElementById('btn-clear-stdin');
  const clearOutputBtn = document.getElementById('btn-clear-output');
  const resizer = document.getElementById('console-resizer');
  const consolePanel = document.querySelector('.console-panel');

  // Load saved stdin
  if (stdinTextarea) {
    stdinTextarea.value = getSavedStdin();
    stdinTextarea.addEventListener('input', (e) => {
      saveStdin(e.target.value);
      if (onStdinChange) onStdinChange(e.target.value);
    });
  }

  // Clear Stdin
  if (clearStdinBtn && stdinTextarea) {
    clearStdinBtn.addEventListener('click', () => {
      stdinTextarea.value = '';
      saveStdin('');
      if (onStdinChange) onStdinChange('');
    });
  }

  // Clear Output & Errors
  if (clearOutputBtn) {
    clearOutputBtn.addEventListener('click', () => {
      clearConsoleOutput();
    });
  }

  // Tab switching
  setupTabs();

  // Resizer handling
  if (resizer && consolePanel) {
    setupResizer(resizer, consolePanel);
  }
}

export function getCustomStdin() {
  const el = document.getElementById('stdin-input');
  return el ? el.value : '';
}

export function setCustomStdin(value) {
  const el = document.getElementById('stdin-input');
  if (el) {
    el.value = value;
    saveStdin(value);
  }
}

export function switchTab(tabName) {
  activeTab = tabName;
  const tabButtons = document.querySelectorAll('.console-tab-btn');
  const tabPanes = document.querySelectorAll('.console-tab-content');

  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  tabPanes.forEach((pane) => {
    pane.classList.toggle('active', pane.id === `tab-${tabName}`);
  });
}

function setupTabs() {
  const tabButtons = document.querySelectorAll('.console-tab-btn');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });
}

export function showExecutionLoading() {
  const statusBadge = document.getElementById('execution-status-badge');
  const timePill = document.getElementById('execution-time-pill');
  const exitPill = document.getElementById('execution-exit-pill');
  const outputContent = document.getElementById('stdout-content');

  if (statusBadge) {
    statusBadge.className = 'status-badge warning';
    statusBadge.innerHTML = '<span class="spinner" style="width:10px;height:10px;border-width:1.5px;"></span> Running';
    statusBadge.style.display = 'inline-flex';
  }

  if (timePill) timePill.style.display = 'none';
  if (exitPill) exitPill.style.display = 'none';

  if (outputContent) {
    outputContent.innerHTML = '<div class="empty-state"><span class="spinner"></span><p>Executing program in isolated Docker sandbox...</p></div>';
  }

  switchTab('output');
}

export function renderExecutionResult(result) {
  const statusBadge = document.getElementById('execution-status-badge');
  const timePill = document.getElementById('execution-time-pill');
  const exitPill = document.getElementById('execution-exit-pill');
  const stdoutContainer = document.getElementById('stdout-content');
  const errorsContainer = document.getElementById('stderr-content');
  const errorTabBadge = document.getElementById('error-tab-badge');

  const { success, stdout, stderr, exitCode, executionTimeMs, status } = result;

  // Status Badge
  if (statusBadge) {
    statusBadge.style.display = 'inline-flex';
    statusBadge.className = `status-badge ${status}`;

    const labelMap = {
      success: 'Success',
      compilation_error: 'Compilation Error',
      runtime_error: 'Runtime Error',
      time_limit_exceeded: 'Time Limit Exceeded',
      output_limit_exceeded: 'Output Limit Exceeded',
      execution_error: 'Execution Error',
      network_error: 'Network Error',
      rate_limited: 'Rate Limited'
    };

    statusBadge.textContent = labelMap[status] || status;
  }

  // Execution Time
  if (timePill) {
    timePill.style.display = 'inline-block';
    timePill.textContent = `${executionTimeMs}ms`;
  }

  // Exit Code
  if (exitPill) {
    exitPill.style.display = 'inline-block';
    exitPill.textContent = `Exit: ${exitCode}`;
  }

  // Render Stdout
  if (stdoutContainer) {
    if (stdout && stdout.trim()) {
      stdoutContainer.innerHTML = `<pre class="code-output-block">${escapeHtml(stdout)}</pre>`;
    } else if (success) {
      stdoutContainer.innerHTML = '<div class="empty-state"><p>(Program finished with no standard output)</p></div>';
    } else {
      stdoutContainer.innerHTML = '<div class="empty-state"><p>(No stdout generated due to execution error)</p></div>';
    }
  }

  // Render Stderr / Errors
  if (errorsContainer) {
    if (stderr && stderr.trim()) {
      errorsContainer.innerHTML = `<pre class="code-output-block error-output">${escapeHtml(stderr)}</pre>`;
      if (errorTabBadge) {
        errorTabBadge.style.display = 'inline-block';
        errorTabBadge.textContent = '!';
        errorTabBadge.style.backgroundColor = 'var(--color-error)';
        errorTabBadge.style.color = '#ffffff';
      }
    } else {
      errorsContainer.innerHTML = '<div class="empty-state"><p>No errors or warnings recorded.</p></div>';
      if (errorTabBadge) errorTabBadge.style.display = 'none';
    }
  }

  // Auto-switch tab based on result
  if (!success && stderr && stderr.trim()) {
    switchTab('errors');
  } else {
    switchTab('output');
  }
}

export function clearConsoleOutput() {
  const statusBadge = document.getElementById('execution-status-badge');
  const timePill = document.getElementById('execution-time-pill');
  const exitPill = document.getElementById('execution-exit-pill');
  const stdoutContainer = document.getElementById('stdout-content');
  const errorsContainer = document.getElementById('stderr-content');
  const errorTabBadge = document.getElementById('error-tab-badge');

  if (statusBadge) statusBadge.style.display = 'none';
  if (timePill) timePill.style.display = 'none';
  if (exitPill) exitPill.style.display = 'none';
  if (errorTabBadge) errorTabBadge.style.display = 'none';

  if (stdoutContainer) {
    stdoutContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">▶</div>
        <p>No execution results yet.</p>
        <p style="font-size:12px;opacity:0.8;">Click <strong>Run Code</strong> or press <kbd class="shortcut-kbd">Ctrl</kbd> + <kbd class="shortcut-kbd">Enter</kbd> to execute.</p>
      </div>
    `;
  }

  if (errorsContainer) {
    errorsContainer.innerHTML = `
      <div class="empty-state">
        <p>No compilation or runtime errors.</p>
      </div>
    `;
  }
}

function setupResizer(resizerEl, targetPanel) {
  let isDragging = false;
  let startY = 0;
  let startHeight = 0;

  resizerEl.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.clientY;
    startHeight = targetPanel.offsetHeight;
    resizerEl.classList.add('dragging');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dy = startY - e.clientY;
    const newHeight = Math.min(Math.max(startHeight + dy, 120), window.innerHeight * 0.75);
    targetPanel.style.height = `${newHeight}px`;
    layoutEditor();
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      resizerEl.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      layoutEditor();
    }
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
