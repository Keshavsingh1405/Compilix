/**
 * API Client for Compilix Backend
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error(`Health check returned status ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : { status: 'offline' };
  } catch (error) {
    return {
      status: 'offline',
      service: 'compilix-api',
      executionEngine: { dockerAvailable: false, status: 'offline' },
      error: error.message
    };
  }
}

export async function fetchLanguages() {
  try {
    const res = await fetch(`${API_BASE}/api/languages`);
    if (!res.ok) throw new Error(`Languages request returned status ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.warn('Could not fetch language templates from backend. Using local defaults.', error);
    return null;
  }
}

export async function executeCode({ language, code, stdin, filename }) {
  try {
    const res = await fetch(`${API_BASE}/api/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ language, code, stdin, filename })
    });

    const responseText = await res.text();
    let data = null;

    if (responseText && responseText.trim().length > 0) {
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.warn('Failed to parse API response as JSON:', parseErr, responseText);
      }
    }

    if (!res.ok) {
      const errorMessage =
        data?.error?.message ||
        (responseText && responseText.length < 500
          ? responseText
          : `Execution request failed with HTTP ${res.status} ${res.statusText || ''}`.trim());

      return {
        success: false,
        status: data?.error?.code === 'EXECUTION_RATE_LIMIT_EXCEEDED' ? 'rate_limited' : 'execution_error',
        stdout: '',
        stderr: errorMessage,
        exitCode: 1,
        executionTimeMs: 0
      };
    }

    if (!data) {
      return {
        success: false,
        status: 'execution_error',
        stdout: '',
        stderr: `Server returned an empty or unparseable response (HTTP ${res.status}).`,
        exitCode: 1,
        executionTimeMs: 0
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      status: 'network_error',
      stdout: '',
      stderr: `Network or Connection Error: Unable to reach Compilix API at ${API_BASE || 'localhost:5000'}.\nDetails: ${error.message}`,
      exitCode: 1,
      executionTimeMs: 0
    };
  }
}
