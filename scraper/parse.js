/**
 * parse.js — pure text-parsing helpers for mypromo.lk offers
 *
 * Kept free of network/DB code so every rule can be unit-tested with
 * `node --test` (see parse.test.js).
 */

'use strict';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * normalizeText — collapses whitespace and repairs mypromo.lk's broken number
 * formatting: "Rs. 4, 000" → "Rs. 4,000", "10. 00 am" → "10.00 am".
 */
function normalizeText(text = '') {
  return text
    .replace(/\s+/g, ' ')
    .replace(/(\d),\s+(\d{3})\b/g, '$1,$2')
    .replace(/(\d)\.\s+(\d{2})\b/g, '$1.$2')
    .trim();
}

/** "31/07/2026" → Date (UTC midnight). Returns null if unparseable. */
function parseDate(text) {
  if (!text) return null;
  const match = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** "Rs. 5,000" / "LKR 6,000" amount following a phrase like "minimum bill". */
function amountAfter(text, phrasePattern) {
  const re = new RegExp(`${phrasePattern}[^\\d.]{0,25}?(?:rs\\.?|lkr)?\\s*([\\d,]+)`, 'i');
  const m = text.match(re);
  if (!m) return 0;
  const value = parseInt(m[1].replace(/,/g, ''), 10);
  return Number.isFinite(value) ? value : 0;
}

/** Weekdays an offer is limited to, e.g. "every Tuesday and Friday" → [Tuesday, Friday]. */
function parseValidDays(text) {
  const t = text.toLowerCase();
  if (/\bweekends?\b/.test(t)) return ['Saturday', 'Sunday'];
  const every = t.match(/every ((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:(?:,\s*|\s+and\s+|\s*&\s*)(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*)/);
  if (!every) return [];
  return WEEKDAYS.filter((day) => every[1].includes(day.toLowerCase()));
}

/** online / instore / both — based on what the description mentions. */
function parseUsageChannel(text) {
  const t = text.toLowerCase();
  const online = /\bonline\b|\bwebsite\b|\bapp\b/.test(t);
  const instore = /in-store|\binstore\b|\bin store\b|\boutlets?\b/.test(t);
  if (online && !instore) return 'online';
  if (instore && !online) return 'instore';
  return 'both';
}

/**
 * parseDescription — extracts structured conditions from the offer's
 * one-paragraph description (the card subtitle on mypromo.lk).
 */
function parseDescription(raw = '') {
  const description = normalizeText(raw);
  return {
    description,
    minSpend:     amountAfter(description, 'minimum (?:bill|spend|purchase|transaction)'),
    maxDiscount:  amountAfter(description, 'maximum (?:discount|savings?|cashback)'),
    validDays:    parseValidDays(description),
    usageChannel: parseUsageChannel(description),
  };
}

/**
 * inferOfferType(text, ribbonText) → { offerType, discountValue }
 * A real "N% off" always wins over instalment wording ("15% off + 3 instalments").
 */
function inferOfferType(text = '', ribbonText = '') {
  const t = `${text} ${ribbonText}`.toLowerCase();

  const off = t.match(/(\d+)%\s*off/);
  if (off && parseInt(off[1], 10) > 0) {
    return { offerType: 'percentage_discount', discountValue: parseInt(off[1], 10) };
  }
  // "0%" must be a standalone zero — not the end of "10%" / "20%"
  if (/(^|[^\d])0%/.test(t) || /instal+ments?|pay in \d/.test(t)) {
    return { offerType: 'instalment', discountValue: 0 };
  }
  const cashback = t.match(/(\d+)%?\s*cashback/);
  if (cashback || t.includes('cashback')) {
    return { offerType: 'cashback', discountValue: cashback ? parseInt(cashback[1], 10) : 0 };
  }
  if (/buy \d+,? get \d+|bogo|get \d+ free/.test(t)) {
    return { offerType: 'bogo', discountValue: 0 };
  }
  const flat = t.match(/(?:rs\.?|lkr)\s*([\d,]+)\s*off/);
  if (flat) {
    return { offerType: 'flat_discount', discountValue: parseInt(flat[1].replace(/,/g, ''), 10) };
  }
  const pct = t.match(/(\d+)%/);
  if (pct && parseInt(pct[1], 10) > 0) {
    return { offerType: 'percentage_discount', discountValue: parseInt(pct[1], 10) };
  }
  return { offerType: 'percentage_discount', discountValue: 0 };
}

/** credit / debit / both — from title + description wording. */
function inferCardType(text = '') {
  const t = text.toLowerCase();
  const credit = t.includes('credit');
  const debit = t.includes('debit');
  if (credit && !debit) return 'credit';
  if (debit && !credit) return 'debit';
  return 'both';
}

/**
 * merchantFromTitle — "15% Off at Teleseen with Commercial Bank Cards" → "Teleseen".
 * Used on bank-card pages, where the listed "business" is the bank, not the store.
 */
function merchantFromTitle(title = '') {
  const m = title.match(/\bat (.+?)(?: with | using | for | on |$)/i);
  if (!m) return null;
  const name = m[1].replace(/[.,;:!]+$/, '').trim();
  return name.length >= 2 && name.length <= 60 ? name : null;
}

// Keyword → category, checked in order (first match wins)
const CATEGORY_KEYWORDS = [
  ['Groceries',   /supermarket|grocer|keells|cargills|food city|glomark|laugfs super|arpico|spar\b|fresh produce|vegetable/],
  ['Dining',      /restaurant|dining|dine|kfc|pizza|burger|cafe|café|coffee|bakery|buffet|biryani|meal|food/],
  ['Travel',      /hotel|resort|travel|airline|flight|holiday|villa|tour/],
  ['Electronics', /electronic|mobile|phone|laptop|computer|appliance|tv\b|gadget|teleseen|singer|abans|softlogic|takas|daraz|gnext/],
  ['Fashion',     /fashion|cloth|apparel|wear|jewel|footwear|shoe|saree|boutique/],
  ['Health',      /hospital|medical|health|pharmacy|clinic|dental|channel/],
  ['Fuel',        /fuel|petrol|diesel|filling station/],
];

/** Best-guess shopping category from offer text, or null. */
function inferCategory(text = '') {
  const t = text.toLowerCase();
  const hit = CATEGORY_KEYWORDS.find(([, re]) => re.test(t));
  return hit ? hit[0] : null;
}

/** "/glomark/promotion/24895/30-off-..." → "24895" (mypromo.lk's own offer id). */
function promotionId(href = '') {
  const m = href.match(/\/promotion\/(\d+)\//);
  return m ? m[1] : null;
}

module.exports = {
  normalizeText,
  parseDate,
  parseDescription,
  inferOfferType,
  inferCardType,
  inferCategory,
  merchantFromTitle,
  promotionId,
};
