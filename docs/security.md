# Compilix — Security Architecture & Threat Model

Online code execution platforms execute arbitrary, untrusted code supplied by anonymous or untrusted users. In **Compilix**, security is treated as a foundational design requirement rather than an afterthought.

---

## 1. Threat Model & Attack Vectors

| Attack Vector | Malicious Intent / Mechanism | Compilix Defense Strategy |
| :--- | :--- | :--- |
| **Fork Bombs / Thread Flooding** | Submitting recursive processes (`:(){ :\|:& };:`, `while True: fork()`) to freeze the host OS. | Enforced container `--pids-limit 64`. Limits maximum threads and child processes; attempts to fork beyond 64 fail immediately. |
| **Infinite Loops / CPU Starvation** | Submitting `while (true) {}` to saturate CPU cores and starve other tenants. | Hard wall-clock timeout (`EXECUTION_TIMEOUT_MS = 10000ms`). Backend watchdog automatically invokes `docker rm -f` upon expiration. |
| **Memory Exhaustion (OOM DOS)** | Allocating gigabytes of RAM in heap arrays to cause kernel out-of-memory panics. | Enforced `--memory 256m` and `--memory-swap 256m`. Container is terminated by kernel OOM-killer if limits are exceeded without affecting the host. |
| **Output Flooding (Buffer DOS)** | Generating infinite output (`while (1) puts("A");`) to exhaust server memory and crash Node.js. | Real-time byte accounting with `MAX_OUTPUT_SIZE_BYTES = 256 KB`. When output exceeds 256 KB, container is killed and `output_limit_exceeded` status is returned. |
| **Server-Side Request Forgery (SSRF) / Port Scanning** | Executing code that accesses `169.254.169.254` (cloud metadata), internal VPC databases, or botnet C2 servers. | Complete network isolation: `--network none`. Containers are created with no network interfaces (except loopback), completely blocking inbound and outbound packets. |
| **Host Filesystem Escalation** | Navigating `/proc`, `/sys`, or reading `/etc/shadow` or backend `.env` secrets. | Ephemeral directory volume mount: only the specific `temp/run-<uuid>` directory is mounted into `/workspace`. Backend environment variables and host filesystem paths are never mounted or passed. |
| **Command / Shell Injection** | Submitting code containing quotes or backticks to inject arbitrary host commands. | Safe child process argument passing (`child_process.spawn('docker', args)`). Code is written directly to disk via `fs.writeFile`, never concatenated or evaluated in a shell string. |
| **Privilege Escalation** | Attempting `sudo`, `setuid`, or exploiting SUID binaries inside runner images. | Non-root users (`runner` / `node` UID 1000). Every runner container enforces `--cap-drop ALL` and `--security-opt no-new-privileges`. |
| **API Denial of Service** | Flooding `/api/execute` with thousands of concurrent HTTP POST requests. | Multi-tier rate limiting (200 requests / 15m general API, 30 executions / 1m execution API) plus an internal concurrency semaphore (`MAX_CONCURRENT_EXECUTIONS = 5`). |

---

## 2. Implemented Defense-in-Depth Mechanisms

### Network Cutoff
All container executions specify `--network none`. Even if malicious code contains networking logic (e.g., Python `socket` or C++ `connect()`), network system calls immediately fail with `Network is unreachable`.

### Least Privilege Execution
Every runner container runs as an unprivileged user (UID `1000:1000`). Root login inside containers is disabled. All Linux capabilities (such as `CAP_SYS_ADMIN`, `CAP_NET_ADMIN`, `CAP_SYS_PTRACE`) are stripped using `--cap-drop ALL`.

### Ephemeral Lifecycle and Scoped Mounts
Each execution is assigned a cryptographically random UUID (`crypto.randomUUID()`). A temporary directory (`temp/run-<uuid>`) is created specifically for that execution, mounted at `/workspace`, and recursively deleted in a guaranteed `finally` block when execution finishes or times out.

### Strict Secret Hygiene
The backend server environment variables (database credentials, API keys, internal configs) are kept exclusively within the Express process memory. Runner containers receive **zero** host environment variables.

---

## 3. Sandboxing Limitations: Why Standard Docker is Not Bulletproof

While Docker containers provide significant isolation via Linux namespaces (`pid`, `net`, `ipc`, `mnt`, `uts`) and control groups (`cgroups`), **Docker containers share the host Linux kernel**.

```
+--------------------------------------------------------+
|  Untrusted User Program (C++, Java, Python, Node)      |
+--------------------------------------------------------+
       | (Linux System Calls: read, write, clone, mmap)
       v
+--------------------------------------------------------+
|  Host Linux Kernel (Shared across all containers & host)|
+--------------------------------------------------------+
```

### Potential Risks in Public Shared Environments
1. **Kernel Zero-Days**: If an attacker finds an unpatched vulnerability in the host Linux kernel (e.g. Dirty COW, CVE-2022-0847 Dirty Pipe, or io_uring vulnerabilities), they can theoretically compromise the host kernel.
2. **Side-Channel Attacks**: CPU microarchitectural flaws (Spectre, Meltdown, Downfall) could theoretically leak information between processes sharing the same physical CPU cores.
3. **Container Escapes via Docker Socket**: If an untrusted process gains access to `/var/run/docker.sock`, it can launch root-privileged containers and seize the host. Compilix ensures that runner containers **never** have access to the Docker socket.

---

## 4. Recommendations for Public High-Traffic Multi-Tenant Production

Before deploying Compilix to open, anonymous public traffic at scale, the following production hardening steps are recommended:

### 1. User-Space Syscall Emulation (gVisor)
Integrate Google's **gVisor** (`runsc`) as the default Docker runtime:
```bash
docker run --runtime=runsc ...
```
gVisor implements an independent user-space kernel (written in Go) that intercepts and virtualizes all Linux system calls. Even if user code exploits an open Linux kernel vulnerability, the host kernel remains untouched.

### 2. MicroVM Virtualization (AWS Firecracker / Kata Containers)
For enterprise-grade isolation, run each untrusted execution inside an ultra-lightweight MicroVM (such as **Firecracker** or **Kata Containers**). MicroVMs boot in less than 50 milliseconds using hardware-assisted KVM virtualization, providing true hardware boundary isolation between executions.

### 3. Custom Seccomp Profiles
Deploy explicit Seccomp BPF filters restricting the system call whitelist to only the ~50 safe system calls required by GCC, OpenJDK, Python, and Node.js.

### 4. Ephemeral Runner Nodes
Isolate the execution backend in an isolated private VPC subnet, and periodically cycle worker instances so that any lingering state is automatically destroyed.
