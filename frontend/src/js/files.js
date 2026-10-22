/**
 * File Management Model and State Store for Compilix
 * Handles file creation, deletion, validation, starter code generation, and state persistence.
 */

import { getLanguages, getLanguageById } from './language.js';
import {
  getSavedFiles,
  saveFiles,
  getSavedActiveFileId,
  saveActiveFileId,
  getActiveLanguage,
  setActiveLanguage,
  getSavedCode,
  saveCode
} from './storage.js';

export const LANGUAGE_EXTENSIONS = {
  cpp: ['.cpp', '.cc', '.cxx'],
  java: ['.java'],
  python: ['.py'],
  javascript: ['.js', '.mjs']
};

export const DEFAULT_EXTENSIONS = {
  cpp: '.cpp',
  java: '.java',
  python: '.py',
  javascript: '.js'
};

let files = [];
let activeFileId = null;

/**
 * Generate starter template for a given language and filename
 */
export function generateStarterCode(languageId, filename = '') {
  if (languageId === 'java') {
    let className = 'Main';
    if (filename && filename.endsWith('.java')) {
      className = filename.slice(0, -5);
    }
    return `public class ${className} {
    public static void main(String[] args) {
        System.out.println("Hello from Java in Compilix!");
    }
}
`;
  }

  const lang = getLanguageById(languageId);
  return lang ? lang.starterCode : '';
}

/**
 * Infer programming language from file extension
 */
export function getLanguageForFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const lower = filename.toLowerCase();

  for (const [langId, exts] of Object.entries(LANGUAGE_EXTENSIONS)) {
    for (const ext of exts) {
      if (lower.endsWith(ext)) {
        return langId;
      }
    }
  }

  return null;
}

/**
 * Validate a filename against rules, extensions, and existing files
 */
export function validateFileName(rawName, preferredLanguageId = 'cpp', existingFiles = files) {
  if (!rawName || typeof rawName !== 'string') {
    return { valid: false, error: 'Filename cannot be empty.' };
  }

  const trimmed = rawName.trim();
  if (!trimmed) {
    return { valid: false, error: 'Filename cannot be empty or only spaces.' };
  }

  // Check invalid filename characters
  if (/[\\/:*?"<>|\s]/.test(trimmed)) {
    return {
      valid: false,
      error: 'Filename cannot contain spaces or special characters: \\ / : * ? " < > |'
    };
  }

  if (trimmed.startsWith('.')) {
    return { valid: false, error: 'Filename cannot start with a dot.' };
  }

  let finalName = trimmed;
  let detectedLang = getLanguageForFilename(trimmed);

  // If no extension provided, append default extension for preferred language
  if (!detectedLang) {
    if (!trimmed.includes('.')) {
      const defaultExt = DEFAULT_EXTENSIONS[preferredLanguageId] || '.cpp';
      finalName = `${trimmed}${defaultExt}`;
      detectedLang = preferredLanguageId;
    } else {
      return {
        valid: false,
        error: 'Unsupported file extension. Compilix supports C++ (.cpp, .cc, .cxx), Java (.java), Python (.py), and JavaScript (.js, .mjs).'
      };
    }
  }

  // Java-specific class name validation
  if (detectedLang === 'java') {
    const className = finalName.slice(0, -5);
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(className)) {
      return {
        valid: false,
        error: 'Java class name in filename must be a valid Java identifier (e.g. Solution.java or Calculator.java).'
      };
    }
  }

  // Check for duplicate filenames (case-insensitive)
  const isDuplicate = existingFiles.some(
    (f) => f.name.toLowerCase() === finalName.toLowerCase()
  );

  if (isDuplicate) {
    return {
      valid: false,
      error: `A file named "${finalName}" already exists.`
    };
  }

  return {
    valid: true,
    sanitizedName: finalName,
    languageId: detectedLang
  };
}

/**
 * Initialize files store from LocalStorage or defaults
 */
