# Compilix — System Architecture

This document provides the complete system architecture for **Compilix**, a deployment-friendly online code compiler with a LeetCode-inspired user interface and sandboxed Docker container execution.

---

## 1. High-Level System Architecture

The following diagram illustrates the relationship between the client layer, API gateway layer, execution orchestration layer, and isolated container execution layer.

```mermaid
flowchart TD
    subgraph ClientLayer["Client Layer (Browser)"]
        UI["Compilix Interface (LeetCode-Inspired)"]
        Monaco["Monaco Editor (Local ESM Bundled)"]
        Buffers["Language Code Buffers (Memory & LocalStorage)"]
        Console["Console Panel (Stdin, Stdout, Stderr)"]
        
        UI <--> Monaco
        UI <--> Buffers
        UI <--> Console
    end

    subgraph SecurityBoundary["Trust Boundary (Public vs Private)"]
        direction TB
        Proxy["Reverse Proxy / Vite Proxy (/api/*)"]
    end

    subgraph ApiLayer["API Layer (Node.js & Express)"]
        Cors["CORS & Body Size Parser"]
        RateLimit["Rate Limiter (API & Execution Limits)"]
        Validator["Request Validator (Schema & Payload Size)"]
        Router["Express Router (/api/health, /api/languages, /api/execute)"]
        ErrorHandler["Centralized Error Middleware"]

        Cors --> RateLimit
        RateLimit --> Validator
        Validator --> Router
        Router -. Error .-> ErrorHandler
    end

    subgraph OrchestrationLayer["Execution Orchestration Layer"]
        ExecController["Execution Controller"]
        ExecService["Execution Orchestration Service"]
        DockerService["Docker Service (Concurrency, Timeouts, Mounts)"]
        TempManager["Ephemeral Workspace Manager (UUID Directories)"]

        ExecController --> ExecService
        ExecService --> DockerService
        DockerService --> TempManager
    end

    subgraph SandboxLayer["Isolated Docker Sandbox Layer"]
        subgraph Runners["Language Runner Containers (Non-Root, Network None, Read-Only Mounts)"]
            CppRunner["compilix-runner-cpp (GCC 14 / C++17)"]
            JavaRunner["compilix-runner-java (OpenJDK 21)"]
            PythonRunner["compilix-runner-python (Python 3.12)"]
            JsRunner["compilix-runner-javascript (Node.js 22)"]
        end
    end

    %% Connections
    Console -- "HTTP POST /api/execute" --> Proxy
    Proxy --> Cors
    Router --> ExecController

    DockerService -- "Spawn with Resource Limits" --> CppRunner
    DockerService -- "Spawn with Resource Limits" --> JavaRunner
    DockerService -- "Spawn with Resource Limits" --> PythonRunner
    DockerService -- "Spawn with Resource Limits" --> JsRunner

    TempManager -. "Mount Code & Stdin" .-> Runners
    Runners -- "Bounded Stdout / Stderr" --> DockerService
    DockerService --> ExecService
    ExecService --> ExecController
    ExecController -- "JSON Execution Result" --> Console
```

---

## 2. Code Execution Sequence Diagram

The sequence below details the complete lifecycle of an execution request from the moment the developer triggers the **Run** action until the parsed output is rendered.

