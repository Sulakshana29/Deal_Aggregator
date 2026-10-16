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
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;
const MAX_SEARCH_LENGTH = 100;
const MAX_PAGE = 1000;

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
  const category = str(query.category);
  const provider = str(query.provider);
  const search = str(query.search);
  const page = positiveInt(query.page, 'page', 1, MAX_PAGE);
  const limit = positiveInt(query.limit, 'limit', DEFAULT_LIMIT, MAX_LIMIT);

  if (search && search.length > MAX_SEARCH_LENGTH) {
    throw new QueryError(`"search" must be at most ${MAX_SEARCH_LENGTH} characters`);
  }

  const conditions = [liveFilter(options), modeFilter(mode)];
  if (category) conditions.push({ category });
  if (provider) conditions.push({ bank: provider });
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

module.exports = {
  buildDealQuery, liveFilter, modeFilter, startOfDay, QueryError, MAX_LIMIT, DEFAULT_LIMIT,
};
