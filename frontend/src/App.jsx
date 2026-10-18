/**
 * App.jsx — page layout, wallet state, and recommender flow.
 *
 * Implements Option A (wallet-first experience):
 * - Browser localStorage wallet (no login needed)
 * - "Which card should I use?" smart store calculator
 * - Single unified deal feed with "Only My Cards" and "Valid Today" filters
 * - Shareable filter state in URL
 */
import { useCallback, useEffect, useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import BestCardSection from './components/BestCardSection';
import Filters from './components/Filters';
import DealGrid from './components/DealGrid';
import DealDetails from './components/DealDetails';
import WalletModal from './components/WalletModal';
import Footer from './components/Footer';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';
import { fetchDeal, fetchDeals, fetchMeta } from './api';
import { getWallet, saveWallet, serializeWallet } from './lib/wallet';

const PAGE_SIZE = 24;
const DEFAULT_FILTERS = {
  mode: '',
  category: '',
  provider: '',
  cardType: '',
  day: '',
  walletOnly: false,
  sort: 'ending',
  search: '',
};

const URL_KEYS = {
  mode: 'mode',
  category: 'category',
  provider: 'provider',
  cardType: 'card',
  day: 'day',
  walletOnly: 'walletOnly',
  sort: 'sort',
  search: 'q',
};

function readUrl() {
  const p = new URLSearchParams(window.location.search);
  const filters = { ...DEFAULT_FILTERS };
  Object.entries(URL_KEYS).forEach(([key, param]) => {
    const val = p.get(param);
    if (val) {
      if (key === 'walletOnly') filters[key] = val === 'true';
      else filters[key] = val;
    }
  });
  return { filters, dealId: p.get('deal') };
}

function writeUrl(filters, dealId) {
  const p = new URLSearchParams();
  Object.entries(URL_KEYS).forEach(([key, param]) => {
    if (filters[key] && filters[key] !== DEFAULT_FILTERS[key]) {
      p.set(param, String(filters[key]));
    }
  });
  if (dealId) p.set('deal', dealId);
  const qs = p.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}

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
  const [initial] = useState(readUrl);
  const [filters, setFilters] = useState(initial.filters);
  const [meta, setMeta] = useState(null);
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Wallet state stored locally in the browser
  const [wallet, setWallet] = useState(getWallet);
  const [isWalletOpen, setIsWalletOpen] = useState(false);

  const { toasts, showToast } = useToast();

  const handleSaveWallet = (updatedCards) => {
    setWallet(updatedCards);
    saveWallet(updatedCards);
  };

  const search = useDebounced(filters.search, 300);

  // Build API query parameters
  const queryParams = {
    mode: filters.mode || undefined,
    category: filters.category || undefined,
    provider: filters.provider || undefined,
    cardType: filters.cardType || undefined,
    day: filters.day || undefined,
    search: search || undefined,
    sort: filters.sort || 'ending',
    wallet: filters.walletOnly && wallet.length > 0 ? serializeWallet(wallet) : undefined,
  };

  const queryKey = JSON.stringify([
    filters.mode,
    filters.category,
    filters.provider,
    filters.cardType,
    filters.day,
    filters.walletOnly,
    serializeWallet(wallet),
    filters.sort,
    search,
    reloadKey,
  ]);

  const loading = results.key !== queryKey;

  // ── Fetch metadata (categories, providers, stats, brands, today) ───────────
  useEffect(() => {
    const ctrl = new AbortController();
    fetchMeta(ctrl.signal).then(setMeta).catch(() => {});
    return () => ctrl.abort();
  }, []);

  // ── Fetch deals on filter changes ─────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    fetchDeals({ ...queryParams, page: 1, limit: PAGE_SIZE }, ctrl.signal)
      .then((data) => setResults({ ...EMPTY_RESULTS, ...data, key: queryKey }))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setResults({ ...EMPTY_RESULTS, key: queryKey, error: err.message });
        }
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  // ── Handle direct deep links (?deal=<id>) ─────────────────────────────────
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

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const loadMore = async () => {
    setResults((r) => ({ ...r, loadingMore: true }));
    try {
      const data = await fetchDeals({ ...queryParams, page: results.page + 1, limit: PAGE_SIZE });
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
      <a className="skip-link" href="#which-card">Skip to card recommender</a>
      <Header
        walletCount={wallet.length}
        onOpenWallet={() => setIsWalletOpen(true)}
        lastUpdated={meta?.stats?.lastUpdated}
      />

      <Hero
        search={filters.search}
        onSearch={(v) => updateFilters({ search: v })}
        stats={meta?.stats}
        onOpenWallet={() => setIsWalletOpen(true)}
      />

      <main className="container main">
        <div id="which-card">
          <BestCardSection
            meta={meta}
            wallet={wallet}
            onOpenWallet={() => setIsWalletOpen(true)}
            onOpenDeal={setSelected}
          />
        </div>

        <section id="offers" className="offers-section" aria-label="All Deals and Promotions">
          <div className="section-head">
            <h2 className="section-title">
              {filters.walletOnly ? 'Deals For Your Wallet Cards' : 'Browse All Deals & Promotions'}
            </h2>
            <p className="section-subtitle">
              {filters.walletOnly
                ? `Showing offers matching your ${wallet.length} saved card${wallet.length === 1 ? '' : 's'}`
                : 'Explore live discounts, grocery offers, restaurant deals, and 0% instalment plans.'}
            </p>
          </div>

          <Filters
            filters={filters}
            meta={meta}
            wallet={wallet}
            onChange={updateFilters}
            onReset={resetFilters}
            onOpenWallet={() => setIsWalletOpen(true)}
          />

          <DealGrid
            state={{ ...results, loading }}
            wallet={wallet}
            onOpen={setSelected}
            onRetry={() => setReloadKey((k) => k + 1)}
            onReset={resetFilters}
            onLoadMore={loadMore}
          />
        </section>
      </main>

      <Footer />

      <DealDetails deal={selected} onClose={() => setSelected(null)} onShare={shareDeal} />

      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        wallet={wallet}
        onSaveWallet={handleSaveWallet}
        meta={meta}
        onToast={showToast}
      />

      <Toast toasts={toasts} />
    </div>
  );
}
