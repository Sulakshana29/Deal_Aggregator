const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Deal = require('../models/Deal');
const escapeRegex = require('../utils/escapeRegex');

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

const MAX_SEARCH_LENGTH = 100;

/**
 * Returns the query param as a plain string, or undefined.
 * Express parses ?bank[$ne]=x into an object and ?bank=a&bank=b into an array —
 * both are rejected so they can never reach a Mongo query (NoSQL injection).
 */
function queryString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

// ─── GET /deals ───────────────────────────────────────────────────────────────
/**
 * Returns deals with optional filtering.
 *
 * Query params (all optional, combinable):
 *   ?bank=HNB
 *   ?category=Dining
 *   ?cardType=credit
 *   ?offerType=percentage_discount
 *   ?usageChannel=online
 *   ?isActive=true          (defaults to true — hide expired deals)
 *   ?search=pizza           (text search on brand + discountText)
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};

    // ?all=true — return every deal regardless of isActive (used by frontend for client-side filtering)
    // ?isActive=false — return only inactive deals
    // (default) — return only active deals
    if (req.query.all !== 'true') {
      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === 'true';
      } else {
        filter.isActive = true;
      }
    }

    // Case-insensitive exact-match filters (input escaped — matched literally)
    const exactFilters = {
      bank:         queryString(req.query.bank),
      category:     queryString(req.query.category),
      cardType:     queryString(req.query.cardType),
      offerType:    queryString(req.query.offerType),
      usageChannel: queryString(req.query.usageChannel),
    };

    Object.entries(exactFilters).forEach(([key, val]) => {
      if (val) {
        filter[key] = { $regex: new RegExp(`^${escapeRegex(val)}$`, 'i') };
      }
    });

    // Text search across brand and discountText
    const search = queryString(req.query.search);
    if (search) {
      if (search.length > MAX_SEARCH_LENGTH) {
        return res.status(400).json({ error: `"search" must be at most ${MAX_SEARCH_LENGTH} characters` });
      }
      const q = escapeRegex(search);
      filter.$or = [
        { brand:        { $regex: q, $options: 'i' } },
        { discountText: { $regex: q, $options: 'i' } },
      ];
    }

    const deals = await Deal.find(filter).sort({ createdAt: -1 });
    res.json({ count: deals.length, deals });
  } catch (err) {
    console.error('GET /deals error:', err.message);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// ─── GET /deals/meta ─────────────────────────────────────────────────────────
/**
 * Returns unique values for all filterable fields — used by the frontend
 * to populate dropdown options dynamically without hardcoding them.
 */
router.get('/meta', async (req, res) => {
  try {
    const [banks, categories, cardTypes, offerTypes, channels] = await Promise.all([
      Deal.distinct('bank',         { isActive: true }),
      Deal.distinct('category',     { isActive: true }),
      Deal.distinct('cardType',     { isActive: true }),
      Deal.distinct('offerType',    { isActive: true }),
      Deal.distinct('usageChannel', { isActive: true }),
    ]);

    res.json({ banks, categories, cardTypes, offerTypes, channels });
  } catch (err) {
    console.error('GET /deals/meta error:', err.message);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

module.exports = router;