```mermaid
sequenceDiagram
    autonumber
    actor User as Developer
    participant UI as Compilix Web UI
    participant Monaco as Monaco Editor
    participant API as Express API (/api/execute)
    participant Val as Request Validator
    participant Service as Execution Service
    participant Docker as Docker Service
    participant HostFS as Host Temp Filesystem
    participant Container as Docker Runner Container

    User->>UI: Clicks "Run Code" (or presses Ctrl+Enter)
    UI->>UI: Set loading state, disable Run button
    UI->>Monaco: Read active language code
    UI->>UI: Read custom stdin input
    UI->>API: POST /api/execute { language, code, stdin }
    
    API->>Val: Validate request payload (type, size, language)
    alt Validation Failed (e.g. Unsupported language or oversized code)
        Val-->>API: Throw ValidationError
        API-->>UI: HTTP 400 Bad Request { success: false, error: {...} }
        UI->>UI: Render error in Errors Tab & re-enable Run button
    end

    Val-->>API: Sanitized input
    API->>Service: executeCode({ language, code, stdin })
    Service->>Docker: executeInDocker({ language, code, stdin })
    
    Docker->>Docker: Check concurrency semaphore (Active < MAX)
    Docker->>HostFS: Create isolated directory (temp/run-<uuid>)
    Docker->>HostFS: Write source code file (e.g. main.cpp)
    Docker->>HostFS: Write stdin file (input.txt)
    
    Docker->>Container: docker run --rm --network none --cpus 1.0 --memory 256m ...
    Note over Docker,Container: Sandboxed execution with timeout watchdog
    
    alt Language Requires Compilation (C++, Java)
        Container->>Container: Compile source (g++ / javac)
        alt Compilation Fails
            Container-->>Docker: Exit Code 42 + Compilation Stderr
            Docker->>Docker: Classify as "compilation_error"
        end
    end

    Container->>Container: Execute program binary / script (< input.txt)
    Container-->>Docker: Stream bounded stdout & stderr
    Container-->>Docker: Process termination (Exit Code, Duration)
    
    Docker->>HostFS: Recursively delete temp/run-<uuid>
    Docker->>Docker: Release concurrency slot
    Docker-->>Service: Formatted result payload
    Service-->>API: Structured response
    API-->>UI: HTTP 200 OK { success, stdout, stderr, exitCode, executionTimeMs, status }
    
    UI->>UI: Reset loading state, re-enable Run button
    alt Success (status === "success")
        UI->>UI: Render stdout in Output Tab
    else Compilation or Runtime Error
        UI->>UI: Auto-switch to Errors Tab & display compiler/runtime trace
    end
```

---

## 3. Deployment Architecture

Compilix is architected for independent, production-grade deployment across static hosting and container infrastructure.

```mermaid
flowchart LR
    subgraph Internet["Public Internet"]
        Users["Client Browsers"]
    end

    subgraph CDN["Static Hosting / CDN"]
        StaticEdge["Static Edge / CDN (Cloudflare / Vercel / Nginx)"]
        SPA["Precompiled Static Assets (HTML, CSS, JS, Monaco Workers)"]
        StaticEdge --- SPA
    end

    subgraph BackendInfrastructure["Container-Capable Host / VM / Kubernetes"]
        subgraph EdgeIngress["Reverse Proxy & SSL Termination"]
            NginxIngress["Nginx / Traefik (HTTPS 443)"]
        end

        subgraph AppHost["Compilix API Instance"]
            NodeAPI["Node.js Express Server (Port 5000)"]
            TempBase["Ephemeral Disk Volume (/app/temp)"]
        end

        subgraph DockerHost["Container Engine"]
            Daemon["Docker Daemon (dockerd)"]
            Socket["/var/run/docker.sock (Restricted Access)"]
            
            subgraph CachedRunners["Pre-built Sandboxed Runner Images"]
                R_CPP["compilix-runner-cpp:latest"]
                R_JAVA["compilix-runner-java:latest"]
                R_PY["compilix-runner-python:latest"]
                R_JS["compilix-runner-javascript:latest"]
            end
        end
    end

    Users -- "HTTPS GET /*" --> StaticEdge
    Users -- "HTTPS POST /api/*" --> NginxIngress
    NginxIngress -- "Proxy Pass HTTP 5000" --> NodeAPI
    NodeAPI <--> TempBase
    NodeAPI -- "Docker CLI via Socket" --> Daemon
    Daemon --> Socket
    Daemon -. "Instantiates" .-> CachedRunners
```

---

## 4. Project Module Architecture

The following diagram maps application responsibilities to the actual physical repository files:

