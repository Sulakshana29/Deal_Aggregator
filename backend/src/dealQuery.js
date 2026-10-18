/**
 * dealQuery.js — turns GET /deals query params into a MongoDB query.
 *
 * Pure functions only (no DB access), so every rule is unit-tested in
 * dealQuery.test.js. Invalid input throws a QueryError → HTTP 400.
 */

const escapeRegex = require('./utils/escapeRegex');

const MODES = ['card', 'paylater'];
const SORTS = ['ending', 'discount', 'newest'];
const CARD_TYPES = ['credit', 'debit'];
const DAYS = ['today'];
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;
const MAX_SEARCH_LENGTH = 100;
const MAX_PAGE = 1000;
const MAX_NAME_LENGTH = 80;        // brand / category / bank names
const MAX_WALLET_CARDS = 20;
const MAX_BILL = 10000000;         // LKR 10M — anything bigger is not a shopping bill

// Sri Lanka is UTC+05:30 all year (no DST), so "today" is a fixed offset away
const COLOMBO_OFFSET_MS = 330 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

class QueryError extends Error {}

/** Accept only plain non-empty strings — rejects ?x[$ne]=1 objects and ?x=a&x=b arrays. */
function str(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function oneOf(value, allowed, name) {
  const v = str(value);
  if (v === undefined) return undefined;
  if (!allowed.includes(v)) throw new QueryError(`"${name}" must be one of: ${allowed.join(', ')}`);
  return v;
}

function positiveInt(value, name, fallback, max) {
  const v = str(value);
  if (v === undefined) return fallback;
  if (!/^\d+$/.test(v) || Number(v) < 1) throw new QueryError(`"${name}" must be a positive integer`);
  return Math.min(Number(v), max);
}

/** An exact-match name (brand, category, provider) with a length limit. */
function name(value, field) {
  const v = str(value);
  if (v !== undefined && v.length > MAX_NAME_LENGTH) {
    throw new QueryError(`"${field}" must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return v;
}

/** Weekday name in Sri Lanka right now, e.g. "Friday". */
function colomboWeekday(now = new Date()) {
  return WEEKDAYS[new Date(now.getTime() + COLOMBO_OFFSET_MS).getUTCDay()];
}

/**
 * parseWallet("HNB:credit,Sampath Bank:debit") → [{ bank, type }]
 * The wallet lives in the browser; it is sent as a compact list of bank:cardType.
 */
function parseWallet(value) {
  const v = str(value);
  if (v === undefined) return undefined;
  const entries = v.split(',').map((s) => s.trim()).filter(Boolean);
  if (entries.length === 0) return undefined;
  if (entries.length > MAX_WALLET_CARDS) {
    throw new QueryError(`"wallet" can hold at most ${MAX_WALLET_CARDS} cards`);
  }
  return entries.map((entry) => {
    const i = entry.lastIndexOf(':');
    const bank = i > 0 ? entry.slice(0, i).trim() : '';
    const type = i > 0 ? entry.slice(i + 1).trim() : '';
    if (!bank || bank.length > MAX_NAME_LENGTH || !CARD_TYPES.includes(type)) {
      throw new QueryError('"wallet" must look like "HNB:credit,Sampath Bank:debit"');
    }
    return { bank, type };
  });
}

/** Optional bill amount in LKR (whole rupees). */
function parseBill(value) {
  const v = str(value);
  if (v === undefined) return undefined;
  if (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > MAX_BILL) {
    throw new QueryError(`"bill" must be a whole amount between 1 and ${MAX_BILL}`);
  }
  return Number(v);
}

/** An offer matches a wallet card if the bank matches and it accepts that card type. */
function walletFilter(cards) {
  return { $or: cards.map((c) => ({ bank: c.bank, cardType: { $in: [c.type, 'both'] } })) };
}

/** Offers with no listed days are valid every day. */
function dayFilter(weekday) {
  return { $or: [{ validDays: { $size: 0 } }, { validDays: { $exists: false } }, { validDays: weekday }] };
}

/** Start of today (UTC). An offer whose validUntil is today is still valid today. */
function startOfDay(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * liveFilter — the conditions every publicly visible offer must meet:
 * active, not expired, and from an allowed source.
 */
function liveFilter({ now = new Date(), showSamples = false } = {}) {
  return {
    isActive: true,
    source: { $in: showSamples ? ['scraped', 'sample'] : ['scraped'] },
    $or: [{ validUntil: null }, { validUntil: { $gte: startOfDay(now) } }],
  };
}

/** card = bank discounts; paylater = BNPL providers + bank 0% instalment plans */
function modeFilter(mode) {
  if (mode === 'paylater') return { $or: [{ providerType: 'bnpl' }, { offerType: 'instalment' }] };
  if (mode === 'card') return { providerType: { $ne: 'bnpl' }, offerType: { $ne: 'instalment' } };
  return {};
}

/**
 * buildDealQuery(query, options) → { match, sort, page, limit }
 */
function buildDealQuery(query = {}, options = {}) {
  const mode = oneOf(query.mode, MODES, 'mode');
  const sort = oneOf(query.sort, SORTS, 'sort') || 'ending';
  const cardType = oneOf(query.cardType, CARD_TYPES, 'cardType');
  const day = oneOf(query.day, DAYS, 'day');
  const category = name(query.category, 'category');
  const provider = name(query.provider, 'provider');
  const brand = name(query.brand, 'brand');
  const wallet = parseWallet(query.wallet);
  const search = str(query.search);
  const page = positiveInt(query.page, 'page', 1, MAX_PAGE);
  const limit = positiveInt(query.limit, 'limit', DEFAULT_LIMIT, MAX_LIMIT);

  if (search && search.length > MAX_SEARCH_LENGTH) {
    throw new QueryError(`"search" must be at most ${MAX_SEARCH_LENGTH} characters`);
  }

  const conditions = [liveFilter(options), modeFilter(mode)];
  if (category) conditions.push({ category });
  if (brand) conditions.push({ brand });
  if (provider) conditions.push({ bank: provider });
  if (wallet) conditions.push(walletFilter(wallet));
  if (day) conditions.push(dayFilter(colomboWeekday(options.now)));
  // An offer for "both" card types is valid for credit and for debit holders
  if (cardType) conditions.push({ cardType: { $in: [cardType, 'both'] } });
  if (search) {
    const re = { $regex: escapeRegex(search), $options: 'i' };
    conditions.push({ $or: [{ brand: re }, { discountText: re }, { description: re }, { bank: re }] });
  }

  const match = { $and: conditions.filter((c) => Object.keys(c).length > 0) };

  // _sortExpiry pushes offers without an end date to the back when sorting by "ending"
  const SORT_STAGES = {
    ending: { _sortExpiry: 1, discountValue: -1, _id: 1 },
    discount: { discountValue: -1, _sortExpiry: 1, _id: 1 },
    newest: { createdAt: -1, _id: 1 },
  };

  return { match, sort: SORT_STAGES[sort], page, limit };
}

/**
 * buildBestQuery(query, options) → { match, bill, brand, category }
 * For GET /deals/best: every live offer at one store (or in one category),
 * which the route then ranks by estimated saving.
 */
function buildBestQuery(query = {}, options = {}) {
  const brand = name(query.brand, 'brand');
  const category = name(query.category, 'category');
  const day = oneOf(query.day, DAYS, 'day');
  const bill = parseBill(query.bill);
  if (!brand && !category) throw new QueryError('"brand" or "category" is required');

  const conditions = [liveFilter(options), brand ? { brand } : { category }];
  if (day) conditions.push(dayFilter(colomboWeekday(options.now)));
  return { match: { $and: conditions }, bill, brand, category };
}

module.exports = {
  buildDealQuery, buildBestQuery, liveFilter, modeFilter, startOfDay, colomboWeekday, parseWallet,
  QueryError, MAX_LIMIT, DEFAULT_LIMIT,
};
