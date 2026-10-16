/**
 * App.jsx — page layout and data flow.
 *
 * Filtering, sorting and paging happen on the server (GET /deals); the page only
 * ever downloads one page of results. Filter state lives in the URL, so every
 * view — including an open offer (?deal=<id>) — is a shareable link.
 */
import { useCallback, useEffect, useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ModeTabs from './components/ModeTabs';
import Filters from './components/Filters';
import DealGrid from './components/DealGrid';
import DealDetails from './components/DealDetails';
import Footer from './components/Footer';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';
import { fetchDeal, fetchDeals, fetchMeta } from './api';

const PAGE_SIZE = 24;
const DEFAULT_FILTERS = { mode: 'card', category: '', provider: '', cardType: '', sort: 'ending', search: '' };
const URL_KEYS = { mode: 'mode', category: 'category', provider: 'provider', cardType: 'card', sort: 'sort', search: 'q' };

function readUrl() {
  const p = new URLSearchParams(window.location.search);
  const filters = { ...DEFAULT_FILTERS };
  Object.entries(URL_KEYS).forEach(([key, param]) => {
    if (p.get(param)) filters[key] = p.get(param);
  });
  if (!['card', 'paylater'].includes(filters.mode)) filters.mode = 'card';
  return { filters, dealId: p.get('deal') };
}

function writeUrl(filters, dealId) {
  const p = new URLSearchParams();
  Object.entries(URL_KEYS).forEach(([key, param]) => {
    if (filters[key] && filters[key] !== DEFAULT_FILTERS[key]) p.set(param, filters[key]);
  });
  if (dealId) p.set('deal', dealId);
  const qs = p.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}

/** Returns `value` only after it has stopped changing for `delay` ms. */
function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const EMPTY_RESULTS = { key: null, items: [], total: 0, page: 1, pages: 1, loadingMore: false, error: null };

export default function App() {
  const [initial] = useState(readUrl); // read the URL once, on first render
  const [filters, setFilters] = useState(initial.filters);
  const [meta, setMeta] = useState(null);
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { toasts, showToast } = useToast();

  const search = useDebounced(filters.search, 300);
  const query = { ...filters, search };
  // Results remember which query they belong to; if that isn't the current
  // query, a request is in flight — so "loading" is derived, not stored.
  const queryKey = JSON.stringify([filters.mode, filters.category, filters.provider, filters.cardType, filters.sort, search, reloadKey]);
  const loading = results.key !== queryKey;

  // ── Filter options + headline stats (once) ────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    fetchMeta(ctrl.signal).then(setMeta).catch(() => {});
    return () => ctrl.abort();
  }, []);

  // ── First page whenever a filter changes; stale requests are aborted ──────
  useEffect(() => {
    const ctrl = new AbortController();
    fetchDeals({ ...query, page: 1, limit: PAGE_SIZE }, ctrl.signal)
      .then((data) => setResults({ ...EMPTY_RESULTS, ...data, key: queryKey }))
      .catch((err) => {
        if (err.name !== 'AbortError') setResults({ ...EMPTY_RESULTS, key: queryKey, error: err.message });
      });
    return () => ctrl.abort();
    // queryKey captures every input of `query`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  // ── Open a shared ?deal=<id> link ─────────────────────────────────────────
  useEffect(() => {
    if (!initial.dealId) return;
    fetchDeal(initial.dealId)
      .then(setSelected)
      .catch(() => showToast('That offer is no longer available', 'error'));
  }, [initial.dealId, showToast]);

  useEffect(() => {
    writeUrl(filters, selected?._id);
  }, [filters, selected]);

  const updateFilters = useCallback((patch) => setFilters((f) => ({ ...f, ...patch })), []);

  const changeMode = useCallback((mode) => {
    // Provider and card type differ between the two modes, so start them fresh
    setFilters((f) => ({ ...f, mode, provider: '', cardType: '' }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters((f) => ({ ...DEFAULT_FILTERS, mode: f.mode }));
  }, []);

  const loadMore = async () => {
    setResults((r) => ({ ...r, loadingMore: true }));
    try {
      const data = await fetchDeals({ ...query, page: results.page + 1, limit: PAGE_SIZE });
      setResults((r) => ({ ...r, ...data, items: [...r.items, ...data.items], loadingMore: false }));
    } catch {
      setResults((r) => ({ ...r, loadingMore: false }));
      showToast('Could not load more offers', 'error');
    }
  };

  const shareDeal = useCallback((deal) => {
    const url = new URL(window.location.href);
    url.search = `?deal=${deal._id}`;
    if (!navigator.clipboard) return showToast('Copying is not supported in this browser', 'error');
    navigator.clipboard.writeText(url.toString())
      .then(() => showToast('Link copied', 'success'))
      .catch(() => showToast('Could not copy the link', 'error'));
  }, [showToast]);

  return (
    <div className="app">
      <a className="skip-link" href="#offers">Skip to offers</a>
      <Header mode={filters.mode} onModeChange={changeMode} lastUpdated={meta?.stats?.lastUpdated} />
      <Hero search={filters.search} onSearch={(v) => updateFilters({ search: v })} stats={meta?.stats} />

      <main id="offers" className="container main">
        <ModeTabs mode={filters.mode} counts={meta?.modes} onChange={changeMode} />
        <Filters mode={filters.mode} filters={filters} meta={meta} onChange={updateFilters} onReset={resetFilters} />
        <DealGrid
          state={{ ...results, loading }}
          onOpen={setSelected}
          onRetry={() => setReloadKey((k) => k + 1)}
          onReset={resetFilters}
          onLoadMore={loadMore}
        />
      </main>

      <Footer />
      <DealDetails deal={selected} onClose={() => setSelected(null)} onShare={shareDeal} />
      <Toast toasts={toasts} />
    </div>
  );
}
