/**
 * Monaco Editor Integration with Vite Web Workers and multi-file model buffers
 */

import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import { getLanguageById } from './language.js';
import { updateFileContent } from './files.js';
import { getEditorPrefs, getTheme } from './storage.js';

// 1. Configure Monaco Web Workers for Vite
self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  }
};

let editorInstance = null;
const fileModels = new Map(); // Map<fileId, monaco.editor.ITextModel>
let onCodeChangeCallback = null;
let onStatsChangeCallback = null;
let emptyStateElement = null;

/**
 * Create a Monaco TextModel for a specific file
 */
export function createFileModel(file) {
  if (!file) return null;

  // If a model already exists for this file ID, return it
  if (fileModels.has(file.id)) {
    return fileModels.get(file.id);
  }

  const lang = getLanguageById(file.languageId);
  const uri = monaco.Uri.parse(`file:///${file.name}`);

  // If Monaco already has a model with this URI from a previous session, dispose it first
  const existingUriModel = monaco.editor.getModel(uri);
  if (existingUriModel) {
    existingUriModel.dispose();
  }

  const model = monaco.editor.createModel(file.content, lang.monacoLanguage, uri);

  // Track content edits
  model.onDidChangeContent(() => {
    const currentCode = model.getValue();
    updateFileContent(file.id, currentCode);
    if (onCodeChangeCallback) {
      onCodeChangeCallback(file.id, currentCode);
    }
    updateEditorStats();
  });

  fileModels.set(file.id, model);
  return model;
}

/**
 * Dispose a file's Monaco TextModel
 */
export function disposeFileModel(fileId) {
  if (fileModels.has(fileId)) {
    const model = fileModels.get(fileId);
    model.dispose();
    fileModels.delete(fileId);
  }
}

/**
 * Initialize Monaco Editor with multiple file models
 */
export function initEditor(containerElement, initialFile, allFiles = [], onRunCallback = null) {
  const prefs = getEditorPrefs();
  const theme = getTheme() === 'light' ? 'vs' : 'vs-dark';

  emptyStateElement = document.getElementById('empty-editor-state');

  // Pre-create models for all available files
  allFiles.forEach((file) => {
    createFileModel(file);
  });

  const initialModel = initialFile ? createFileModel(initialFile) : null;

  // Create Monaco Editor Instance
  editorInstance = monaco.editor.create(containerElement, {
    model: initialModel,
    theme,
    fontSize: prefs.fontSize || 14,
    tabSize: prefs.tabSize || 4,
    wordWrap: prefs.wordWrap || 'on',
    minimap: { enabled: Boolean(prefs.minimap) },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    fontFamily: '"JetBrains Mono", Menlo, Monaco, Consolas, "Courier New", monospace',
    padding: { top: 12, bottom: 12 },
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    bracketPairColorization: { enabled: true }
  });

  // Handle empty state visibility
  if (!initialModel) {
    showEmptyEditorState();
  } else {
    hideEmptyEditorState();
  }

  // Register Ctrl+Enter / Cmd+Enter shortcut to run code
  if (onRunCallback) {
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunCallback();
    });
  }

  // Update line and column statistics on cursor move
  editorInstance.onDidChangeCursorPosition(() => {
    updateEditorStats();
  });

  updateEditorStats();

  return editorInstance;
}

/**
 * Switch the active file model displayed in the editor
 */
export function switchToFileModel(file) {
  if (!editorInstance) return;

  if (!file) {
    editorInstance.setModel(null);
    showEmptyEditorState();
    updateEditorStats();
    return;
  }

  hideEmptyEditorState();

  let targetModel = fileModels.get(file.id);
  if (!targetModel) {
    targetModel = createFileModel(file);
  }

  editorInstance.setModel(targetModel);
  editorInstance.focus();
  updateEditorStats();
  layoutEditor();
}

/**
 * Reset code in the current active file model
 */
export function resetCurrentFileModel(file) {
  if (!file) return;
  const model = fileModels.get(file.id);
  if (model) {
    model.setValue(file.content);
    updateEditorStats();
  }
}

export function getEditorCode() {
  if (!editorInstance) return '';
  const model = editorInstance.getModel();
  return model ? model.getValue() : '';
}

export function setEditorTheme(themeName) {
  const monacoTheme = themeName === 'light' ? 'vs' : 'vs-dark';
  monaco.editor.setTheme(monacoTheme);
}

export function updateEditorPreferences(prefs) {
  if (!editorInstance) return;
  editorInstance.updateOptions({
    fontSize: prefs.fontSize,
    tabSize: prefs.tabSize,
    wordWrap: prefs.wordWrap,
    minimap: { enabled: Boolean(prefs.minimap) }
  });
}

export function onCodeChange(callback) {
  onCodeChangeCallback = callback;
}

export function onStatsChange(callback) {
  onStatsChangeCallback = callback;
}

function updateEditorStats() {
  if (!onStatsChangeCallback) return;

  if (!editorInstance) {
    onStatsChangeCallback({ line: 0, column: 0, totalLines: 0, totalChars: 0 });
    return;
  }

  const model = editorInstance.getModel();
  const position = editorInstance.getPosition();

  if (model && position) {
    const lineCount = model.getLineCount();
    const charCount = model.getValueLength();
    onStatsChangeCallback({
      line: position.lineNumber,
      column: position.column,
      totalLines: lineCount,
      totalChars: charCount
    });
  } else {
    onStatsChangeCallback({ line: 0, column: 0, totalLines: 0, totalChars: 0 });
  }
}

export function showEmptyEditorState() {
  if (emptyStateElement) {
    emptyStateElement.style.display = 'flex';
  }
}

export function hideEmptyEditorState() {
  if (emptyStateElement) {
    emptyStateElement.style.display = 'none';
  }
}

export function layoutEditor() {
  if (editorInstance) {
    editorInstance.layout();
  }
}
