const mongoose = require('mongoose');

/**
 * Deal Schema — v2
 *
 * Represents a single discount / BNPL offer from a Sri Lankan bank or provider.
 * Fields are structured so the frontend can filter, sort, and display them
 * meaningfully — not just show a free-text blob.
 */
const dealSchema = new mongoose.Schema(
  {
    // ── Core identity ──────────────────────────────────────────────────────
    brand: {
      type: String,
      required: [true, 'brand is required'],
      trim: true,
    },

    discountText: {
      type: String,
      required: [true, 'discountText is required'],
      trim: true,
      // Human-readable summary shown on the card (e.g. "25% off total bill")
    },

    // Canonical provider name (bank or BNPL), normalized by scraper/providers.js
    bank: {
      type: String,
      required: [true, 'bank is required'],
      trim: true,
    },

    // 'bank' = card issuer discount, 'bnpl' = Buy Now Pay Later provider
    providerType: {
      type: String,
      enum: {
        values: ['bank', 'bnpl'],
        message: 'providerType must be "bank" or "bnpl"',
      },
      default: 'bank',
    },

    category: {
      type: String,
      required: [true, 'category is required'],
      trim: true,
    },

    description: {
      type: String,
      default: '',
      trim: true,
    },

    bankSchedules: {
      type: [
        {
          day:      { type: String, trim: true },
          bank:     { type: String, trim: true },
          discount: { type: String, trim: true },
        },
      ],
      default: [],
    },

    // ── Card specifics ─────────────────────────────────────────────────────
    cardType: {
      type: String,
      enum: {
        values: ['credit', 'debit', 'both'],
        message: 'cardType must be "credit", "debit", or "both"',
      },
      default: 'both',
    },

    cardTier: {
      type: String,
      // e.g. "all", "gold", "platinum", "world", "infinite"
      // "all" means any tier qualifies
      default: 'all',
      trim: true,
    },

    // ── Offer structure ────────────────────────────────────────────────────
    offerType: {
      type: String,
      enum: {
        values: ['percentage_discount', 'cashback', 'instalment', 'bogo', 'flat_discount'],
        message: 'Invalid offerType',
      },
      default: 'percentage_discount',
    },

    discountValue: {
      type: Number,
      default: 0,
      // Meaning depends on offerType:
      //   percentage_discount → 25 means 25%
      //   flat_discount       → 500 means LKR 500 off
      //   instalment          → 0 means 0% interest
      //   cashback            → 10 means 10% cashback
      //   bogo                → 0 (implicit — buy 1 get 1)
    },

    minSpend: {
      type: Number,
      default: 0,
      // Minimum transaction amount (LKR) to qualify for the offer
    },

    maxDiscount: {
      type: Number,
      default: 0,
      // Cap on the saving (LKR). 0 = no cap.
      // e.g. "25% off, max LKR 1000" → discountValue: 25, maxDiscount: 1000
    },

    // ── Usage conditions ───────────────────────────────────────────────────
    usageChannel: {
      type: String,
      enum: {
        values: ['online', 'instore', 'both'],
        message: 'usageChannel must be "online", "instore", or "both"',
      },
      default: 'both',
    },

    validFrom: {
      type: Date,
      default: null,
    },

    validUntil: {
      type: Date,
      default: null,
    },

    // Days of the week this offer is valid. Empty array = every day.
    // e.g. ["Friday"] for Sampath KFC Friday deal
    validDays: {
      type: [String],
      default: [],
      enum: {
        values: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        message: 'Invalid day in validDays',
      },
    },

    // Whether the deal can be combined with a BNPL provider (Koko/Mintpay)
    isStackable: {
      type: Boolean,
      default: false,
    },

    // ── Data quality ───────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
      // Set to false by the CronJob scraper when validUntil has passed
      // or when the deal can no longer be found on the source page
    },

    lastVerified: {
      type: Date,
      default: Date.now,
      // Updated every time the scraper confirms this deal is still live
    },

    // ── Source tracking ────────────────────────────────────────────────────
    // 'scraped' = found on mypromo.lk, 'sample' = local dev data from seed.js
    // (never shown in production), 'manual' = legacy hand-entered data
    source: {
      type: String,
      enum: {
        values: ['manual', 'scraped', 'sample'],
        message: 'source must be "manual", "scraped" or "sample"',
      },
      default: 'manual',
    },

    // mypromo.lk's own promotion id — the scraper's upsert key
    externalId: {
      type: String,
      default: null,
    },

    scrapedFrom: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

/**
 * One document per mypromo.lk promotion. Partial, so legacy/sample documents
 * without an externalId are not affected.
 */
dealSchema.index(
  { source: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } }
);

/**
 * Index for the API's main query: live offers, filtered by mode and category,
 * sorted by expiry.
 */
dealSchema.index({ isActive: 1, providerType: 1, category: 1, validUntil: 1 });

module.exports = mongoose.model('Deal', dealSchema);
