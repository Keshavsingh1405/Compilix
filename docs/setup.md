# Compilix — Local Setup and Development Guide

Follow this guide to set up, build, test, and run **Compilix** on your local workstation.

---

## 1. Prerequisites

Before starting, ensure you have the following installed:

| Tool | Minimum Version | Verification Command |
| :--- | :--- | :--- |
| **Node.js** | v18.0.0 or higher (v20+ recommended) | `node -v` |
| **npm** | v9.0.0 or higher | `npm -v` |
| **Docker Engine / Desktop** | v20.10+ (with daemon running) | `docker info` |
| **Git** | v2.25+ | `git --version` |

---

## 2. Quickstart (Under 5 Minutes)

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-org/Compilix.git
cd Compilix
```

### Step 2: Install Workspace Dependencies
Compilix uses npm workspaces to manage both frontend and backend packages with a single root lockfile:
```bash
npm install
```

### Step 3: Run the Diagnostic Environment Checker
Verify that Node, npm, and Docker are configured properly:
```bash
npm run check:env
```
If Docker is online, it will also check the status of your language runner images.

### Step 4: Build the Language Runner Docker Images
Build the four isolated runner images for C++, Java, Python, and JavaScript:
```bash
npm run build:runners
```
*(This downloads the lightweight base Alpine images and builds `compilix-runner-cpp`, `compilix-runner-java`, `compilix-runner-python`, and `compilix-runner-javascript`).*

### Step 5: Start Frontend and Backend Concurrently
Launch both the backend API server (port `5000`) and the Vite development server (port `5173`) in one command:
```bash
npm run dev
```

Open your browser to:
```
http://localhost:5173
```

---

## 3. Available NPM Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts backend on port 5000 and frontend on port 5173 with hot-reloading and API proxying. |
| `npm run dev:backend` | Starts only the Express backend with nodemon. |
| `npm run dev:frontend` | Starts only the Vite frontend dev server. |
| `npm run build` | Builds the production bundle for the frontend into `frontend/dist/`. |
| `npm run start` | Starts the backend server in production mode. |
| `npm run test` | Runs the backend unit and Docker integration tests. |
| `npm run lint` | Executes syntax and code quality checks. |
| `npm run build:runners` | Builds or rebuilds all 4 Docker runner images. |
| `npm run check:env` | Performs full diagnostic check of tools, Docker daemon, and runner images. |

---

## 4. Running Automated Tests

Run the test suite:
```bash
npm run test
```

The test runner will execute:
- Route tests (`/api/health`, `/api/languages`)
- Input validation tests (missing language, unsupported language, oversized code, malformed stdin)
- Error format consistency tests
- **Live Docker execution tests** (real compilation and execution for C++, Java, Python, and JavaScript with stdin and runtime exception handling)

---

## 5. Troubleshooting Common Issues

### Issue 1: "Docker Engine: Daemon is offline or inaccessible"
- **Cause**: Docker Desktop is not running or current user does not have permission to access Docker socket.
- **Fix**: Launch Docker Desktop. On Linux, ensure your user is added to the `docker` group (`sudo usermod -aG docker $USER`).

### Issue 2: "Runner image NOT built yet"
- **Cause**: The runner images have not been built locally yet.
- **Fix**: Run `npm run build:runners`.

### Issue 3: Port Conflict on 5000 or 5173
- **Cause**: Another service is using port 5000 or 5173.
- **Fix**: Update `PORT` in `.env` or set `PORT=5050` before starting.
