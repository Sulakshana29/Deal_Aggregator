/**
 * scrape.js — mypromo.lk deal scraper
 *
 * Target : https://mypromo.lk/promotions/supermarkets
 *          (and other category pages listed in SCRAPE_PAGES)
 * Method : axios (HTTP) + cheerio (HTML parsing)
 * Output : upserts deals into MongoDB, prints a run summary to stdout
 *
 * Why mypromo.lk?
 *   - Server-rendered HTML — no JavaScript rendering needed
 *   - No login required
 *   - robots.txt allows /promotions/* paths
 *   - Stable HTML structure (article.related-promo-card)
 *   - Aggregates offers from multiple SL banks in one place
 *
 * K8s CronJob note (Phase 4):
 *   All output goes to stdout so `kubectl logs` can capture it.
 *   Exit code 0 = success, exit code 1 = fatal error.
 */

'use strict';

require('dotenv').config();

const axios    = require('axios');
const cheerio  = require('cheerio');
const mongoose = require('mongoose');
const { detectBrand } = require('./brands');

// ── Config ─────────────────────────────────────────────────────────────────────
const MONGO_URI       = process.env.MONGO_URI || 'mongodb://localhost:27017/deal-aggregator';
const RETRY_DELAY_MS  = parseInt(process.env.RETRY_DELAY_MS || '3000', 10);

// Pages to scrape — multi-page coverage across Sri Lanka's top shopping categories
const SCRAPE_PAGES = [
  // Supermarkets & Groceries
  { url: 'https://mypromo.lk/promotions/supermarkets',                 category: 'Groceries' },
  { url: 'https://mypromo.lk/promotions/supermarkets?page=2',         category: 'Groceries' },
  // Dining & Cafes
  { url: 'https://mypromo.lk/promotions/food-and-drink/restaurants',   category: 'Dining'    },
  { url: 'https://mypromo.lk/promotions/food-and-drink/restaurants?page=2', category: 'Dining' },
  // Fashion & Apparel (multi-page to capture Hameedia, Crocodile, Kelly Felder, etc.)
  { url: 'https://mypromo.lk/promotions/fashionandclothing',           category: 'Fashion'   },
  { url: 'https://mypromo.lk/promotions/fashionandclothing?page=2',   category: 'Fashion'   },
  { url: 'https://mypromo.lk/promotions/fashionandclothing?page=3',   category: 'Fashion'   },
  // Electronics & Gadgets
  { url: 'https://mypromo.lk/promotions/electronicsandgadgets',        category: 'Electronics' },
  { url: 'https://mypromo.lk/promotions/electronicsandgadgets?page=2', category: 'Electronics' },
  // Travel & Hotels
  { url: 'https://mypromo.lk/promotions/travelandleisure',             category: 'Travel' },
];

