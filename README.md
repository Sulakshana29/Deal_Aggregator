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
| 4 | CD Pipeline to EC2 (Automated deployment on push) | ⏳ Pending |
| 5 | Monitoring (Prometheus + Grafana) | ⏳ Pending |
| 6 | Logging (Loki or ELK Stack) | ⏳ Pending |
| 7 | Refactor CI into multiple jobs for efficiency | ⏳ Pending |
| 8 | Move to Kubernetes (Deployments, Services, ConfigMaps, CronJob) | ⏳ Pending |

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
