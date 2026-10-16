/**
 * scrape.js — mypromo.lk offer scraper
 *
 * Target : category listing pages on https://www.mypromo.lk (SCRAPE_PAGES)
 * Method : axios (HTTP) + cheerio (HTML parsing)
 * Output : upserts offers into MongoDB, deactivates offers that disappeared,
 *          prints a run summary to stdout
 *
 * Why mypromo.lk?
 *   - Server-rendered HTML — no JavaScript rendering needed
 *   - No login required; robots.txt allows all paths
 *   - Every listing card already carries the full offer description, so one
 *     request per category page is enough (no per-offer detail requests)
 *
 * Data-integrity rules:
 *   - Only offers actually found on mypromo.lk are stored (source: 'scraped').
 *   - Each offer is keyed by mypromo.lk's own promotion id, so re-runs update
 *     instead of duplicating.
 *   - After a healthy run, scraped offers that were NOT seen are marked inactive.
 *     If most pages fail (site down / blocked), nothing is deactivated.
 *
 * Exit code 0 = success, 1 = fatal (DB unreachable or every page failed) —
 * read by the K8s CronJob / GitHub Actions to mark the run red.
 */

'use strict';

require('dotenv').config();

const axios    = require('axios');
const cheerio  = require('cheerio');
const mongoose = require('mongoose');
const { detectBrand } = require('./brands');
const { findProvider, cleanProfileLabel } = require('./providers');
const {
  normalizeText, parseDate, parseDescription, inferOfferType, inferCardType, inferCategory,
  merchantFromTitle, promotionId,
} = require('./parse');

// ── Config ─────────────────────────────────────────────────────────────────────
const MONGO_URI       = process.env.MONGO_URI || 'mongodb://localhost:27017/deal-aggregator';
const RETRY_DELAY_MS  = parseInt(process.env.RETRY_DELAY_MS || '3000', 10);
const PAGE_DELAY_MS   = parseInt(process.env.PAGE_DELAY_MS || '1500', 10);  // politeness gap between pages
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT_MS || '20000', 10);
const MAX_ATTEMPTS    = 3;
const BASE_URL        = 'https://www.mypromo.lk';

// Listing pages to scrape (verified Oct 2026). category: null = mixed page, so the
// category is inferred per offer. Store-only promotions with no bank/BNPL are skipped.
const SCRAPE_PAGES = [
  // Bank-card sections — the core of the site
  { url: `${BASE_URL}/promotions/banksandcards/credit-card-offers-discounts`,        category: null },
  { url: `${BASE_URL}/promotions/banksandcards/credit-card-offers-discounts?page=2`, category: null },
  { url: `${BASE_URL}/promotions/banksandcards/installmentplans`,                    category: null },
  { url: `${BASE_URL}/promotions/cashback-offers/banks-and-cards-cashback`,          category: null },
  // Shopping categories — only their bank-card offers are kept
  { url: `${BASE_URL}/promotions/supermarkets`,          category: 'Groceries' },
  { url: `${BASE_URL}/promotions/supermarkets?page=2`,   category: 'Groceries' },
  { url: `${BASE_URL}/promotions/food-and-drink/restaurants`,        category: 'Dining' },
  { url: `${BASE_URL}/promotions/food-and-drink/restaurants?page=2`, category: 'Dining' },
  { url: `${BASE_URL}/promotions/fashionandclothing`,    category: 'Fashion' },
  { url: `${BASE_URL}/promotions/travel`,                category: 'Travel' },
  { url: `${BASE_URL}/promotions/computers`,             category: 'Electronics' },
];

// Identify ourselves honestly instead of pretending to be a browser
const HTTP_HEADERS = {
  'User-Agent':      'DealAggregatorBot/2.0 (open-source portfolio project; runs every 12h)',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept':          'text/html,application/xhtml+xml',
};

