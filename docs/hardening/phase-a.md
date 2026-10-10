# Phase A — Application & Container Hardening

**Goal:** make the app and its images secure *by themselves* before moving to Kubernetes.
Kubernetes controls such as `runAsNonRoot`, `readOnlyRootFilesystem` or readiness-based routing
only work if the containers already support them. Phase A also makes every security claim in the
README true.

| # | Area | Risk before | Control now |
|---|------|-------------|-------------|
| A1 | API surface | Anyone could `POST` / `DELETE` deals (wipe the DB) | Write routes removed — read-only API |
| A1 | Input handling | ReDoS + NoSQL operator injection via query params | Regex escaping, string-only params, length cap |
| A1 | Rate limiting | All users shared nginx's IP → one bucket | `trust proxy` + `X-Forwarded-For` |
| A1 | Headers | `X-Powered-By: Express`, no security headers | `helmet`, `x-powered-by` disabled |
| A1 | Health | Same endpoint for liveness and readiness | `/health` (liveness) vs `/ready` (DB check) |
| A1 | Shutdown | Rollouts cut off in-flight requests | SIGTERM handler drains, then exits |
| A1 | Logs | Full `MONGO_URI` (incl. password) logged → Loki | Only host/db name logged |
| A2 | UI | "Admin mode" toggle = no real access control | Removed together with the delete button |
| A3 | Images | Root user, `npm install` (non-reproducible) | `USER node` / `nginx-unprivileged`, `npm ci` |
| A4 | nginx | Version leaked, no CSP, `/metrics` public | `server_tokens off`, CSP + headers, `/api/metrics` → 404 |
| A5 | Database | **No auth** (README claimed otherwise) | Root user from `.env`, compose fails without it |
| A5 | Prod network | Backend, Prometheus, cAdvisor, Loki public; Grafana `admin`/`admin` | Only :80 public; Grafana on `127.0.0.1`, password required |
| A5 | Versions | `:latest` everywhere | Pinned (`mongo:9.0.2`, `prometheus:v3.15.0`, `grafana:13.2.3`, …) |

---

## A1 — Backend API ([server.js](../../backend/src/server.js), [deals.js](../../backend/src/routes/deals.js))

### Removing the write endpoints
**Before:** `POST /deals` and `DELETE /deals/:id` were public. The "Admin" toggle only hid a button
in the browser — `curl -X DELETE http://<host>/api/deals/<id>` worked for anyone.
**Why remove instead of adding auth?** Nothing legitimate used them: the scraper and `seed.js`
write to MongoDB directly. The most secure endpoint is one that doesn't exist
(principle of *least functionality*). If an admin UI is needed later, it should come with real
authentication (API key / OIDC), not a client-side flag.

### ReDoS and NoSQL injection
**Before:**
```js
filter[key] = { $regex: new RegExp(`^${val}$`, 'i') };   // val straight from the URL
```
- **ReDoS:** `?search=(a+)+$` is compiled as a real regular expression. Patterns like this
  backtrack exponentially, and because Node.js is single-threaded, *one* request can freeze the
  API for everyone.
- **Operator injection:** Express turns `?bank[$ne]=x` into the object `{ $ne: 'x' }`.
  Objects/arrays should never reach a Mongo filter.

**Now:** [`escapeRegex()`](../../backend/src/utils/escapeRegex.js) escapes every metacharacter, so
input is matched literally; `queryString()` only accepts plain strings; `search` is capped at 100 chars.

### Rate limiting behind a proxy
Every request reaches Express *from nginx*, so `req.ip` was always the nginx container's IP —
all users shared one rate-limit bucket (one abuser blocks everyone). `app.set('trust proxy', 1)`
tells Express to trust exactly **one** hop and read the client IP from `X-Forwarded-For`, which
nginx now sets. (Trusting *all* hops would let clients spoof their IP with a fake header.)

### Liveness vs readiness
| Probe | Question | On failure |
|---|---|---|
| `/health` (liveness) | Is the process alive? | Kubernetes **restarts** the pod |
| `/ready` (readiness) | Can it serve traffic now? (MongoDB connected?) | Kubernetes **stops routing** to the pod |

If MongoDB goes down, restarting the API wouldn't fix anything — it would just cause a restart
loop. So liveness never checks dependencies, while readiness does.

### Graceful shutdown
On every rolling update Kubernetes sends `SIGTERM`, waits (30s by default), then `SIGKILL`.
Without a handler, Node dies immediately and open requests fail. Now: stop accepting
connections → finish in-flight requests → close MongoDB → exit 0, with a 10s safety timer.
The Dockerfile uses the exec-form `CMD ["node", ...]` so node is PID 1 and actually receives the signal.

### Secrets in logs
`console.log(\`MongoDB connected: ${MONGO_URI}\`)` would print the password once auth is on —
and Promtail ships every log line into Loki. Backend and scraper now log only host and DB name.

