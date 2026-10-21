/**
 * Monaco Editor Integration with Vite Web Workers and multi-language model buffers
 */

import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import { getLanguages, getLanguageById } from './language.js';
import { getSavedCode, saveCode, getEditorPrefs, getTheme } from './storage.js';

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
const models = {}; // Separate buffer for each language
let onCodeChangeCallback = null;
let onStatsChangeCallback = null;

export function initEditor(containerElement, initialLanguageId = 'cpp', onRunCallback = null) {
  const prefs = getEditorPrefs();
  const theme = getTheme() === 'light' ? 'vs' : 'vs-dark';

  // Create separate Monaco models for each supported language
  const languages = getLanguages();
  languages.forEach((lang) => {
    const code = getSavedCode(lang.id, lang.starterCode);
    const uri = monaco.Uri.parse(`file:///${lang.fileName}`);
    const model = monaco.editor.createModel(code, lang.monacoLanguage, uri);
    models[lang.id] = model;

    // Track model changes to persist and notify
    model.onDidChangeContent(() => {
      const currentCode = model.getValue();
      saveCode(lang.id, currentCode);
      if (onCodeChangeCallback) {
        onCodeChangeCallback(lang.id, currentCode);
      }
      updateEditorStats();
    });
  });

  // Create Monaco Editor Instance
  const initialModel = models[initialLanguageId] || models.cpp;

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

export function setEditorLanguage(languageId) {
  if (!editorInstance) return;
  const targetModel = models[languageId];
  if (targetModel) {
    editorInstance.setModel(targetModel);
    updateEditorStats();
  }
}

export function getEditorCode() {
  if (!editorInstance) return '';
  return editorInstance.getValue();
}

export function setEditorCode(languageId, code) {
  const model = models[languageId];
  if (model) {
    model.setValue(code);
    saveCode(languageId, code);
    updateEditorStats();
  }
}

export function resetEditorCodeToDefault(languageId) {
  const lang = getLanguageById(languageId);
  if (lang && models[languageId]) {
    setEditorCode(languageId, lang.starterCode);
  }
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
  if (!editorInstance || !onStatsChangeCallback) return;
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
  }
}

export function layoutEditor() {
  if (editorInstance) {
    editorInstance.layout();
  }
}
