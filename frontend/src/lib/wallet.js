/**
 * wallet.js — localStorage management for user's bank cards.
 * No account, zero backend auth required — stays in the browser.
 */

const STORAGE_KEY = 'dealvault_wallet_v1';

/**
 * Loads wallet cards from localStorage.
 * @returns {Array<{ id: string, bank: string, type: 'credit'|'debit' }>}
 */
export function getWallet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persists wallet cards to localStorage.
 */
export function saveWallet(cards) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Turns wallet cards into the compact format expected by the API:
 * "HNB:credit,Commercial Bank:debit"
 */
export function serializeWallet(cards = []) {
  if (!cards || cards.length === 0) return '';
  return cards
    .map((c) => `${c.bank}:${c.type}`)
    .filter(Boolean)
    .join(',');
}

/**
 * Generates an id for a new card entry.
 */
export function makeCardId(bank, type) {
  return `${bank.toLowerCase().replace(/\s+/g, '_')}_${type}`;
}
