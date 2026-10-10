# Deal Aggregator

> A portfolio-grade **DevSecOps** project demonstrating Docker, Kubernetes, CI/CD, and security engineering.
> Scrapes live Sri Lankan bank card promotions from [mypromo.lk](https://mypromo.lk) into a 3-tier web app.

**Status**: 🚧 Work in progress — building through 7 phases.

## Architecture

```
[React + Vite]  ──nginx proxy──>  [Express API]  ──mongoose──>  [MongoDB]
   (Nginx:80)                       (Node:5000)                  (Port 27017)
       ▲                                 ▲
       |                        [Scraper CronJob]
   Browser                       (axios + cheerio)
```

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Finish the core application (React + Express + MongoDB) | ✅ Done |
| 2 | Get Docker Compose working (multi-stage builds) | ✅ Done |
| 3 | CI Pipeline (GitHub Actions, Linting, Testing, Trivy, Docker Hub) | ✅ Done |
| 4 | CD Pipeline to EC2 + Scheduled Scraper Cron | ✅ Done |
| 5 | Monitoring (Prometheus + Grafana + cAdvisor) | ✅ Done |
| 6 | Logging (Loki + Promtail) | ✅ Done |
| 7 | Kubernetes — A: App & container hardening ([notes](docs/hardening/phase-a.md)) | ✅ Done |
| 7 | Kubernetes — B: K8s hardening (StatefulSet, NetworkPolicies, PSA, Ingress, HPA) | ⏳ Pending |
| 8 | CI/CD upgrade (parallel jobs, blocking scans, SAST, SBOM, signing) | ⏳ Pending |
| 9 | GitOps (Argo CD) + in-cluster observability | ⏳ Pending |

## DevSecOps Features

### 🔄 CI/CD Pipeline (GitHub Actions)
The project utilizes a monolithic but event-driven CI/CD pipeline:
1. **Continuous Integration (CI):** On every Pull Request or Push, the code is Linted, Tested, and Docker Images are built.
2. **Security Scanning:** Images are scanned using **Trivy** for Critical/High vulnerabilities (currently report-only — becomes a blocking gate in the CI/CD upgrade phase).
3. **Continuous Deployment (CD):** On pushes to the `main` branch, images are pushed to Docker Hub, and GitHub Actions securely deploys them to the AWS EC2 instance.
4. **Automated Scraper:** A separate GitHub Actions Cron workflow triggers the scraper container on the EC2 instance every 12 hours.

### 📊 Monitoring & Logging
The production stack spins up a full observability suite:
- **Prometheus**: Scrapes metrics from the Node.js API (via `prom-client`) and **cAdvisor** (Docker container hardware metrics).
- **Grafana**: Visualizes metrics on port `3001`.
- **Loki & Promtail**: Promtail reads raw Docker socket logs and ships them to Loki for centralized log querying in Grafana.

### 🛡️ Security Hardening
Full rationale for each control: [docs/hardening/phase-a.md](docs/hardening/phase-a.md).
- **Read-only public API:** No write/delete endpoints are exposed — only the scraper and seed script write to MongoDB, over the internal network.
- **Injection protection:** User input is regex-escaped (prevents ReDoS) and non-string query params are rejected (prevents NoSQL operator injection).
- **Rate Limiting:** `express-rate-limit` per real client IP (`trust proxy` + `X-Forwarded-For` from nginx).
- **Security headers:** `helmet` on the API; CSP, `X-Frame-Options`, `nosniff` and `server_tokens off` on nginx.
- **Non-root containers:** backend/scraper run as `node`, frontend uses `nginx-unprivileged` on port 8080.
- **Reproducible images:** `npm ci` from lockfiles, pinned base/service image versions, dev files excluded via `.dockerignore`.
- **Database Auth:** MongoDB runs with root credentials from a git-ignored `.env` (compose refuses to start without them).
- **Minimal network exposure (prod):** only port 80 is public. Backend, MongoDB, Prometheus, Loki and cAdvisor are internal-only; Grafana is bound to `127.0.0.1` (SSH tunnel); `/api/metrics` is blocked at nginx.
- **Graceful shutdown & health:** SIGTERM drains connections; `/health` (liveness) vs `/ready` (readiness, checks MongoDB).

## Running Locally

### Option A — Docker Compose (recommended)
```bash
# Create local credentials (MongoDB auth is required)
cp .env.example .env

# Start all 3 tiers
docker compose up --build

# Run scraper once (separate profile)
docker compose --profile scraper run --rm scraper

# Seed dev data instead
docker compose exec backend node seed.js
```

Visit: http://localhost:3000 (UI) | http://localhost:3000/api/health (liveness) | http://localhost:3000/api/ready (readiness)

### Option B — Bare Metal
```bash
# Terminal 1 — Backend
cd backend && npm install && npm start

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev

# Terminal 3 — Scraper (one-shot)
cd scraper && npm install && node scrape.js
```
Requires a MongoDB instance on port 27017 (e.g. `docker compose up mongodb`) and a `.env` in `backend/` and `scraper/` copied from their `.env.example`.

### Option C — Kubernetes (Phase 7)
```bash
minikube start
# Build images straight into Minikube's Docker daemon (manifests use imagePullPolicy: Never)
eval $(minikube docker-env)
docker build -t deal-aggregator-backend:latest  ./backend
docker build -t deal-aggregator-frontend:latest ./frontend
docker build -t deal-aggregator-scraper:latest  ./scraper
kubectl apply -k k8s/
minikube service deal-aggregator-frontend -n deal-aggregator
```

---

*Full documentation will be added in Phase 7.*
