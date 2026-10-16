# Phase A.5 — Data Integrity, API Design & UX

**Goal:** make the product trustworthy before moving to Kubernetes. A security
review of my own data pipeline found that the site was showing invented offers
as live data, so this phase is as much about **data integrity** as about looks.

| # | Area | Problem found | Fix |
|---|------|---------------|-----|
| 1 | Data integrity | 19 hardcoded offers were stored as `source: 'scraped'` with a rolling "today + 30 days" expiry, so they never expired | Removed from production. Sample data is now `source: 'sample'` and hidden unless `SHOW_SAMPLE_DATA=true` |
| 2 | Data integrity | `seed.js` ran `deleteMany({})`, wiping **all** offers, and it ships inside the production image | Deletes only `source: 'sample'` documents |
| 3 | Scraper | mypromo.lk changed its markup. Banks were stored as "Visit Peoples Bank profile", and 4 of 9 category URLs returned 404/500 | Provider directory + label cleaning; verified URL list; dedicated bank-card sections added |
| 4 | Scraper | The same bank appeared as `HNB` / `Hatton National Bank`, `BOC` / `Bank of Ceylon`… | `providers.js` maps every alias to one canonical name and a type (`bank` / `bnpl`) |
| 5 | Scraper | Expired offers stayed `isActive: true` forever (50 of 53 local offers had expired) | API hides offers past `validUntil`; after a *healthy* run the scraper deactivates offers it no longer sees |
| 6 | Scraper | 3.5 s timeout and no real retry, so it failed on slow networks | 20 s timeout, 3 attempts with backoff, no retry on 4xx, 1.5 s politeness delay |
| 7 | Scraper | Pretended to be Chrome | Honest `User-Agent` (robots.txt allows all paths) |
| 8 | Parsing | `"0%"` test also matched `"10%"` / `"20%"`, so "20% cashback" was labelled an instalment plan | Standalone-zero regex + unit tests |
| 9 | API | `GET /deals?all=true` returned every document, with no limit | Server-side filtering + pagination, `limit` capped at 50 |
| 10 | API | Hardcoded UI numbers (`\|\| 2`, `\|\| 12`) | `GET /deals/meta` computes counts and stats from data |
| 11 | Observability | No request logs: an attack on the API was invisible in Loki | `pino-http` JSON logs: client IP, method, path, status, duration; credentials redacted; probes skipped |
| 12 | UX | Card discounts and BNPL mixed together; no descriptions; "Claim offer" button | Two clear modes, structured cards, details dialog, honest "View on mypromo.lk" |
| 13 | Supply chain | Brand logos loaded from `logo.clearbit.com` (a service that no longer exists), allow-listed in the CSP | Removed. Avatars are generated locally and the CSP allow-list shrinks |

---

## 1. Data integrity: why this mattered most
A deal site that shows invented offers misleads users: someone could drive to a
store expecting 30% off. In a portfolio it also undermines trust in everything
else: if one offer is fake, a reviewer can't trust the rest.

The fix applies a simple rule: **only data with a verifiable source is shown in production.**
- Every scraped offer stores mypromo.lk's own promotion id (`externalId`) and its URL
  (`scrapedFrom`), and the UI links to it ("View on mypromo.lk").
- Sample data exists for local development only. It's labelled `source: 'sample'`,
  shown with a **SAMPLE** badge, and filtered out by the API unless
  `SHOW_SAMPLE_DATA=true` (set only in `docker-compose.yml`, never in production).

### Safe deactivation
Offers that disappear from mypromo.lk are switched off, but **only after a healthy run**
(at least half the pages fetched and at least one offer found). If mypromo.lk is down or
blocks us, "not seen" means "couldn't check", not "gone". Deactivating then would
empty the whole site during an outage. Failing safe matters more than being up to date.

## 2. Scraper ([scrape.js](../../scraper/scrape.js), [parse.js](../../scraper/parse.js), [providers.js](../../scraper/providers.js))
- **One request per page.** Every listing card already carries the full description
  (minimum bill, cap, valid days, channel), so no per-offer detail requests are needed.
  That's about 11 requests per run instead of about 100, which keeps the load on mypromo.lk low.
- **Pure parsing module.** All text rules live in `parse.js` with no network or DB code,
  unit-tested with Node's built-in runner (`node --test`), so there are **no new dependencies**.
  The tests use real descriptions copied from the site.
