const mongoose = require('mongoose');

/**
 * ScrapeRun Schema
 *
 * Tracks execution history of the deal scraper.
 * Enables the Drift Guard, data freshness monitoring, and Prometheus metrics.
 */
const scrapeRunSchema = new mongoose.Schema(
  {
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    pagesTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    pagesOk: {
      type: Number,
      required: true,
      default: 0,
    },
    offersFound: {
      type: Number,
      required: true,
      default: 0,
    },
    newInserts: {
      type: Number,
      default: 0,
    },
    updated: {
      type: Number,
      default: 0,
    },
    deactivated: {
      type: Number,
      default: 0,
    },
    failures: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['ok', 'degraded', 'failed'],
      required: true,
      default: 'ok',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index to quickly fetch the most recent completed runs
scrapeRunSchema.index({ completedAt: -1, status: 1 });

module.exports = mongoose.model('ScrapeRun', scrapeRunSchema);
