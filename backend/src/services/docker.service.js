/**
 * Docker execution service
 * Manages sandboxed container lifecycles, resource constraints, and safe output streaming.
 */

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';
import { AppError, DockerUnavailableError, ExecutionError } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempBaseDir = path.resolve(__dirname, '../../temp');

// Ensure base temp directory exists with world-writable permissions for container runners
if (!fs.existsSync(tempBaseDir)) {
  fs.mkdirSync(tempBaseDir, { recursive: true });
}
try {
  fs.chmodSync(tempBaseDir, 0o777);
} catch {
  // Ignore filesystem permission errors (e.g. Windows NTFS)
}

const SIGNAL_NAMES = {
  1: 'SIGHUP (Hangup)',
  2: 'SIGINT (Interrupt)',
  3: 'SIGQUIT (Quit)',
  4: 'SIGILL (Illegal instruction)',
  6: 'SIGABRT (Process aborted)',
  8: 'SIGFPE (Floating-point / arithmetic exception)',
  9: 'SIGKILL (Killed)',
  11: 'SIGSEGV (Segmentation fault / invalid memory access)',
  13: 'SIGPIPE (Broken pipe)',
  14: 'SIGALRM (Alarm clock)',
  15: 'SIGTERM (Termination request)',
  24: 'SIGXCPU (CPU time limit exceeded)',
  25: 'SIGXFSZ (File size limit exceeded)'
};

export const RUNNER_CONFIG = {
  cpp: {
    image: 'compilix-runner-cpp',
    filename: 'main.cpp',
    compiled: true
  },
  java: {
    image: 'compilix-runner-java',
    filename: 'Main.java',
    compiled: true
  },
  python: {
    image: 'compilix-runner-python',
    filename: 'main.py',
    compiled: false
  },
  javascript: {
    image: 'compilix-runner-javascript',
    filename: 'main.js',
    compiled: false
  }
};

let activeExecutions = 0;
let lastDockerCheckTime = 0;
let lastDockerCheckResult = false;

/**
 * Check if the Docker engine is running and accessible
 */
export function isDockerAvailable() {
  const now = Date.now();
  if (now - lastDockerCheckTime < 10000) {
    return lastDockerCheckResult;
  }

  try {
    const res = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
      encoding: 'utf-8',
      timeout: 3000
    });
    lastDockerCheckResult = res.status === 0 && Boolean(res.stdout?.trim());
    lastDockerCheckTime = now;
    return lastDockerCheckResult;
  } catch {
    lastDockerCheckResult = false;
    lastDockerCheckTime = now;
    return false;
  }
}

/**
 * List the runner images that have been built locally
 */
export function getAvailableRunnerImages() {
  const available = [];
  for (const [lang, cfg] of Object.entries(RUNNER_CONFIG)) {
    try {
      const res = spawnSync('docker', ['image', 'inspect', cfg.image], {
        encoding: 'utf-8',
        timeout: 2000
      });
      if (res.status === 0) {
        available.push({ language: lang, image: cfg.image });
      }
    } catch {
      // Ignore inspect failure
    }
  }
  return available;
}

/**
 * Execute user-submitted code in an isolated Docker container
 */
