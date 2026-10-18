const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Deal = require('../models/Deal');
const {
  buildDealQuery,
  buildBestQuery,
  liveFilter,
  modeFilter,
  colomboWeekday,
  parseWallet,
  QueryError,
} = require('../dealQuery');
const { rankOffers } = require('../savings');

// ─── Read-only API ────────────────────────────────────────────────────────────
// This API intentionally exposes NO write endpoints. Deals are written only by
// the scraper (CronJob) and seed.js, which talk to MongoDB directly over the
// internal network. Fewer public routes = smaller attack surface.

// ─── Rate limiter ────────────────────────────────────────────────────────────
// 300 requests per 15 minutes per client IP — protects against floods and
// aggressive scraping. Relies on `trust proxy` in server.js so the real client
// IP (from X-Forwarded-For) is used instead of the nginx container's IP.
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests — please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(readLimiter);

// Sample offers from seed.js are visible only when explicitly enabled (local dev)
const showSamples = () => process.env.SHOW_SAMPLE_DATA === 'true';

// Fields never sent to clients
const HIDDEN_FIELDS = { __v: 0, _sortExpiry: 0 };
const FAR_FUTURE = new Date('9999-12-31T00:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── GET /deals ───────────────────────────────────────────────────────────────
/**
 * Paginated list of live offers (active, not expired).
 *
 * Query params (all optional):
 *   ?mode=card|paylater      card discounts vs. BNPL / 0% instalment plans
 *   ?category=Dining         exact category name (from /deals/meta)
 *   ?provider=HNB            exact provider name (from /deals/meta)
 *   ?cardType=credit|debit   includes offers valid for both
 *   ?search=pizza            text search on brand, title, description, provider
 *   ?sort=ending|discount|newest   (default: ending — soonest expiry first)
 *   ?page=1&limit=24         limit is capped at 50
 *
 * Response: { items, total, page, pages, limit }
 */
router.get('/', async (req, res) => {
  let q;
  try {
    q = buildDealQuery(req.query, { showSamples: showSamples() });
  } catch (err) {
    // Express 4 doesn't catch errors thrown in async handlers — answer here
    if (err instanceof QueryError) return res.status(400).json({ error: err.message });
    req.log.error({ err }, 'GET /deals: unexpected query error');
    return res.status(500).json({ error: 'Failed to fetch deals' });
  }

  try {
    const [result] = await Deal.aggregate([
      { $match: q.match },
      { $addFields: { _sortExpiry: { $ifNull: ['$validUntil', FAR_FUTURE] } } },
      { $sort: q.sort },
      {
        $facet: {
          items: [{ $skip: (q.page - 1) * q.limit }, { $limit: q.limit }, { $project: HIDDEN_FIELDS }],
          total: [{ $count: 'n' }],
        },
      },
    ]);
    const total = result.total[0] ? result.total[0].n : 0;
    res.json({
      items: result.items,
      total,
      page: q.page,
      pages: Math.max(1, Math.ceil(total / q.limit)),
      limit: q.limit,
    });
  } catch (err) {
    req.log.error({ err }, 'GET /deals failed');
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// ─── GET /deals/meta ─────────────────────────────────────────────────────────
/**
 * Filter options with live counts, plus real headline stats for the UI.
 * Computed from data — nothing hardcoded.
 */
router.get('/meta', async (req, res) => {
  try {
    const live = liveFilter({ showSamples: showSamples() });
    const weekFromNow = new Date(Date.now() + 7 * DAY_MS);

    const [facets] = await Deal.aggregate([
      { $match: live },
      {
        $facet: {
          categories: [{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          providers: [
            { $group: { _id: { name: '$bank', type: '$providerType' }, count: { $sum: 1 } } },
            { $sort: { '_id.name': 1 } },
          ],
          card: [{ $match: modeFilter('card') }, { $count: 'n' }],
          paylater: [{ $match: modeFilter('paylater') }, { $count: 'n' }],
          brands: [{ $group: { _id: '$brand' } }, { $count: 'n' }],
          brandsList: [
            { $group: { _id: '$brand', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
          endingSoon: [{ $match: { validUntil: { $ne: null, $lte: weekFromNow } } }, { $count: 'n' }],
          lastUpdated: [{ $group: { _id: null, at: { $max: '$lastVerified' } } }],
        },
      },
    ]);

    const n = (arr) => (arr[0] ? arr[0].n : 0);
    res.json({
      categories: facets.categories.map((c) => ({ name: c._id, count: c.count })),
      providers: facets.providers.map((p) => ({ name: p._id.name, type: p._id.type || 'bank', count: p.count })),
      brands: facets.brandsList.map((b) => ({ name: b._id, count: b.count })),
      modes: { card: n(facets.card), paylater: n(facets.paylater) },
      today: colomboWeekday(),
      stats: {
        live: n(facets.card) + n(facets.paylater),
        providers: facets.providers.length,
        brands: n(facets.brands),
        endingSoon: n(facets.endingSoon),
        lastUpdated: facets.lastUpdated[0] ? facets.lastUpdated[0].at : null,
      },
    });
  } catch (err) {
    req.log.error({ err }, 'GET /deals/meta failed');
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

// ─── GET /deals/best ──────────────────────────────────────────────────────────
/**
 * Ranks all offers for a chosen store/brand (or category) against a bill amount and wallet.
 * Query params:
 *   ?brand=Keells Super   (required if category is not provided)
 *   ?category=Groceries   (optional if brand provided, or fallback)
 *   ?bill=8000            (optional, whole LKR amount)
 *   ?wallet=HNB:credit,Sampath:debit (optional compact wallet cards)
 *   ?day=today            (optional, filter offers valid today)
 */
router.get('/best', async (req, res) => {
  let q;
  let wallet;
  try {
    q = buildBestQuery(req.query, { showSamples: showSamples() });
    wallet = parseWallet(req.query.wallet);
  } catch (err) {
    if (err instanceof QueryError) return res.status(400).json({ error: err.message });
    req.log.error({ err }, 'GET /deals/best: unexpected query error');
    return res.status(500).json({ error: 'Failed to process request' });
  }

  try {
    const deals = await Deal.find(q.match, HIDDEN_FIELDS).lean();
    const ranked = rankOffers(deals, { bill: q.bill, wallet });
    res.json({
      brand: q.brand || null,
      category: q.category || null,
      bill: q.bill || null,
      total: deals.length,
      items: ranked,
    });
  } catch (err) {
    req.log.error({ err }, 'GET /deals/best failed');
    res.status(500).json({ error: 'Failed to calculate best deals' });
  }
});

// ─── GET /deals/:id ───────────────────────────────────────────────────────────
/**
 * A single offer (used by shareable links and the details view).
 * Expired offers are still returned — the UI shows them as "expired" —
 * but inactive ones and hidden sources are not.
 */
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid deal id' });
  }
  try {
    const sources = showSamples() ? ['scraped', 'sample'] : ['scraped'];
    const deal = await Deal.findOne(
      { _id: req.params.id, isActive: true, source: { $in: sources } },
      HIDDEN_FIELDS
    ).lean();
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json(deal);
  } catch (err) {
    req.log.error({ err }, 'GET /deals/:id failed');
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

module.exports = router;
