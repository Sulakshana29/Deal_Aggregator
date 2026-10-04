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
| 7 | Refactor CI into parallel jobs | ⏳ Pending |
| 8 | Move to Kubernetes (EKS / Minikube) | ⏳ Pending |

## DevSecOps Features

### 🔄 CI/CD Pipeline (GitHub Actions)
The project utilizes a monolithic but event-driven CI/CD pipeline:
1. **Continuous Integration (CI):** On every Pull Request or Push, the code is Linted, Tested, and Docker Images are built.
2. **Security Scanning:** Images are scanned using **Trivy** to block Critical/High vulnerabilities.
3. **Continuous Deployment (CD):** On pushes to the `main` branch, images are pushed to Docker Hub, and GitHub Actions securely deploys them to the AWS EC2 instance.
4. **Automated Scraper:** A separate GitHub Actions Cron workflow triggers the scraper container on the EC2 instance every 12 hours.

### 📊 Monitoring & Logging
The production stack spins up a full observability suite:
- **Prometheus**: Scrapes metrics from the Node.js API (via `prom-client`) and **cAdvisor** (Docker container hardware metrics).
- **Grafana**: Visualizes metrics on port `3001`.
- **Loki & Promtail**: Promtail reads raw Docker socket logs and ships them to Loki for centralized log querying in Grafana.

### 🛡️ Security Hardening
- **Network Isolation:** MongoDB is NOT exposed to the internet; it is only accessible within the internal Docker network.
- **Database Auth:** MongoDB requires username/password authentication.
- **Rate Limiting:** Express API utilizes `express-rate-limit` to prevent DDoS/spam on write endpoints.

## Running Locally

### Option A — Docker Compose (recommended)
```bash
# Start all 3 tiers
docker compose up --build

# Run scraper once (separate profile)
docker compose --profile scraper run --rm scraper

# Seed dev data instead
docker compose exec backend node seed.js
```

Visit: http://localhost:3000 (UI) | http://localhost:5000/health (API health)

### Option B — Bare Metal
```bash
# Terminal 1 — Backend
cd backend && npm install && npm start

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev

# Terminal 3 — Scraper (one-shot)
cd scraper && npm install && node scrape.js
```
Requires a local MongoDB instance on port 27017.

### Option C — Kubernetes (Phase 8)
```bash
minikube start
kubectl apply -f k8s/
minikube service deal-aggregator-frontend -n deal-aggregator
```

---

*Full documentation will be added in Phase 7.*