## A2 — Frontend
Admin toggle, delete button, `handleDelete` and the related CSS were removed. Keeping a UI for an
endpoint that no longer exists would just be a broken feature.

## A3 — Dockerfiles
- **Non-root:** backend/scraper end with `USER node` (UID 1000, built into the official image).
  The app files are copied as root, so the runtime user can *read* but not *modify* the code.
  If an attacker gets code execution, they are an unprivileged user in a read-only app directory.
- **`nginx-unprivileged`:** official nginx runs as root to bind port 80. The unprivileged image
  runs as UID 101 on **8080** — required for `runAsNonRoot: true` in Phase B.
- **`npm ci --omit=dev`:** installs *exactly* the lockfile versions (fails if `package.json` and
  the lockfile disagree) and leaves jest/eslint/nodemon out of the image → smaller image,
  fewer CVEs for Trivy to find.
- **`.dockerignore`:** tests, coverage and READMEs never enter the build context.
- **`HEALTHCHECK`** in the backend image so plain `docker run` reports health too.

## A4 — nginx ([nginx.conf](../../frontend/nginx.conf))
- `server_tokens off` — don't advertise the nginx version (helps attackers match known CVEs).
- **Content-Security-Policy** — the browser only runs scripts from our own origin, which blocks
  most XSS payloads. Google Fonts and `logo.clearbit.com` (brand logos) are allow-listed explicitly.
- `X-Frame-Options: DENY` / `frame-ancestors 'none'` — prevents clickjacking.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- `location = /api/metrics { return 404; }` — Prometheus metrics reveal memory, versions and
  internals; Prometheus scrapes `backend:5000` directly over the internal network.
- Removed the WebSocket upgrade headers (the app doesn't use WebSockets).
- `/assets/` gets a 1-year cache — Vite file names contain a content hash, so new builds get new names.

## A5 — Compose ([docker-compose.yml](../../docker-compose.yml), [docker-compose.prod.yml](../../docker-compose.prod.yml))
- **MongoDB auth:** `MONGO_INITDB_ROOT_USERNAME/PASSWORD` creates a root user and turns on auth.
  `${VAR:?message}` makes compose **refuse to start** if the variable is missing, so it can't
  silently fall back to "no password".
- **Prod exposure:** before, ports 5000, 9090, 8080 and 3100 were open on the EC2 host. Each one
  is an unauthenticated internal tool on the internet (cAdvisor even exposes host details). Now only
  port 80 is published. Grafana listens on `127.0.0.1` only — reach it with
  `ssh -L 3001:localhost:3001 <user>@<ec2-host>`.
- **Pinned versions:** `:latest` means two deployments of the same commit can run different
  software, and a major upgrade can break the stored data. Pinned tags make deploys reproducible
  (digest pinning comes in the CI/CD phase).

### ⚠️ Migrating the existing EC2 deployment
1. **Check running versions first** — a database volume can't be downgraded:
   `docker exec deal-aggregator-db mongod --version`,
   `docker exec deal-aggregator-grafana grafana -v`,
   `docker exec deal-aggregator-prometheus prometheus --version`.
   If any is newer than the pinned tag, raise the pin before deploying.
2. Create `~/deal-aggregator/.env` from [`.env.prod.example`](../../.env.prod.example)
   (`openssl rand -hex 24` for URL-safe passwords).
3. `MONGO_INITDB_*` only runs on an **empty** volume. The data is re-scrapable, so the simplest
   path is: `docker compose -f docker-compose.prod.yml down`, then `docker volume rm deal-aggregator_mongo-data`,
   deploy, then run the scraper workflow once. (Alternative: create the user manually in `mongosh` first.)
4. Remove the old inbound rules for 5000/9090/8080/3100/3001 from the EC2 security group.

## A6 — Kubernetes (minimal; full hardening in Phase B)
- Frontend `containerPort`/`targetPort` → 8080; backend readiness probe → `/ready`; MongoDB pinned to `9.0.2`.
- **Known gap:** MongoDB in K8s still runs without auth — Phase B moves it to a StatefulSet with a Secret.

---

## How to verify
```bash
cp .env.example .env && docker compose up --build -d

curl -s localhost:3000/api/health                      # 200 {"status":"ok"}
curl -s localhost:3000/api/ready                       # 200 {"status":"ready","db":true}
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/metrics          # 404
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE localhost:3000/api/deals/x # 404
curl -s "localhost:3000/api/deals?search=(a%2B)%2B%24" # returns instantly
curl -sI localhost:3000 | grep -iE 'content-security|x-frame|server:'          # headers, no version

docker compose exec backend whoami                     # node
docker compose exec frontend id -u                     # 101
docker compose --profile scraper run --rm scraper      # works with auth
docker compose stop backend && docker compose logs backend | tail -3   # "shutting down gracefully"
```
Automated: `cd backend && npm test` covers `/ready`, removed write routes, headers, search length
and `escapeRegex`.
