# DealVault — DevSecOps Portfolio & Wallet-First Card Recommender

[![CI/CD Pipeline](https://github.com/Sulakshana29/deal-aggregator/actions/workflows/ci.yml/badge.svg)](https://github.com/Sulakshana29/deal-aggregator/actions/workflows/ci.yml)
[![Docker](https://img.shields.io/badge/Docker-Multi--stage%20Builds-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Security](https://img.shields.io/badge/Security-Aqua%20Trivy%20Scanned-002B49?logo=aquasecurity&logoColor=white)](.github/workflows/ci.yml)
[![Monitoring](https://img.shields.io/badge/Observability-Prometheus%20%2B%20Grafana-F46800?logo=prometheus&logoColor=white)](prometheus/prometheus.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **"Which of my cards saves me the most at checkout today?"**  
> DealVault is a production-grade **DevSecOps portfolio platform** that personalizes, ranks, and safeguards live Sri Lankan bank card discounts and payment plans. It combines domain-driven product logic with industrial-grade resilience: automated **Trivy** container vulnerability scanning, an automated **Scraping Drift Guard**, **Prometheus/Grafana** observability, and **$0 cloud cost** deployment engineering.

---

## 🎯 The Problem & Product Pitch

In Sri Lanka, retail promotions are fragmented across dozens of banks (Commercial Bank, Sampath, HNB, Seylan, etc.), making it nearly impossible for shoppers to know which card to swipe at checkout.

Unlike plain scraper clones that just dump static lists of offers, **DealVault is wallet-first and personalized**:
- 💳 **Zero-PII Card Wallet:** Users select their banks (credit/debit) stored 100% client-side in `localStorage` — zero accounts, zero passwords, zero tracking.
- ⚡ **Smart Checkout Calculator:** Enter a shop (e.g. *Keells Super*, *Glomark*) and bill amount (e.g. *Rs. 8,000*) to get instantly ranked results showing exact rupee savings, spend thresholds, and discount caps.
- 🕒 **Sri Lanka Time-Aware:** Deals automatically filter by active weekday in `Asia/Colombo` time (UTC+05:30).

---

## 🏗️ System Architecture & Data Flow

<p align="center">
  <img src="docs/architecture.png" alt="DealVault Architecture & Data Flow" width="100%" />
</p>

<details>
<summary><b>Click to expand raw text Mermaid diagram</b></summary>

```mermaid
flowchart TB
    subgraph ClientTier ["Client Tier (Browser)"]
        Browser["User Browser"]
        WalletStore[("Local Wallet Storage<br/>(Zero PII · 100% Client-Side)")]
        Browser <--> WalletStore
    end

    subgraph AppTier ["Application Tier (Docker Containers)"]
        Frontend["Frontend (Nginx Unprivileged :8080)<br/>React 19 · Vite · Vanilla CSS Design System"]
        Backend["Backend API (Node.js 24 :5000)<br/>Express · Helmet · Rate-Limiting"]
        SavingsEngine["Pure Savings Engine<br/>Rupee Optimization · Caps · Thresholds"]
        
        Browser -->|"HTTP / HTTPS (Port 80/443)"| Frontend
        Frontend -->|"Reverse Proxy /api"| Backend
        Backend --> SavingsEngine
    end

    subgraph IngestionTier ["Ingestion & Reliability Tier"]
        Scraper["Scraper CronJob (Node 24)<br/>Scheduled Every 12 Hours"]
        DriftGuard{"Drift Guard<br/>Offers Drop > 50%?"}
        HashEngine["SHA-256 Content Hasher<br/>Real Change Tracking"]
        SourceSite[("mypromo.lk<br/>(Upstream Promotions)")]
        
        Scraper -->|"Polite HTTP with Exponential Backoff"| SourceSite
        Scraper --> DriftGuard
        DriftGuard -->|"No (Healthy Scrape)"| HashEngine
        DriftGuard -->|"Yes (Layout Drift)"| DegradedAlert["Mark Run Degraded<br/>Halt Deal Deactivation"]
    end

    subgraph DataTier ["Data Tier"]
        MongoDB[("MongoDB 9.0 (Port 27017)<br/>Auth Required · Localhost Bound")]
        DealsColl[("deals collection<br/>(contentHash, firstSeenAt, validUntil)")]
        RunsColl[("scrape_runs collection<br/>(Audit Execution History)")]
        
        HashEngine -->|"Upsert Active Deals"| DealsColl
        Scraper -->|"Log Execution Metrics"| RunsColl
        Backend -->|"Read-Only Queries"| DealsColl
        Backend -->|"Read Status"| RunsColl
        MongoDB --- DealsColl
        MongoDB --- RunsColl
    end

    subgraph ObservabilityTier ["Observability & Metrics"]
        Prometheus["Prometheus (:9090)<br/>API Latency + Scraper Gauges"]
        Grafana["Grafana (:3001)<br/>Dashboards & Visualization"]
        cAdvisor["cAdvisor (:8081)<br/>Container Hardware Metrics"]
        
        Prometheus -->|"Scrapes /metrics"| Backend
        Prometheus -->|"Scrapes Docker Stats"| cAdvisor
        Grafana -->|"Data Source Query"| Prometheus
    end
```

</details>

---

## 🛡️ DevSecOps Engineering & Security Controls

DealVault demonstrates defense-in-depth across the application, container, and infrastructure layers:

### 1. Shift-Left Security ("Sec")
- **Container Vulnerability Scanning:** Every pull request and push runs **Aqua Trivy** in GitHub Actions, scanning OS packages and application dependencies for `CRITICAL` and `HIGH` CVEs.
- **Rootless Containers:** Containers run as unprivileged users (`node:node` in backend/scraper; `nginx-unprivileged:1.27-alpine` on port `8080` in frontend).
- **Strictly Read-Only Public API:** The public API exposes zero `POST`, `PUT`, or `DELETE` endpoints. Database writes are restricted to internal Docker network services.
- **Injection Hardening:** All user inputs are regex-escaped to prevent **ReDoS** attacks; non-string query parameters are strictly validated to prevent **NoSQL Operator Injection**.
- **Security Headers & Rate Limiting:** Hardened with `helmet` and `express-rate-limit` per true client IP (`trust proxy` configured for reverse proxies).

### 2. Scraping Reliability & The Drift Guard
Web scrapers commonly break silently when third-party website HTML layouts change, causing naive cron jobs to wipe out databases. DealVault implements a multi-layer defense:

```mermaid
sequenceDiagram
    autonumber
    participant Scraper as Scraper Cron
    participant Source as mypromo.lk
    participant Guard as Drift Guard
    participant DB as MongoDB
    
    Scraper->>Source: Scrape 11 category pages (polite rate limits)
    Source-->>Scraper: Return HTML cards
    Scraper->>Guard: Compare found count (N) with last healthy run (H)
    alt N < 0.5 * H (Layout Shift Detected)
        Guard-->>Scraper: DRIFT DETECTED (Alert & Skip Deactivation)
        Scraper->>DB: Log scrape_runs (status: degraded)
        Note over DB: Existing catalog protected! Zero deals lost.
    else N >= 0.5 * H (Healthy Scrape)
        Guard-->>Scraper: RUN HEALTHY
        Scraper->>DB: Upsert deals with SHA-256 contentHash
        Scraper->>DB: Deactivate vanished offers
        Scraper->>DB: Log scrape_runs (status: ok)
    end
```

- **SHA-256 Change Tracking:** Only real changes update `lastChangedAt`; routine re-scrapes update `lastSeenAt` without invalidating client caches.
- **Audit Logging:** Every run writes execution duration, pages ok, and counts to `scrape_runs`.
- **Public System Status:** Accessible at `/api/status` and displayed live on the frontend footer.

### 3. Observability & Monitoring ("Ops")
- **Prometheus Metrics:** Backend exports native metrics via `prom-client` at `/metrics`, including custom gauges (`scraper_last_run_timestamp_seconds`, `scraper_last_offers_found`, `scraper_last_status`).
- **Container Telemetry:** **cAdvisor** collects container CPU, memory, network, and disk I/O metrics.
- **Log Aggregation:** Docker socket logs are collected by **Promtail** and shipped to **Loki** for querying inside **Grafana**.
- **K8s Health Probes:** Separate `/health` (Liveness — process alive) and `/ready` (Readiness — MongoDB reachable) probe endpoints.

---

## 🔄 CI/CD Pipeline Architecture

```mermaid
flowchart LR
    Push["1. Push / PR<br/>main branch"] --> Quality["2. Code Quality<br/>Node 24 Tests & Lint<br/>(47 Backend + 10 Frontend)"]
    Quality --> BuildScan["3. Docker Buildx & Scan<br/>Multi-stage Build<br/>Trivy Vulnerability Scan"]
    BuildScan --> HubPush["4. Docker Hub Registry<br/>Push :latest & :sha tags"]
    HubPush --> Deploy["5. CD to EC2<br/>Fast SSH timeout (30s)<br/>continue-on-error: true ($0 Cost)"]
```

- **$0 Cloud Cost Awareness:** The deployment step includes `continue-on-error: true` and `workflow_dispatch:`. When the EC2 instance is stopped in AWS to save costs, the GitHub Actions pipeline stays **100% green**. When the instance is started, you can trigger deployment with 1 click from GitHub Actions or let it auto-pull on boot.

---

## 📋 Project Roadmap

| Phase | Description | Status |
|---|---|---|
| **Phase 0** | **Data Audit & Discovery:** Live catalog analysis across 11 pages (73 live offers, 100% bank coverage). Aligned K8s CronJob to 12h. | ✅ Done |
| **Phase 1** | **Wallet & Smart Recommender:** Pure savings engine (`savings.js`), rupee calculator, `localStorage` wallet modal, and unified feed filters. | ✅ Done |
| **Phase 2** | **Scraping Reliability & Drift Guard:** SHA-256 hashing, 50% drop safeguard, `ScrapeRun` audit logs, Prometheus gauges, and live status bar. | ✅ Done |
| **Phase 3** | **Portfolio Refresh:** Interactive architecture diagrams, comprehensive DevSecOps documentation, and interview write-ups. | ✅ Done |
| **Phase 4** | **Kubernetes Migration:** `k8s/base` + overlays with Kustomize, MongoDB StatefulSet, NetworkPolicies, PSA `restricted`, and KinD CI smoke test. | ⏳ Next |

---

## 🚀 Running Locally

### Prerequisites
- Docker & Docker Compose
- Node.js 24+ (if running bare metal)

### Option A — Full Stack via Docker Compose (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/Sulakshana29/deal-aggregator.git
cd deal-aggregator

# 2. Configure environment credentials
cp .env.example .env

# 3. Start services (Frontend, Backend, MongoDB, Prometheus, Grafana, cAdvisor)
docker compose up -d --build

# 4. Run the scraper once to populate live offers
docker compose --profile scraper run --rm scraper
```

- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **Backend Health:** [http://localhost:5000/health](http://localhost:5000/health)
- **System Status & Drift Guard:** [http://localhost:5000/status](http://localhost:5000/status)
- **Prometheus UI:** [http://localhost:9090](http://localhost:9090)
- **Grafana Dashboards:** [http://localhost:3001](http://localhost:3001)

### Option B — Run Test Suites Locally

```bash
# Backend unit & smoke tests (47 tests)
cd backend && npm test

# Frontend component & format tests (10 tests)
cd frontend && npm test

# Scraper regex & parser tests (11 tests)
cd scraper && npm test
```

---

## 💡 Key Architectural Trade-Offs

1. **Why `localStorage` instead of User Accounts & PostgreSQL?**  
   *Trade-off:* Avoids storing personal financial identifiers (PII), eliminates GDPR/privacy compliance overhead, requires 0 auth infrastructure, and delivers instantaneous offline performance.
2. **Why a Scraping Drift Guard instead of an automated queue (e.g. BullMQ / Redis)?**  
   *Trade-off:* For a 12-hour periodic scrape of 73 deals, running a Redis broker and queue workers adds operational overhead and cloud memory costs. The Drift Guard provides superior data safety at zero additional infrastructure complexity.
3. **Why KinD in GitHub Actions instead of AWS EKS?**  
   *Trade-off:* AWS EKS costs ~$73/month just for the control plane. KinD (Kubernetes-in-Docker) provides identical Kubernetes API compliance, manifest validation, and smoke testing inside GitHub Actions runners at **$0 cost**.

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