```mermaid
flowchart TD
    subgraph RepoRoot["Compilix Repository Root"]
        RootPkg["package.json (Workspaces, Concurrently, Dev Scripts)"]
        EnvExample[".env.example"]
        Compose["docker-compose.yml"]
        CI[".github/workflows/ci.yml"]
    end

    subgraph FrontendModule["frontend/ (Vite + Vanilla JS + Monaco)"]
        F_Entry["index.html"]
        F_Vite["vite.config.js (API Proxy & Worker Config)"]
        F_Styles["src/styles/ (variables, base, layout, components, responsive)"]
        F_App["src/js/app.js (Master Coordinator)"]
        F_Editor["src/js/editor.js (Monaco Web Workers & Buffers)"]
        F_IO["src/js/input-output.js (Console Tabs & Resizer)"]
        F_UI["src/js/ui.js (Modals, Indicators, Settings)"]
        F_API["src/js/api.js (REST Fetcher)"]
        F_Storage["src/js/storage.js (LocalStorage Persistence)"]
    end

    subgraph BackendModule["backend/ (Node.js + Express API)"]
        B_Server["src/server.js (Process Bootstrap & Shutdown)"]
        B_App["src/app.js (Express Middleware Pipeline)"]
        B_Config["src/config/env.js (Validated Environment)"]
        B_Routes["src/routes/ (health, languages, execution)"]
        B_Controllers["src/controllers/ (health, languages, execution)"]
        B_Validators["src/validators/execution.validator.js"]
        B_Middleware["src/middleware/ (error, rate-limit)"]
        B_DockerService["src/services/docker.service.js (Sandbox Manager)"]
        B_ExecService["src/services/execution.service.js"]
        B_Tests["tests/api.test.js (Unit & Docker Integration Tests)"]
    end

    subgraph DockerRunners["docker/runners/ (Pre-built Language Containers)"]
        D_Cpp["cpp/ (Dockerfile & run.sh)"]
        D_Java["java/ (Dockerfile & run.sh)"]
        D_Python["python/ (Dockerfile & run.sh)"]
        D_Js["javascript/ (Dockerfile & run.sh)"]
    end

    subgraph Scripts["scripts/"]
        S_Build["build-runners.js (Docker Image Builder)"]
        S_Check["check-environment.js (Environment & Health Diagnostics)"]
    end

    RepoRoot --> FrontendModule
    RepoRoot --> BackendModule
    RepoRoot --> DockerRunners
    RepoRoot --> Scripts
```

---

## 5. Architectural Summary & Component Responsibilities

### 1. Client Layer (Frontend)
- **Responsibility**: Provides the responsive, LeetCode-inspired workspace, hosts the Monaco Editor with language-specific syntax highlighting, manages independent code buffers in memory and `localStorage`, allows custom `stdin` specification, and formats execution stdout/stderr with real-time status badges.
- **Design Decisions**:
  - Built with Vanilla JavaScript and native Vite workers to avoid framework overhead while maintaining modularity.
  - Separate code buffers ensure developers never lose code when switching between C++, Java, Python, and JavaScript.
  - Relative API paths (`/api/*`) are proxied during development and served via reverse proxy in production.

### 2. API Gateway & Validation Layer (Backend)
- **Responsibility**: Serves as the public-facing entry point. Applies CORS policies, rate limiting, request body parsing limits, and strict schema validation.
- **Design Decisions**:
  - All input is sanitized and validated before reaching execution services.
  - Concurrency is throttled to prevent resource exhaustion attacks.
  - Distinguishes basic API uptime from execution engine readiness via `/api/health`.

### 3. Execution Orchestration Layer
- **Responsibility**: Allocates a unique ephemeral directory (`temp/run-<uuid>`), writes user source code and input files, coordinates Docker container lifecycles, enforces timeouts, captures bounded output streams, and cleans up temporary files and containers.
- **Design Decisions**:
  - Never passes untrusted code as shell arguments; file-based mounts ensure zero shell injection vulnerabilities.
  - Independent exit-code classification cleanly separates compilation errors (`status: compilation_error`) from runtime exceptions (`status: runtime_error`).

### 4. Sandboxed Execution Layer (Docker Runners)
- **Responsibility**: Executes untrusted user code in short-lived, isolated Linux containers.
- **Isolation Controls**:
  - `network: none`: Absolute network cutoff prevents outbound socket connections, SSRF, or malware downloads.
  - `user: 1000:1000`: Runs under unprivileged non-root users (`runner` / `node`).
  - `--cap-drop ALL` & `--security-opt no-new-privileges`: Strips all Linux kernel capabilities and prevents privilege escalation.
  - `--memory 256m --cpus 1.0 --pids-limit 64`: Enforces strict RAM, CPU, and fork bomb limits.
