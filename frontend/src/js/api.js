/**
 * API Client for Compilix Backend
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error(`Health check returned status ${res.status}`);
    return await res.json();
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
    return await res.json();
  } catch (error) {
    console.warn('Could not fetch language templates from backend. Using local defaults.', error);
    return null;
  }
}

export async function executeCode({ language, code, stdin }) {
  try {
    const res = await fetch(`${API_BASE}/api/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ language, code, stdin })
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        status: data.error?.code === 'EXECUTION_RATE_LIMIT_EXCEEDED' ? 'rate_limited' : 'execution_error',
        stdout: '',
        stderr: data.error?.message || `Execution request failed with status ${res.status}`,
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