// ── Mongoose model (inline copy so the scraper image is self-contained) ────────
// Must stay in sync with backend/src/models/Deal.js.
const dealSchema = new mongoose.Schema(
  {
    brand:         { type: String, required: true, trim: true },
    discountText:  { type: String, required: true, trim: true },
    bank:          { type: String, required: true, trim: true },
    providerType:  { type: String, enum: ['bank', 'bnpl'], default: 'bank' },
    category:      { type: String, required: true, trim: true },
    description:   { type: String, default: '' },
    bankSchedules: { type: [{ day: String, bank: String, discount: String }], default: [] },
    cardType:      { type: String, default: 'both' },
    cardTier:      { type: String, default: 'all' },
    offerType:     { type: String, default: 'percentage_discount' },
    discountValue: { type: Number, default: 0 },
    minSpend:      { type: Number, default: 0 },
    maxDiscount:   { type: Number, default: 0 },
    usageChannel:  { type: String, default: 'both' },
    validFrom:     { type: Date,   default: null },
    validUntil:    { type: Date,   default: null },
    validDays:     { type: [String], default: [] },
    isStackable:   { type: Boolean, default: false },
    isActive:      { type: Boolean, default: true },
    lastVerified:  { type: Date,   default: Date.now },
    source:        { type: String, default: 'scraped' },
    externalId:    { type: String, default: null },
    scrapedFrom:   { type: String, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);
// Same unique upsert key as the backend model, in case the scraper runs first
dealSchema.index(
  { source: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } }
);

const Deal =mongoose.models.Deal || mongoose.model('Deal', dealSchema);

// ── Helpers ────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetchWithRetry(url) — GET with a generous timeout and up to MAX_ATTEMPTS tries,
 * waiting longer after each failure (3 s, 6 s, ...). Throws after the last attempt.
 */
async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`  📡 [attempt ${attempt}/${MAX_ATTEMPTS}] GET ${url}`);
      const response = await axios.get(url, { headers: HTTP_HEADERS, timeout: REQUEST_TIMEOUT });
      return response.data;
    } catch (err) {
      lastError = err.response ? `HTTP ${err.response.status}` : err.message;
      // 4xx (except 429) won't fix itself — don't retry
      const status = err.response && err.response.status;
      if (status && status >= 400 && status < 500 && status !== 429) break;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError}`);
}

/**
 * parseCard($, el, pageCategory) — turns one <article class="related-promo-card">
 * into a normalized offer, or returns { skip: reason } when it can't be trusted.
 */
function parseCard($, el, pageCategory) {
  const card = $(el);

  const titleEl  = card.find('.related-promo-title a').first();
  const title    = normalizeText(titleEl.text());
  const href     = titleEl.attr('href') || '';
  const id       = promotionId(href);
  if (!title || !id) return { skip: 'no title or promotion id' };

  const subtitle  = card.find('.related-promo-subtitle').first().text();
  const business  = normalizeText(card.find('.related-promo-business').first().text());
  const companies = card.find('.related-promo-companies a[title]')
    .map((i, a) => cleanProfileLabel($(a).attr('title'))).get();
  const ribbon    = card.find('.ribbon.off').first().text().trim();
  const validUntil = parseDate(card.find('.related-promo-date b').first().text());

  // Provider: a known bank/BNPL among the listed companies, else named in the title/description
  const provider = findProvider(...companies, business, title, subtitle);
  if (!provider) return { skip: `no known bank/BNPL provider in "${title}"` };

  // Merchant: the first listed business/company that is NOT a bank or BNPL provider.
  // On bank-card pages the bank is listed as the business, so fall back to the
  // store named in the title ("… at Teleseen with …").
  const fromTitle = merchantFromTitle(title);
  const merchantRaw = [business, ...companies].find((name) => name && !findProvider(name))
    || (fromTitle && !findProvider(fromTitle) ? fromTitle : null);
  if (!merchantRaw) return { skip: `bank's own product, no store: "${title}"` };
  const { brand, category: knownCategory } = detectBrand(merchantRaw, merchantRaw, '');

  const details = parseDescription(subtitle);
  const { offerType, discountValue } = inferOfferType(`${title} ${details.description}`, ribbon);
  // Category, most reliable first: known brand → store name → the page it was listed on
  // → the offer text with the provider's name removed (so "Cargills Bank" ≠ supermarket)
  const offerText = `${title} ${details.description}`.replace(new RegExp(provider.name, 'gi'), '');
  const category = knownCategory || inferCategory(brand) || pageCategory
    || inferCategory(offerText) || 'Other';

  return {
    deal: {
      brand,
      discountText:  title,
      bank:          provider.name,
      providerType:  provider.type,
      category,
      description:   details.description,
      cardType:      inferCardType(`${title} ${details.description}`),
      offerType,
      discountValue,
      minSpend:      details.minSpend,
      maxDiscount:   details.maxDiscount,
      usageChannel:  details.usageChannel,
      validUntil,
      validDays:     details.validDays,
      isStackable:   false,
      isActive:      true,
      source:        'scraped',
      externalId:    id,
      scrapedFrom:   `${BASE_URL}${href}`,
    },
  };
}

