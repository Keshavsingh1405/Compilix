/**
 * LocalStorage wrapper for Compilix preferences and code buffers
 */

const STORAGE_KEYS = {
  ACTIVE_LANGUAGE: 'compilix_active_lang',
  THEME: 'compilix_theme',
  STDIN: 'compilix_stdin',
  EDITOR_PREFS: 'compilix_editor_prefs',
  CODE_PREFIX: 'compilix_code_',
  FILES: 'compilix_files',
  ACTIVE_FILE_ID: 'compilix_active_file_id'
};

export const defaultEditorPrefs = {
  fontSize: 14,
  tabSize: 4,
  wordWrap: 'on',
  minimap: false
};

export function getStoredItem(key, defaultValue = null) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setStoredItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn('LocalStorage write failed:', err);
  }
}

export function getActiveLanguage(defaultLang = 'cpp') {
  return getStoredItem(STORAGE_KEYS.ACTIVE_LANGUAGE, defaultLang);
}

export function setActiveLanguage(lang) {
  setStoredItem(STORAGE_KEYS.ACTIVE_LANGUAGE, lang);
}

export function getSavedCode(lang, defaultTemplate = '') {
  return getStoredItem(`${STORAGE_KEYS.CODE_PREFIX}${lang}`, defaultTemplate);
}

export function saveCode(lang, code) {
  setStoredItem(`${STORAGE_KEYS.CODE_PREFIX}${lang}`, code);
}

export function getSavedStdin() {
  return getStoredItem(STORAGE_KEYS.STDIN, '');
}

export function saveStdin(stdin) {
  setStoredItem(STORAGE_KEYS.STDIN, stdin);
}

export function getTheme(defaultTheme = 'dark') {
  return getStoredItem(STORAGE_KEYS.THEME, defaultTheme);
}

export function saveTheme(theme) {
  setStoredItem(STORAGE_KEYS.THEME, theme);
}

export function getEditorPrefs() {
  try {
    const json = localStorage.getItem(STORAGE_KEYS.EDITOR_PREFS);
    return json ? { ...defaultEditorPrefs, ...JSON.parse(json) } : defaultEditorPrefs;
  } catch {
    return defaultEditorPrefs;
  }
}

export function saveEditorPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEYS.EDITOR_PREFS, JSON.stringify(prefs));
  } catch (err) {
    console.warn('Could not save editor preferences:', err);
  }
}

export function getSavedFiles() {
  try {
    const json = localStorage.getItem(STORAGE_KEYS.FILES);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      // Validate array elements
      const validFiles = parsed.filter(
        (f) => f && typeof f.id === 'string' && typeof f.name === 'string' && typeof f.languageId === 'string'
      );
      return validFiles;
    }
    return null;
  } catch (err) {
    console.warn('Could not parse stored files JSON, resetting to null:', err);
    return null;
  }
}

export function saveFiles(files) {
  try {
    localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(files));
  } catch (err) {
    console.warn('Could not save files to LocalStorage:', err);
  }
}

export function getSavedActiveFileId() {
  return getStoredItem(STORAGE_KEYS.ACTIVE_FILE_ID, null);
}

export function saveActiveFileId(fileId) {
  if (fileId) {
    setStoredItem(STORAGE_KEYS.ACTIVE_FILE_ID, fileId);
  } else {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_FILE_ID);
    } catch {
      // Ignore removal error
    }
  }
}