- **Merchant vs. provider.** On bank pages the "business" is the bank, so the merchant
  is the first listed company that is *not* a provider, else the store named in the
  title ("… at Teleseen with …"). Bank-only products with no store are skipped.
- **Category, most reliable signal first:** brand dictionary → store name → page
  category → offer text with the provider's name removed (so "Cargills **Bank**" is not
  mistaken for the Cargills supermarket).
- **Upsert key = `externalId`**, backed by a unique partial index, so the same offer seen
  on two pages or in two runs is stored once.

## 3. API ([routes/deals.js](../../backend/src/routes/deals.js), [dealQuery.js](../../backend/src/dealQuery.js))
| Endpoint | Purpose |
|---|---|
| `GET /deals?mode=&category=&provider=&cardType=&search=&sort=&page=&limit=` | Paginated live offers (`{ items, total, page, pages, limit }`) |
| `GET /deals/meta` | Categories and providers with live counts, mode counts, headline stats, last update time |
| `GET /deals/:id` | One offer, for shareable links (`?deal=<id>`); invalid ids → 400 |

Security properties, all unit-tested:
- **Allow-listed values** for `mode`, `sort` and `cardType`, so anything else is a 400 before the DB is touched.
- **String-only parameters**, so `?category[$ne]=x` (operator injection) and arrays are ignored.
- **Escaped search** (no ReDoS), with a 100-character limit.
- **Bounded responses:** `limit` is capped at 50 and `page` at 1000. An unbounded endpoint is
  a cheap denial-of-service vector, and it slows down as data grows.
- Express 4 doesn't catch errors thrown in `async` handlers, so every handler answers
  its own errors instead of crashing the process.

## 4. Request logging (`pino-http`)
One JSON line per request:
```json
{"req":{"method":"GET","url":"/deals?mode=card"},"clientIp":"203.0.113.7","res":{"statusCode":200},"responseTime":22}
```
- **Why:** before this, Loki only had startup logs, so a scraping bot or an injection
  attempt left no trace. Now you can query, for example, `{container="backend"} | json | res_statusCode >= 400`.
- `/health`, `/ready` and `/metrics` are skipped (probes hit them every few seconds).
- `authorization`, `cookie` and `set-cookie` are redacted, so secrets never reach the log store.
- `clientIp` is the real visitor IP, thanks to `trust proxy` from Phase A.

## 5. UX ([frontend/src](../../frontend/src))
- **Two modes, explained in words:** *Card offers* (discounts, cashback, buy-1-get-1 with
  a bank card) and *Pay later* (Koko, Mintpay and bank 0% instalment plans).
- **Cards answer the shopper's questions:** what I get (big benefit), which bank and card,
  which days, conditions (minimum bill / cap), and how long is left.
- **Details dialog:** native `<dialog>`, so focus trapping and Esc come for free without a UI
  library. It has an honest disclaimer and a link to the source.
- **State in the URL:** every filter and an open offer is a shareable link.
- **Server-side paging** with "Load more"; stale requests are aborted; search is debounced.
- **Every state handled:** skeletons, empty results, an error with retry.
- **Accessibility:** a skip link, `aria` roles for tabs and dialogs, visible focus, a reduced-motion setting.
- **No new runtime dependencies:** icons are inline SVG. Fewer packages means a smaller supply-chain risk.

## How to verify
```bash
cd scraper  && npm test        # 11 parser tests
cd backend  && npm test        # 27 API tests
cd frontend && npm test        # 9 UI tests

# Against a throwaway database:
export MONGO_URI=mongodb://localhost:27017/deal-aggregator-test
node backend/seed.js && (cd scraper && node scrape.js)   # e.g. "Pages OK: 11/11"
curl "localhost:5000/deals?mode=paylater&limit=5"
curl "localhost:5000/deals?mode=everything"             # 400
curl "localhost:5000/deals?category[\$ne]=x"            # filter ignored
```

## Known limitations
- mypromo.lk has no Koko/Mintpay listings at the moment, so in production "Pay later"
  shows only bank 0% instalment plans until BNPL offers reappear.
- Category inference is keyword-based, so an unusual store lands in "Other".
- The scraper depends on mypromo.lk's HTML. If the layout changes, a page returns
  0 cards, the run is marked unhealthy, and nothing is deactivated.