export async function executeInDocker({ language, code, stdin = '', filename }) {
  if (!isDockerAvailable()) {
    throw new DockerUnavailableError(
      'Docker execution engine is currently offline or unreachable. Please verify the Docker daemon is running.'
    );
  }

  const runner = RUNNER_CONFIG[language];
  if (!runner) {
    throw new ExecutionError(`No runner configuration found for language "${language}".`, 'execution_error', 400);
  }

  if (activeExecutions >= config.MAX_CONCURRENT_EXECUTIONS) {
    throw new AppError(
      'Server is executing the maximum allowed concurrent runs. Please wait a moment and retry.',
      429,
      'CONCURRENCY_LIMIT_REACHED'
    );
  }

  activeExecutions++;

  const runId = crypto.randomUUID();
  const runDir = path.join(tempBaseDir, `run-${runId}`);
  const containerName = `compilix-${runId.slice(0, 12)}`;

  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let outputExceeded = false;
  let totalOutputBytes = 0;

  try {
    // 1. Create isolated temporary directory with world-writable permissions
    await fs.promises.mkdir(runDir, { recursive: true });
    try {
      await fs.promises.chmod(runDir, 0o777);
    } catch {
      // Ignore on filesystems where POSIX chmod is unsupported
    }

    // 2. Write source file and input file using specified or default filename
    const targetFilename = filename || runner.filename;
    const sourceFilePath = path.join(runDir, targetFilename);
    const inputFilePath = path.join(runDir, 'input.txt');

    await fs.promises.writeFile(sourceFilePath, code, 'utf-8');
    await fs.promises.writeFile(inputFilePath, stdin || '', 'utf-8');
    try {
      await fs.promises.chmod(sourceFilePath, 0o666);
      await fs.promises.chmod(inputFilePath, 0o666);
    } catch {
      // Ignore
    }

    // 3. Build Docker run arguments
    const dockerArgs = [
      'run',
      '--rm',
      '--name', containerName,
      '--network', 'none',
      '--cpus', String(config.DOCKER_CPU_LIMIT),
      '--memory', String(config.DOCKER_MEMORY_LIMIT),
      '--memory-swap', String(config.DOCKER_MEMORY_LIMIT),
      '--pids-limit', String(config.DOCKER_PIDS_LIMIT),
      '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges',
      '-e', `ENTRY_FILE=${targetFilename}`,
      '-v', `${runDir}:/workspace`,
      runner.image
    ];

    const startTime = Date.now();

    // 4. Spawn container process
    const result = await new Promise((resolve, reject) => {
      const child = spawn('docker', dockerArgs, {
        windowsHide: true
      });

      // Timeout watchdog
      const timer = setTimeout(() => {
        timedOut = true;
        // Forcibly remove container on timeout
        spawnSync('docker', ['rm', '-f', containerName], { windowsHide: true });
        child.kill('SIGKILL');
      }, config.EXECUTION_TIMEOUT_MS);

      // Collect stdout with output size cap
      child.stdout.on('data', (chunk) => {
        totalOutputBytes += chunk.length;
        if (totalOutputBytes > config.MAX_OUTPUT_SIZE_BYTES) {
          outputExceeded = true;
          spawnSync('docker', ['rm', '-f', containerName], { windowsHide: true });
          child.kill('SIGKILL');
          return;
        }
        stdout += chunk.toString('utf-8');
      });

      // Collect stderr with output size cap
      child.stderr.on('data', (chunk) => {
        totalOutputBytes += chunk.length;
        if (totalOutputBytes > config.MAX_OUTPUT_SIZE_BYTES) {
          outputExceeded = true;
          spawnSync('docker', ['rm', '-f', containerName], { windowsHide: true });
          child.kill('SIGKILL');
          return;
        }
        stderr += chunk.toString('utf-8');
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        const executionTimeMs = Date.now() - startTime;
        resolve({
          exitCode: code ?? (signal ? 128 : 1),
          executionTimeMs
        });
      });
    });

    // 5. Determine execution status accurately
    let status = 'success';
    let isSuccess = true;

    if (timedOut) {
      status = 'time_limit_exceeded';
      isSuccess = false;
      stderr = `Execution timed out after ${config.EXECUTION_TIMEOUT_MS}ms. Process terminated.`;
    } else if (outputExceeded) {
      status = 'output_limit_exceeded';
      isSuccess = false;
      stderr = `Output limit exceeded (maximum ${config.MAX_OUTPUT_SIZE_BYTES} bytes). Process terminated.`;
    } else if (result.exitCode === 42) {
      // Exit code 42 is returned by runner scripts when compilation fails (C++, Java)
      status = 'compilation_error';
      isSuccess = false;
    } else if (result.exitCode !== 0) {
      // Categorize syntax/compilation errors vs runtime errors for interpreted languages
      if (
        (language === 'python' && /(SyntaxError:|IndentationError:|TabError:)/.test(stderr)) ||
        (language === 'javascript' && /(SyntaxError:)/.test(stderr))
      ) {
        status = 'compilation_error';
      } else {
        status = 'runtime_error';
        if (result.exitCode > 128 && !stderr.trim()) {
          const sig = result.exitCode - 128;
          const sigDesc = SIGNAL_NAMES[sig] || `Signal ${sig}`;
          stderr = `Runtime Error: Process terminated by signal ${sig} (${sigDesc}). Exit code: ${result.exitCode}.`;
        }
      }
      isSuccess = false;
    }

    return {
      success: isSuccess,
      language,
      stdout,
      stderr,
      exitCode: result.exitCode,
      executionTimeMs: result.executionTimeMs,
      status
    };
  } finally {
    activeExecutions--;

    // Defensive cleanup of container if still active
    try {
      spawnSync('docker', ['rm', '-f', containerName], { windowsHide: true });
    } catch {
      // Ignore cleanup error
    }

    // Clean up temporary execution directory
    try {
      await fs.promises.rm(runDir, { recursive: true, force: true });
    } catch {
      // Ignore temp dir cleanup error
    }
  }
}