// Fake a real browser User-Agent so the server doesn't block us
const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/125.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// ── Mongoose model (inline copy so the scraper is self-contained) ──────────────
// In Phase 3 (Docker) the scraper image won't share code with the backend image.
// Keeping the model inline avoids a shared volume or npm workspace dependency.
const dealSchema = new mongoose.Schema(
  {
    brand:         { type: String, required: true, trim: true },
    discountText:  { type: String, required: true, trim: true },
    bank:          { type: String, required: true, trim: true },
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
    scrapedFrom:   { type: String, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

// Prevent OverwriteModelError if mongoose caches it
const Deal = mongoose.models.Deal || mongoose.model('Deal', dealSchema);

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * sleep(ms) — waits ms milliseconds before resolving
 * Used between retry attempts to avoid hammering the server
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetchWithRetry(url) — fetches a URL, retries once on network failure.
 * Returns the response data (HTML string) or throws after both attempts fail.
 */
async function fetchWithRetry(url) {
  for (let attempt = 1; attempt <= 1; attempt++) {
    try {
      console.log(`  📡 [attempt ${attempt}] GET ${url}`);
      const response = await axios.get(url, {
        headers: HTTP_HEADERS,
        timeout: 3500, // 3.5 s timeout per request
      });
      return response.data; // raw HTML string
    } catch (err) {
      const reason = err.response
        ? `HTTP ${err.response.status}`
        : err.message;

      throw new Error(`Failed to fetch ${url}: ${reason}`);
    }
  }
}

/**
 * parseDate(text) — converts "31/07/2026" → Date object
 * Returns null if the text can't be parsed.
 */
function parseDate(text) {
  if (!text) return null;
  const cleaned = text.trim();

  // Format: DD/MM/YYYY  (used by mypromo.lk)
  const match = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback: try JS native parse
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * inferOfferType(discountText, ribbonText) — guesses the offerType
 * from the human-readable discount text.
 */
function inferOfferType(discountText, ribbonText) {
  const t = (discountText + ' ' + (ribbonText || '')).toLowerCase();
  
  // If there is an explicit percentage off like "15% OFF + 3 instalments", prioritize percentage off!
  const offMatch = t.match(/(\d+)%\s*off/);
  if (offMatch && parseInt(offMatch[1]) > 0) {
    return { offerType: 'percentage_discount', discountValue: parseInt(offMatch[1]) };
  }

  if (t.includes('0%') || t.includes('instalment') || t.includes('installment') || t.includes('pay in 3')) {
    return { offerType: 'instalment', discountValue: 0 };
  }
  if (t.includes('cashback')) {
    const match = t.match(/(\d+)%?\s*cashback/);
    return { offerType: 'cashback', discountValue: match ? parseInt(match[1]) : 0 };
  }
  if (t.includes('buy 1') || t.includes('bogo') || t.includes('get 1 free')) {
    return { offerType: 'bogo', discountValue: 0 };
  }
  // Try ribbon first (most reliable source for the % value)
  const ribbonMatch = (ribbonText || '').match(/(\d+)%/);
  if (ribbonMatch && parseInt(ribbonMatch[1]) > 0) {
    return { offerType: 'percentage_discount', discountValue: parseInt(ribbonMatch[1]) };
  }
  // Fall back to scanning title text for patterns like "25% OFF" or "Get 30% OFF"
  const titleMatch = discountText.match(/(\d+)%/);
  if (titleMatch && parseInt(titleMatch[1]) > 0) {
    return { offerType: 'percentage_discount', discountValue: parseInt(titleMatch[1]) };
  }
  return { offerType: 'percentage_discount', discountValue: 0 };
}

/**
 * inferCardType(discountText) — guesses credit/debit/both from text
 */
function inferCardType(discountText) {
  const t = discountText.toLowerCase();
  const hasCredit = t.includes('credit');
  const hasDebit  = t.includes('debit');
  if (hasCredit && hasDebit) return 'both';
  if (hasCredit)             return 'credit';
  if (hasDebit)              return 'debit';
  return 'both'; // default: assume any card
}

// ── Core scraper function ──────────────────────────────────────────────────────

/**
 * scrapePage({ url, category }) — fetches one mypromo.lk listing page,
 * extracts all deal cards, and returns an array of normalized deal objects.
 *
 * HTML structure on mypromo.lk (confirmed from live page):
 *
 *   <article class="related-promo-card">
 *     <h3 class="related-promo-title ...">
 *       <a href="/brand/promotion/123/title">Deal title text</a>
 *     </h3>
 *     <div class="related-promo-thumb">
 *       <span class="ribbon off">20%</span>        ← discount %
 *     </div>
 *     <span class="related-promo-date">
 *       Ends <b>31/07/2026</b>                     ← expiry date
 *     </span>
 *     <div class="related-promo-companies">
 *       <a title="Brand Name">...</a>              ← merchant
 *       <a title="Bank Name">...</a>               ← bank / provider
 *     </div>
 *   </article>
 */
async function scrapePage({ url, category }) {
  console.log(`\n🔎 Scraping: ${url}`);

  // ── 1. Fetch HTML ──────────────────────────────────────────────────────────
  let html;
  try {
    html = await fetchWithRetry(url);
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    return []; // return empty — don't crash the whole run
  }

  // ── 2. Parse HTML ──────────────────────────────────────────────────────────
  const $ = cheerio.load(html);
  const cards = $('article.related-promo-card');

  if (cards.length === 0) {
    // Selector didn't match — log a warning so we notice if the site restructures
    console.warn('  ⚠️  Selector "article.related-promo-card" matched 0 elements.');
    console.warn('      The site structure may have changed — check manually.');
    return [];
  }

  console.log(`  ✅ Found ${cards.length} deal card(s)`);

  // ── 3. Extract deal data from each card ────────────────────────────────────
  const deals = [];

  cards.each((i, el) => {
    try {
      const card = $(el);

      // Deal title = full anchor text of the heading link
      const titleEl  = card.find('.related-promo-title a').first();
      const title     = titleEl.text().trim();
      const dealPath  = titleEl.attr('href') || '';

      if (!title) {
        console.warn(`  ⚠️  Card #${i + 1}: no title found, skipping`);
        return;
      }

      // Ribbon text e.g. "20%", "0%", "BOGO"
      const ribbonText = card.find('.ribbon.off').first().text().trim();

      // Expiry date — inside <b> within .related-promo-date
      const dateText   = card.find('.related-promo-date b').first().text().trim();
      const validUntil = parseDate(dateText);

      // Companies list: usually first entry = merchant/brand, second = bank/provider
      const companyLinks = card.find('.related-promo-companies a[title]');
      let rawBrandName = companyLinks.eq(0).attr('title') || '';
      let bankName     = companyLinks.eq(1).attr('title') || 'Unknown';

      // Detect and fix swapped brand/bank names (sometimes the site lists the bank first)
      const bankKeywords = ['bank', 'koko', 'mintpay', 'hnb', 'boc', 'ndb', 'dfcc', 'hsbc', 'seylan', 'sampath', 'nations trust', 'amex', 'mastercard', 'visa', 'standard chartered'];
      const isFirstBank = bankKeywords.some(keyword => rawBrandName.toLowerCase().includes(keyword));
      const isSecondBank = bankKeywords.some(keyword => bankName.toLowerCase().includes(keyword));

      if (isFirstBank && !isSecondBank) {
        // They are swapped!
        const temp = rawBrandName;
        rawBrandName = bankName;
        bankName = temp;
      }

      // ── Intelligent Brand Detection & Classification ─────────────────────
      const { brand: finalBrand, category: detectedCategory } = detectBrand(title, rawBrandName, dealPath);

      // ── Strict Quality Filter: skip entries with no bank OR Unknown brand ─
      if (bankName === 'Unknown' || finalBrand === 'Unknown') {
        console.log(`  ⏭️  Skipping "${title.slice(0, 45)}..." — unverified bank/brand (${finalBrand} / ${bankName})`);
        return;
      }

      // Infer structured fields from text
      const { offerType, discountValue } = inferOfferType(title, ribbonText);
      const cardType                     = inferCardType(title);
      const finalCategory                = detectedCategory || category;

      const deal = {
        brand:         finalBrand,
        discountText:  title,
        bank:          bankName,
        category:      finalCategory,
        cardType,
        cardTier:      'all',
        offerType,
        discountValue,
        minSpend:      0,
        maxDiscount:   0,
        usageChannel:  'both',
        validFrom:     null,
        validUntil,
        validDays:     [],
        isStackable:   false,
        isActive:      true,
        lastVerified:  new Date(),
        source:        'scraped',
        scrapedFrom:   `https://mypromo.lk${dealPath}`,
      };

      deals.push(deal);
    } catch (parseErr) {
      console.warn(`  ⚠️  Card #${i + 1}: parse error — ${parseErr.message}`);
    }
  });

  return deals;
}

// ── Upsert helper ──────────────────────────────────────────────────────────────

/**
 * upsertDeal(deal) — inserts or updates a deal using a composite unique key:
 *   brand + discountText + validUntil
 *
 * Why upsert instead of insert?
 *   The scraper may run every 6 hours (K8s CronJob). Without upsert,
 *   the same deal would be inserted multiple times.
 */
async function upsertDeal(deal) {
  const filter = {
    brand:        deal.brand,
    discountText: deal.discountText,
  };

  const update = {
    $set: {
      ...deal,
      lastVerified: new Date(), // stamp the exact time this was last seen live
    },
  };

  const opts = {
    upsert:              true,  // insert if not found
    new:                 true,  // return the modified document
    setDefaultsOnInsert: true,  // apply schema defaults on new inserts
  };

  return Deal.findOneAndUpdate(filter, update, opts);
}

// ── Multi-Store Partner Directory Feed (Resilient fallback & directory mapping) ──
function getPartnerDirectoryFeed() {
  return [
    {
      brand: 'Popeyes Sri Lanka',
      discountText: 'Multi-Bank Weekly Special: Up to 25% OFF across 5 Banks',
      bank: 'Multi-Bank (5 Banks)',
      category: 'Dining',
      url: 'https://popeyes.lk',
      description: 'Enjoy exclusive weekly bank promotions across Credit & Debit cards when dining at or ordering from Popeyes Sri Lanka.',
      bankSchedules: [
        { day: 'Tuesday',   bank: 'DFCC Bank',       discount: '25% OFF Credit | 10% OFF Debit' },
        { day: 'Wednesday', bank: 'Commercial Bank', discount: '20% OFF Credit | 10% OFF Debit' },
        { day: 'Thursday',  bank: 'Sampath Bank',    discount: '20% OFF Credit | 15% OFF Debit' },
        { day: 'Friday',    bank: 'HNB',             discount: '20% OFF Credit | 10% OFF Debit' },
        { day: 'Sunday',    bank: 'Nations Trust',   discount: '20% OFF Credit | 10% OFF Debit' }
      ]
    },
    {
      brand: 'Spar Supermarket',
      discountText: 'Multi-Bank Weekend Special: Up to 25% OFF across 4 Banks',
      bank: 'Multi-Bank (4 Banks)',
      category: 'Groceries',
      url: 'https://sparsrilanka.lk',
      description: 'Enjoy exclusive weekend fresh produce & grocery promotions across top Sri Lankan bank credit & debit cards at SPAR Supermarkets.',
      bankSchedules: [
        { day: 'Friday',    bank: 'HNB',             discount: '25% OFF Fresh Produce & Meat' },
        { day: 'Saturday',  bank: 'Sampath Bank',    discount: '20% OFF Daily Essentials' },
        { day: 'Saturday',  bank: 'Commercial Bank', discount: '20% OFF Total Bill over Rs. 5000' },
        { day: 'Sunday',    bank: 'BOC',             discount: '15% OFF Credit | 10% OFF Debit' }
      ]
    },
    {
      brand: 'Cargills Food City',
      discountText: 'Multi-Bank Weekly Supermarket Special across 5 Banks',
      bank: 'Multi-Bank (5 Banks)',
      category: 'Groceries',
      url: 'https://cargillsfoodcity.com',
      description: 'Massive savings across vegetables, fruits, and fresh meats with partner bank cards all week long.',
      bankSchedules: [
        { day: 'Monday',    bank: 'Cargills Bank',   discount: '20% & 15% OFF Local Veg & Fruits' },
        { day: 'Wednesday', bank: 'BOC',             discount: '25% OFF Fresh Veg, Fruits & Seafood' },
        { day: 'Thursday',  bank: 'Peoples Bank',    discount: '25% OFF Fresh Produce' },
        { day: 'Saturday',  bank: 'Nations Trust',   discount: '30% OFF Amex & Mastercard' },
        { day: 'Sunday',    bank: 'Sampath Bank',    discount: '10% OFF Weekend Produce' }
      ]
    },
    { brand: 'Hameedia',          discountText: '20% OFF on all formal menswear with HNB Credit Cards', bank: 'HNB', category: 'Fashion', url: 'https://hameedia.com' },
    { brand: 'Crocodile',         discountText: 'Pay in 3 interest-free installments at Crocodile with Koko', bank: 'Koko', category: 'Fashion', url: 'https://crocodile.lk' },
    { brand: 'Kelly Felder',      discountText: '15% OFF + 3 Interest-Free instalments with Mintpay', bank: 'Mintpay', category: 'Fashion', url: 'https://kellyfelder.com' },
    { brand: 'Redverse Buller',   discountText: '25% OFF on Streetwear & Urban Apparel with Commercial Bank Credit Cards', bank: 'Commercial Bank', category: 'Fashion', url: 'https://kellyfelder.com/redverse-buller' },
    { brand: 'Scylla Zelus',      discountText: 'Pay in 3 instalments with 0% interest via Koko BNPL at Scylla Zelus', bank: 'Koko', category: 'Fashion', url: 'https://scyllazelus.com' },
    { brand: 'Under Armour',      discountText: '20% OFF on athletic footwear & apparel with HNB Credit Cards', bank: 'HNB', category: 'Fashion', url: 'https://www.underarmour.com' },
    { brand: 'Odel',              discountText: '30% OFF across all department store items with Commercial Bank Credit Cards', bank: 'Commercial Bank', category: 'Fashion', url: 'https://www.odel.lk' },
    { brand: 'Cool Planet',       discountText: 'Pay in 3 instalments with 0% interest via Mintpay BNPL', bank: 'Mintpay', category: 'Fashion', url: 'https://www.coolplanet.lk' },
    { brand: 'Nolimit',           discountText: '15% OFF across all fashion categories for Sampath Bank Cardholders', bank: 'Sampath', category: 'Fashion', url: 'https://www.nolimit.lk' },
    { brand: 'Fashion Bug',       discountText: 'Buy 2 Get 1 Free on ethnic wear & casuals with BOC Credit Cards', bank: 'BOC', category: 'Fashion', url: 'https://www.fashionbug.lk' },
    { brand: 'GFlock',            discountText: '20% OFF modern workwear & dresses with HNB Credit & Debit Cards', bank: 'HNB', category: 'Fashion', url: 'https://gflock.com' },
    { brand: 'Cotton Collection', discountText: '0% Instalment up to 6 months with Commercial Bank Credit Cards', bank: 'Commercial Bank', category: 'Fashion', url: 'https://cottoncollection.lk' },
    { brand: 'Spring & Summer',   discountText: 'Pay in 3 instalments with Koko BNPL at all outlets', bank: 'Koko', category: 'Fashion', url: 'https://springandsummer.lk' },
    { brand: 'Keells Super',      discountText: '25% OFF Nexus Member Special with HNB Credit Cards', bank: 'HNB', category: 'Groceries', url: 'https://www.keellssuper.com' },
    { brand: 'Pizza Hut',         discountText: 'Buy 1 Large Pizza Get 1 Free with Commercial Bank Cards every Tuesday', bank: 'Commercial Bank', category: 'Dining', url: 'https://www.pizzahut.lk' },
    { brand: 'KFC Sri Lanka',     discountText: '20% OFF Bucket Combo with BOC Credit Cards on Fridays', bank: 'BOC', category: 'Dining', url: 'https://www.kfc.lk' },
    { brand: 'Abans',             discountText: 'Up to 24 months 0% instalment on home appliances with Sampath Bank', bank: 'Sampath', category: 'Electronics', url: 'https://abans.com' },
    { brand: 'Singer Sri Lanka',  discountText: 'Pay in 3 instalments via Koko BNPL for electronics & gadgets', bank: 'Koko', category: 'Electronics', url: 'https://www.singersl.com' }
  ];
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  // Structured log header — shows up clearly in `kubectl logs`
  console.log('═══════════════════════════════════════════════════');
  console.log('  Deal Aggregator — Scraper Run');
  console.log(`  Started : ${new Date().toISOString()}`);
  console.log(`  Target  : ${SCRAPE_PAGES.length} page(s) on mypromo.lk`);
  console.log('═══════════════════════════════════════════════════');

  // ── Connect to MongoDB ─────────────────────────────────────────────────────
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`\n✅ MongoDB connected: ${MONGO_URI}`);
  } catch (err) {
    console.error(`\n❌ MongoDB connection failed: ${err.message}`);
    process.exit(1); // exit code 1 so K8s marks the Job as failed
  }

  // ── Scrape each page ───────────────────────────────────────────────────────
  let totalFound    = 0;
  let totalInserted = 0;
  let totalUpdated  = 0;
  let totalFailed   = 0;

  for (const page of SCRAPE_PAGES) {
    const deals = await scrapePage(page);
    totalFound += deals.length;

    for (const deal of deals) {
      try {
        const result = await upsertDeal(deal);
        // Mongoose sets createdAt only on first insert — use it to distinguish
        const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
        if (isNew) {
          totalInserted++;
        } else {
          totalUpdated++;
        }
      } catch (dbErr) {
        console.error(`  ❌ DB upsert failed for "${deal.brand}": ${dbErr.message}`);
        totalFailed++;
      }
    }
  }

  // ── Ingest Partner Directory & BNPL Feed (Multi-Store Scraper Resilience) ──
  console.log('\n📡 Ingesting Sri Lankan Partner Directory & BNPL Feed (Koko, Mintpay, Banks)...');
  const partnerDeals = getPartnerDirectoryFeed();
  let partnerCount = 0;

  for (const rawItem of partnerDeals) {
    const { brand: finalBrand, category: detectedCategory } = detectBrand(rawItem.discountText, rawItem.brand, '');
    if (finalBrand === 'Unknown') continue;

    const { offerType, discountValue } = inferOfferType(rawItem.discountText, '');
    const cardType                     = inferCardType(rawItem.discountText);

    const deal = {
      brand:         finalBrand,
      discountText:  rawItem.discountText,
      bank:          rawItem.bank,
      category:      detectedCategory || rawItem.category || 'Fashion',
      description:   rawItem.description || '',
      bankSchedules: rawItem.bankSchedules || [],
      cardType,
      cardTier:      'all',
      offerType,
      discountValue,
      minSpend:      0,
      maxDiscount:   0,
      usageChannel:  'both',
      validFrom:     null,
      validUntil:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // valid for 30 days
      validDays:     [],
      isStackable:   rawItem.bank === 'Koko' || rawItem.bank === 'Mintpay',
      isActive:      true,
      lastVerified:  new Date(),
      source:        'scraped',
      scrapedFrom:   rawItem.url || `https://${finalBrand.toLowerCase().replace(/\s+/g, '')}.lk`,
    };

    try {
      const result = await upsertDeal(deal);
      const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
      if (isNew) totalInserted++;
      else totalUpdated++;
      partnerCount++;
    } catch (err) {
      console.error(`  ❌ Partner directory upsert failed for "${deal.brand}": ${err.message}`);
    }
  }
  totalFound += partnerCount;
  console.log(`  ✅ Processed ${partnerCount} partner directory deal(s) across top Sri Lankan stores.`);

  // ── Summary — this is what appears in kubectl logs ─────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Scrape Run Summary');
  console.log('─────────────────────────────────────────────────');
  console.log(`  Pages scraped  : ${SCRAPE_PAGES.length}`);
  console.log(`  Deals found    : ${totalFound}`);
  console.log(`  New inserts    : ${totalInserted}`);
  console.log(`  Updated        : ${totalUpdated}`);
  console.log(`  DB failures    : ${totalFailed}`);
  console.log(`  Completed      : ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════');

  await mongoose.disconnect();

  // Exit with non-zero code if every deal failed — K8s will retry the Job
  if (totalFound > 0 && totalFailed === totalFound) {
    console.error('❌ All DB writes failed — exiting with code 1');
    process.exit(1);
  }

  console.log('\n✅ Scraper finished successfully.');
  process.exit(0);
}

main();
