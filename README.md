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
| 1 | Core App (React + Express + MongoDB) | ✅ Done |
| 2 | Scraper (axios + cheerio → MongoDB upsert) | ✅ Done |
| 3 | Containerize (multi-stage Docker + Compose) | ✅ Done |
| 4 | Kubernetes (Minikube — Deployments, PVC, CronJob) | 🚧 In Progress |
| 5 | Security Hardening (Helmet, rate-limit, non-root, securityContext) | ⏳ Pending |
| 6 | CI/CD (GitHub Actions → GHCR → K8s) | ⏳ Pending |
| 7 | README & Polish (architecture diagram, Helm chart) | ⏳ Pending |

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

### Option C — Kubernetes (Phase 4)
```bash
minikube start
kubectl apply -f k8s/
minikube service deal-aggregator-frontend -n deal-aggregator
```

---

*Full documentation will be added in Phase 7.*
