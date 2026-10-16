/**
 * format.js — turns raw offer fields into short, human-readable labels.
 * Pure functions, unit-tested in format.test.js.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };

/** 4000 → "Rs. 4,000" */
export function formatLKR(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-LK')}`;
}

/** The big headline on a card: what the shopper gets. */
export function benefitLabel(deal) {
  const v = deal.discountValue;
  switch (deal.offerType) {
    case 'percentage_discount': return v > 0 ? `${v}% off` : 'Special offer';
    case 'cashback':            return v > 0 ? `${v}% cashback` : 'Cashback';
    case 'flat_discount':       return v > 0 ? `${formatLKR(v)} off` : 'Discount';
    case 'bogo':                return 'Buy 1 get 1';
    case 'instalment':          return deal.providerType === 'bnpl' ? 'Pay in instalments' : '0% instalments';
    default:                    return 'Special offer';
  }
}

/** Short conditions line, e.g. "Min. Rs. 5,000 · Max. Rs. 2,000 off" */
export function conditionsLabel(deal) {
  const parts = [];
  if (deal.minSpend > 0) parts.push(`Min. bill ${formatLKR(deal.minSpend)}`);
  if (deal.maxDiscount > 0) parts.push(`Up to ${formatLKR(deal.maxDiscount)} off`);
  return parts.join(' · ');
}

/** ['Saturday','Sunday'] → "Sat–Sun"; ['Tuesday','Friday'] → "Tue, Fri"; [] → "Every day" */
export function daysLabel(days = []) {
  if (!days.length || days.length === 7) return 'Every day';
  const idx = days.map((d) => WEEK.indexOf(d)).filter((i) => i >= 0).sort((a, b) => a - b);
  const consecutive = idx.length > 2 && idx.every((d, i) => i === 0 || d === idx[i - 1] + 1);
  if (consecutive || (idx.length === 2 && idx[1] === idx[0] + 1)) {
    return `${SHORT[WEEK[idx[0]]]}–${SHORT[WEEK[idx[idx.length - 1]]]}`;
  }
  return idx.map((i) => SHORT[WEEK[i]]).join(', ');
}

export function cardTypeLabel(cardType) {
  if (cardType === 'credit') return 'Credit cards';
  if (cardType === 'debit') return 'Debit cards';
  return 'Credit & debit';
}

export function channelLabel(channel) {
  if (channel === 'online') return 'Online only';
  if (channel === 'instore') return 'In-store only';
  return 'Online & in-store';
}

/**
 * expiryInfo(validUntil) → { status, label }
 * status: 'none' | 'expired' | 'today' | 'soon' (≤ 7 days) | 'ok'
 */
export function expiryInfo(validUntil, now = new Date()) {
  if (!validUntil) return { status: 'none', label: 'No end date' };
  const end = new Date(validUntil);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - today) / DAY_MS);
  if (days < 0) return { status: 'expired', label: 'Expired' };
  if (days === 0) return { status: 'today', label: 'Ends today' };
  if (days <= 7) return { status: 'soon', label: `${days} day${days === 1 ? '' : 's'} left` };
  return { status: 'ok', label: `Ends ${formatDate(end)}` };
}

/** "31 Oct 2026" */
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "5 min ago", "3 h ago", "2 days ago" */
export function timeAgo(date, now = new Date()) {
  if (!date) return 'never';
  const mins = Math.max(0, Math.round((now - new Date(date)) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Two-letter avatar initials: "Cargills Food City" → "CF" */
export function initials(name = '') {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
}

/** Stable hue per brand so each avatar keeps its colour across reloads. */
export function brandHue(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
