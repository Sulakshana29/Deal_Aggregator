/**
 * api.js — thin wrappers around the read-only backend API (proxied at /api).
 */

const API_BASE = '/api';

async function getJSON(path, signal) {
  const res = await fetch(`${API_BASE}${path}`, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

/** filters: { mode, category, provider, cardType, search, sort, page, limit } */
export function fetchDeals(filters, signal) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  return getJSON(`/deals?${params}`, signal);
}

export function fetchMeta(signal) {
  return getJSON('/deals/meta', signal);
}

export function fetchDeal(id, signal) {
  return getJSON(`/deals/${encodeURIComponent(id)}`, signal);
}

/** params: { brand, category, bill, wallet, day } */
export function fetchBest(params, signal) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  return getJSON(`/deals/best?${q}`, signal);
}

export function fetchStatus(signal) {
  return getJSON('/status', signal);
}