export function initFilesStore() {
  const savedFiles = getSavedFiles();

  if (Array.isArray(savedFiles) && savedFiles.length > 0) {
    files = savedFiles;
    const savedActiveId = getSavedActiveFileId();
    const exists = files.find((f) => f.id === savedActiveId);
    activeFileId = exists ? exists.id : files[0].id;
  } else {
    // Initialize default set of files with any previously saved code
    const initialLang = getActiveLanguage('cpp');
    files = [
      {
        id: 'file-cpp-default',
        name: 'main.cpp',
        languageId: 'cpp',
        content: getSavedCode('cpp', generateStarterCode('cpp', 'main.cpp'))
      },
      {
        id: 'file-java-default',
        name: 'Main.java',
        languageId: 'java',
        content: getSavedCode('java', generateStarterCode('java', 'Main.java'))
      },
      {
        id: 'file-python-default',
        name: 'main.py',
        languageId: 'python',
        content: getSavedCode('python', generateStarterCode('python', 'main.py'))
      },
      {
        id: 'file-js-default',
        name: 'main.js',
        languageId: 'javascript',
        content: getSavedCode('javascript', generateStarterCode('javascript', 'main.js'))
      }
    ];

    const matchActive = files.find((f) => f.languageId === initialLang);
    activeFileId = matchActive ? matchActive.id : files[0].id;

    saveFiles(files);
    saveActiveFileId(activeFileId);
  }

  return {
    files,
    activeFile: getActiveFile()
  };
}

export function getFiles() {
  return files;
}

export function getFileById(id) {
  return files.find((f) => f.id === id) || null;
}

export function getActiveFile() {
  if (!activeFileId) return null;
  return files.find((f) => f.id === activeFileId) || null;
}

export function getActiveFileId() {
  return activeFileId;
}

export function setActiveFileId(id) {
  const target = files.find((f) => f.id === id);
  if (target) {
    activeFileId = id;
    saveActiveFileId(id);
    setActiveLanguage(target.languageId);
  }
  return target || null;
}

/**
 * Create a new file, generate starter code, set active, and persist
 */
export function createFile({ name, languageId }) {
  const validation = validateFileName(name, languageId, files);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const finalName = validation.sanitizedName;
  const finalLang = validation.languageId;
  const starterCode = generateStarterCode(finalLang, finalName);
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const newFile = {
    id: fileId,
    name: finalName,
    languageId: finalLang,
    content: starterCode
  };

  files.push(newFile);
  activeFileId = fileId;

  saveFiles(files);
  saveActiveFileId(fileId);
  setActiveLanguage(finalLang);

  return newFile;
}

/**
 * Delete a file by ID, choose next active file, and persist
 */
export function deleteFile(id) {
  const index = files.findIndex((f) => f.id === id);
  if (index === -1) return null;

  const deletedFile = files[index];
  let nextActiveFile = null;

  if (activeFileId === id) {
    if (files.length > 1) {
      // Pick adjacent file
      const nextIndex = index > 0 ? index - 1 : 1;
      nextActiveFile = files[nextIndex];
      activeFileId = nextActiveFile.id;
      setActiveLanguage(nextActiveFile.languageId);
      saveActiveFileId(activeFileId);
    } else {
      // No files remain
      activeFileId = null;
      saveActiveFileId(null);
    }
  } else {
    nextActiveFile = getActiveFile();
  }

  files.splice(index, 1);
  saveFiles(files);

  return {
    deletedFile,
    nextActiveFile,
    remainingCount: files.length
  };
}

/**
 * Update content of a file
 */
export function updateFileContent(id, newContent) {
  const file = files.find((f) => f.id === id);
  if (file) {
    file.content = newContent;
    saveFiles(files);

    // Keep legacy single-language storage in sync
    saveCode(file.languageId, newContent);
  }
}

/**
 * Reset a file's content to its default starter template
 */
export function resetFileContent(id) {
  const file = files.find((f) => f.id === id);
  if (file) {
    file.content = generateStarterCode(file.languageId, file.name);
    saveFiles(files);
    saveCode(file.languageId, file.content);
    return file;
  }
  return null;
}
