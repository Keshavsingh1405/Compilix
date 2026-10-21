# Compilix — REST API Documentation

This document describes the REST API endpoints provided by the **Compilix** backend.

---

## Base URL

During local development:
```
http://localhost:5000/api
```

In production:
```
https://compilix.yourdomain.com/api
```

---

## 1. Health Check

### `GET /api/health`

Returns service health, uptime, and Docker execution engine readiness.

#### Response: `200 OK`
```json
{
  "status": "ok",
  "service": "compilix-api",
  "uptimeSeconds": 312,
  "timestamp": "2026-10-21T03:30:00.000Z",
  "executionEngine": {
    "dockerAvailable": true,
    "availableRunners": [
      { "language": "cpp", "image": "compilix-runner-cpp" },
      { "language": "java", "image": "compilix-runner-java" },
      { "language": "python", "image": "compilix-runner-python" },
      { "language": "javascript", "image": "compilix-runner-javascript" }
    ],
    "status": "ready"
  }
}
```

---

## 2. Supported Languages & Starter Code

### `GET /api/languages`

Returns the list of supported programming languages, compiler/runtime versions, filenames, and default starter code templates.

#### Response: `200 OK`
```json
{
  "success": true,
  "languages": [
    {
      "id": "cpp",
      "name": "C++",
      "version": "GCC (C++17)",
      "fileName": "main.cpp",
      "monacoLanguage": "cpp",
      "starterCode": "#include <iostream>\n\nint main() {\n    std::cout << \"Hello from C++ in Compilix!\" << std::endl;\n    return 0;\n}\n"
    },
    {
      "id": "java",
      "name": "Java",
      "version": "OpenJDK 21",
      "fileName": "Main.java",
      "monacoLanguage": "java",
      "starterCode": "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello from Java in Compilix!\");\n    }\n}\n"
    },
    {
      "id": "python",
      "name": "Python",
      "version": "Python 3.12",
      "fileName": "main.py",
      "monacoLanguage": "python",
      "starterCode": "def main():\n    print(\"Hello from Python in Compilix!\")\n\nif __name__ == \"__main__\":\n    main()\n"
    },
    {
      "id": "javascript",
      "name": "JavaScript",
      "version": "Node.js 22",
      "fileName": "main.js",
      "monacoLanguage": "javascript",
      "starterCode": "function main() {\n    console.log(\"Hello from JavaScript in Compilix!\");\n}\n\nmain();\n"
    }
  ]
}
```

---

## 3. Execute Code

### `POST /api/execute`

Submits source code and optional standard input for sandboxed execution in an isolated Docker container.

#### Rate Limits:
- 30 requests per minute per IP address.

#### Request Headers:
- `Content-Type: application/json`

#### Request Body:
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `language` | String | **Yes** | One of `cpp`, `java`, `python`, `javascript`. |
| `code` | String | **Yes** | The source code to execute (maximum 64 KB). Cannot be empty. |
| `stdin` | String | No | Custom standard input passed to the program (maximum 64 KB). Default is `""`. |

#### Example Request:
```json
{
  "language": "python",
  "code": "import sys\nname = sys.stdin.read().strip()\nprint(f'Hello, {name}!')",
  "stdin": "Compilix"
}
```

#### Successful Execution Response (`200 OK`):
```json
{
  "success": true,
  "language": "python",
  "stdout": "Hello, Compilix!\n",
  "stderr": "",
  "exitCode": 0,
  "executionTimeMs": 245,
  "status": "success"
}
```

#### Compilation Error Response (`200 OK`):
```json
{
  "success": false,
  "language": "cpp",
  "stdout": "",
  "stderr": "main.cpp:3:5: error: 'syntax' was not declared in this scope\n",
  "exitCode": 42,
  "executionTimeMs": 412,
  "status": "compilation_error"
}
```

#### Runtime Error Response (`200 OK`):
```json
{
  "success": false,
  "language": "python",
  "stdout": "",
  "stderr": "Traceback (most recent call last):\n  File \"/workspace/main.py\", line 1, in <module>\n    1 / 0\nZeroDivisionError: division by zero\n",
  "exitCode": 1,
  "executionTimeMs": 190,
  "status": "runtime_error"
}
```

#### Timeout Response (`200 OK`):
```json
{
  "success": false,
  "language": "cpp",
  "stdout": "",
  "stderr": "Execution timed out after 10000ms. Process terminated.",
  "exitCode": 128,
  "executionTimeMs": 10005,
  "status": "time_limit_exceeded"
}
```

#### Output Limit Exceeded Response (`200 OK`):
```json
{
  "success": false,
  "language": "javascript",
  "stdout": "",
  "stderr": "Output limit exceeded (maximum 262144 bytes). Process terminated.",
  "exitCode": 1,
  "executionTimeMs": 850,
  "status": "output_limit_exceeded"
}
```

---

## 4. Error Responses

All API errors return a standardized JSON structure:

```json
{
  "success": false,
  "error": {
    "message": "Field \"language\" is required and must be a string.",
    "code": "VALIDATION_ERROR"
  }
}
```

### Common HTTP Status Codes

| Status Code | Code String | Meaning |
| :--- | :--- | :--- |
| `400 Bad Request` | `VALIDATION_ERROR` | Missing or invalid field in request body. |
| `404 Not Found` | `NOT_FOUND` | The requested endpoint does not exist. |
| `413 Payload Too Large` | `PAYLOAD_TOO_LARGE` | Request body exceeds maximum JSON payload size. |
| `429 Too Many Requests` | `RATE_LIMIT_EXCEEDED` / `CONCURRENCY_LIMIT_REACHED` | Rate limit exceeded or max concurrent executions reached. |
| `503 Service Unavailable`| `DOCKER_UNAVAILABLE` | Docker daemon is offline or unreachable on the server. |
| `500 Internal Error` | `INTERNAL_ERROR` | Unexpected server fault. |
