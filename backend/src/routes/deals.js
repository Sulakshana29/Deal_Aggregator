const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Deal = require('../models/Deal');

// ─── Rate limiter for write endpoints ────────────────────────────────────────
// Limits POST to 30 requests per 15 minutes per IP.
// Documented in Phase 5 security section.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests — please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Allowed values (mirrors the Mongoose enums) ──────────────────────────────
const VALID_CARD_TYPES    = ['credit', 'debit', 'both'];
const VALID_OFFER_TYPES   = ['percentage_discount', 'cashback', 'instalment', 'bogo', 'flat_discount'];
const VALID_CHANNELS      = ['online', 'instore', 'both'];

// ─── Validation helper ────────────────────────────────────────────────────────
/**
 * Validates POST body fields.
 * Returns an array of error strings — empty means valid.
 */
function validateDeal(body) {
  const errors = [];

  // Required string fields
  ['brand', 'discountText', 'bank', 'category'].forEach((field) => {
    if (!body[field] || typeof body[field] !== 'string' || body[field].trim() === '') {
      errors.push(`"${field}" is required and must be a non-empty string`);
    }
  });

  // Enum validations
  if (body.cardType && !VALID_CARD_TYPES.includes(body.cardType)) {
    errors.push(`"cardType" must be one of: ${VALID_CARD_TYPES.join(', ')}`);
  }
  if (body.offerType && !VALID_OFFER_TYPES.includes(body.offerType)) {
    errors.push(`"offerType" must be one of: ${VALID_OFFER_TYPES.join(', ')}`);
  }
  if (body.usageChannel && !VALID_CHANNELS.includes(body.usageChannel)) {
    errors.push(`"usageChannel" must be one of: ${VALID_CHANNELS.join(', ')}`);
  }
  if (body.source && !['manual', 'scraped'].includes(body.source)) {
    errors.push('"source" must be "manual" or "scraped"');
  }

  // Numeric fields
  ['discountValue', 'minSpend', 'maxDiscount'].forEach((field) => {
    if (body[field] !== undefined && (typeof body[field] !== 'number' || body[field] < 0)) {
      errors.push(`"${field}" must be a non-negative number`);
    }
  });

  // Date fields
  ['validFrom', 'validUntil'].forEach((field) => {
    if (body[field] && isNaN(Date.parse(body[field]))) {
      errors.push(`"${field}" must be a valid date string`);
    }
  });

  return errors;
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

    // Case-insensitive exact-match filters
    const exactFilters = {
      bank:         req.query.bank,
      category:     req.query.category,
      cardType:     req.query.cardType,
      offerType:    req.query.offerType,
      usageChannel: req.query.usageChannel,
    };

    Object.entries(exactFilters).forEach(([key, val]) => {
      if (val) {
        filter[key] = { $regex: new RegExp(`^${val}$`, 'i') };
      }
    });

    // Text search across brand and discountText
    if (req.query.search) {
      const q = req.query.search.trim();
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

// ─── POST /deals ──────────────────────────────────────────────────────────────
/**
 * Creates a new deal.
 * Rate-limited + validated before touching the database.
 */
router.post('/', writeLimiter, async (req, res) => {
  const errors = validateDeal(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  try {
    const deal = new Deal({
      brand:         req.body.brand.trim(),
      discountText:  req.body.discountText.trim(),
      bank:          req.body.bank.trim(),
      category:      req.body.category.trim(),
      cardType:      req.body.cardType      || 'both',
      cardTier:      req.body.cardTier      || 'all',
      offerType:     req.body.offerType     || 'percentage_discount',
      discountValue: req.body.discountValue || 0,
      minSpend:      req.body.minSpend      || 0,
      maxDiscount:   req.body.maxDiscount   || 0,
      usageChannel:  req.body.usageChannel  || 'both',
      validFrom:     req.body.validFrom  ? new Date(req.body.validFrom)  : null,
      validUntil:    req.body.validUntil ? new Date(req.body.validUntil) : null,
      validDays:     req.body.validDays  || [],
      isStackable:   req.body.isStackable || false,
      isActive:      req.body.isActive !== undefined ? req.body.isActive : true,
      source:        req.body.source    || 'manual',
      scrapedFrom:   req.body.scrapedFrom || null,
    });

    const saved = await deal.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('POST /deals error:', err.message);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// ─── DELETE /deals/:id ────────────────────────────────────────────────────────
/**
 * Hard-deletes a deal by MongoDB ObjectId.
 * Returns 404 if the id doesn't match any document.
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Deal.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json({ message: 'Deal deleted', id: req.params.id });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid deal ID format' });
    }
    console.error('DELETE /deals/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

module.exports = router;