/**
 * scrapePage({ url, category }) → { ok, deals }
 * ok=false means the page could not be fetched or no longer matches our selectors.
 */
async function scrapePage({ url, category }) {
  console.log(`\n🔎 Scraping: ${url}`);

  let html;
  try {
    html = await fetchWithRetry(url);
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    return { ok: false, deals: [] };
  }

  const $ = cheerio.load(html);
  const cards = $('article.related-promo-card');
  if (cards.length === 0) {
    console.warn('  ⚠️  Selector "article.related-promo-card" matched 0 elements — the site layout may have changed.');
    return { ok: false, deals: [] };
  }

  const deals = [];
  let skipped = 0;
  cards.each((i, el) => {
    try {
      const result = parseCard($, el, category);
      if (result.skip) {
        skipped++;
        console.log(`  ⏭️  Skipped: ${result.skip.slice(0, 90)}`);
      } else {
        deals.push(result.deal);
      }
    } catch (err) {
      skipped++;
      console.warn(`  ⚠️  Card #${i + 1}: parse error — ${err.message}`);
    }
  });

  console.log(`  ✅ ${cards.length} card(s): ${deals.length} parsed, ${skipped} skipped`);
  return { ok: true, deals };
}

/**
 * upsertDeal(deal) — insert or update keyed by mypromo.lk's promotion id,
 * so the same offer seen on two pages or two runs is stored once.
 */
function upsertDeal(deal) {
  return Deal.findOneAndUpdate(
    { source: 'scraped', externalId: deal.externalId },
    { $set: { ...deal, lastVerified: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true, includeResultMetadata: true }
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const runStartedAt = new Date();
  console.log('═══════════════════════════════════════════════════');
  console.log('  Deal Aggregator — Scraper Run');
  console.log(`  Started : ${runStartedAt.toISOString()}`);
  console.log(`  Target  : ${SCRAPE_PAGES.length} page(s) on mypromo.lk`);
  console.log('═══════════════════════════════════════════════════');

  try {
    await mongoose.connect(MONGO_URI);
    // Log only host/db — MONGO_URI contains credentials
    console.log(`\n✅ MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.error(`\n❌ MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }

  let pagesOk = 0;
  let totalFound = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalFailed = 0;

  for (const [i, page] of SCRAPE_PAGES.entries()) {
    if (i > 0) await sleep(PAGE_DELAY_MS); // be polite to mypromo.lk
    const { ok, deals } = await scrapePage(page);
    if (ok) pagesOk++;
    totalFound += deals.length;

    for (const deal of deals) {
      try {
        const res = await upsertDeal(deal);
        if (res.lastErrorObject && res.lastErrorObject.upserted) totalInserted++;
        else totalUpdated++;
      } catch (dbErr) {
        console.error(`  ❌ DB upsert failed for "${deal.brand}": ${dbErr.message}`);
        totalFailed++;
      }
    }
  }

  // ── Deactivate offers that have disappeared from mypromo.lk ────────────────
  // Only after a healthy run: if most pages failed, "not seen" means "couldn't
  // check", not "gone" — deactivating then would empty the site during an outage.
  let deactivated = 0;
  const healthy = pagesOk >= Math.ceil(SCRAPE_PAGES.length / 2) && totalFound > 0;
  if (healthy) {
    const res = await Deal.updateMany(
      { source: 'scraped', isActive: true, lastVerified: { $lt: runStartedAt } },
      { $set: { isActive: false } }
    );
    deactivated = res.modifiedCount;
  } else {
    console.warn('\n⚠️  Unhealthy run — skipping deactivation of unseen offers.');
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Scrape Run Summary');
  console.log('─────────────────────────────────────────────────');
  console.log(`  Pages OK       : ${pagesOk}/${SCRAPE_PAGES.length}`);
  console.log(`  Offers found   : ${totalFound}`);
  console.log(`  New inserts    : ${totalInserted}`);
  console.log(`  Updated        : ${totalUpdated}`);
  console.log(`  Deactivated    : ${deactivated}`);
  console.log(`  DB failures    : ${totalFailed}`);
  console.log(`  Completed      : ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════');

  await mongoose.disconnect();

  if (pagesOk === 0) {
    console.error('❌ Every page failed — exiting with code 1');
    process.exit(1);
  }
  if (totalFound > 0 && totalFailed === totalFound) {
    console.error('❌ All DB writes failed — exiting with code 1');
    process.exit(1);
  }

  console.log('\n✅ Scraper finished successfully.');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { parseCard };
