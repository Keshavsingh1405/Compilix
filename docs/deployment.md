# Compilix — Deployment Guide

This guide details the deployment topology, infrastructure requirements, configuration parameters, and step-by-step procedures for deploying **Compilix** in staging and production environments.

---

## 1. Deployment Topology & Infrastructure Requirements

Compilix consists of two core deployable tiers:

| Component | Nature | Recommended Infrastructure | Notes |
| :--- | :--- | :--- | :--- |
| **Frontend** | Static Single-Page App (SPA) | Nginx, Cloudflare Pages, AWS S3 + CloudFront, Vercel | Completely decoupled from backend; communicates solely over HTTPS REST. |
| **Backend & Execution Sandbox** | Container-capable Node.js service | Linux VM (AWS EC2, GCP Compute Engine, DigitalOcean Droplet, Hetzner) or dedicated Kubernetes node | **Requires Docker engine access**. Cannot run on standard serverless runtimes (e.g. AWS Lambda, Vercel Serverless) due to Docker daemon requirements. |

> [!WARNING]
> **Docker Daemon Security**: The Docker daemon socket (`/var/run/docker.sock`) must **NEVER** be bound to public interfaces or exposed outside the host machine. Only the internal backend Express process should communicate with the local Docker daemon.

---

## 2. Environment Variables Specification

### Backend Configuration (`backend/.env` / Container Environment)

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Integer | `5000` | HTTP port on which the Express API server listens. |
| `NODE_ENV` | String | `development` | Set to `production` in production to silence stack traces and enable production optimizations. |
| `FRONTEND_ORIGIN` | String | `http://localhost:5173` | Allowed CORS origin. In production, set to your production domain (e.g. `https://compilix.yourdomain.com`). |
| `EXECUTION_TIMEOUT_MS` | Integer | `10000` | Wall-clock execution deadline in milliseconds before a container is killed (`time_limit_exceeded`). |
| `MAX_CODE_SIZE_BYTES` | Integer | `65536` | Maximum size of submitted source code in bytes (64 KB). |
| `MAX_STDIN_SIZE_BYTES` | Integer | `65536` | Maximum size of custom standard input in bytes (64 KB). |
| `MAX_OUTPUT_SIZE_BYTES` | Integer | `262144` | Maximum combined stdout/stderr capture buffer in bytes (256 KB) before aborting (`output_limit_exceeded`). |
| `MAX_CONCURRENT_EXECUTIONS` | Integer | `5` | Maximum simultaneous Docker runner containers allowed to execute before returning HTTP 429. |
| `DOCKER_CPU_LIMIT` | String | `1.0` | Container CPU constraint passed to `docker run --cpus`. |
| `DOCKER_MEMORY_LIMIT` | String | `256m` | Container RAM limit passed to `docker run --memory` and `--memory-swap`. |
| `DOCKER_PIDS_LIMIT` | Integer | `64` | Container maximum process / thread limit (`--pids-limit`) to prevent fork bombs. |

### Frontend Configuration (`frontend/.env`)

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | String | `""` (empty) | Base URL for backend API requests. Leave blank to use relative paths (`/api/*`) behind a reverse proxy. |
| `VITE_BACKEND_TARGET` | String | `http://localhost:5000` | Target URL used by Vite's development proxy to forward `/api` requests to Express. |

---

## 3. Step-by-Step Production Deployment

### Step 1: Provision the Host Server
Provision a Linux server (Ubuntu 22.04 LTS or Debian 12 recommended) with at least:
- 2 vCPUs
- 4 GB RAM
- 20 GB SSD storage
- Docker Engine & Docker Compose installed

### Step 2: Build the Sandboxed Runner Images
On the host machine, clone the repository and build the four isolated runner images:
```bash
git clone https://github.com/your-org/Compilix.git
cd Compilix
npm ci
npm run build:runners
```

Verify that the runner images are registered:
```bash
docker images | grep compilix-runner
```
Output should contain:
- `compilix-runner-cpp`
- `compilix-runner-java`
- `compilix-runner-python`
- `compilix-runner-javascript`

### Step 3: Deploy with Docker Compose
For unified containerized deployment, use the root `docker-compose.yml`:
```bash
docker compose up -d --build
```
This starts:
- `compilix-backend` on port `5000` with the host Docker socket mounted for runner execution.
- `compilix-frontend` served through Nginx on port `3000`.

### Step 4: Configure HTTPS and Reverse Proxy (Nginx)
Configure Nginx or Caddy on the host as the public entry point with SSL certificates (Let's Encrypt):

```nginx
# /etc/nginx/sites-available/compilix.conf
server {
    listen 80;
    server_name compilix.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name compilix.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/compilix.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/compilix.yourdomain.com/privkey.pem;

    # Frontend Static UI
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API Endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
    }
}
```

---

## 4. Health Checks and Monitoring

Compilix provides a health endpoint designed for load balancer probes:

```bash
curl -s http://localhost:5000/api/health | jq
```

Response:
```json
{
  "status": "ok",
  "service": "compilix-api",
  "uptimeSeconds": 1420,
  "timestamp": "2026-10-21T03:20:00.000Z",
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

If `dockerAvailable` is `false`, the health probe signals degraded operation, alerting operators that code execution is temporarily stalled while the API remains reachable.
