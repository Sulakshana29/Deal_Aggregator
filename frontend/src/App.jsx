/**
 * App.jsx — v4 (Modern E-Commerce Website Architecture)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar            from './components/Navbar';
import Hero              from './components/Hero';
import SpotlightCarousel from './components/SpotlightCarousel';
import CategoryTabs      from './components/CategoryTabs';
import FilterBar         from './components/FilterBar';
import DealList          from './components/DealList';
import Footer            from './components/Footer';
import Toast             from './components/Toast';
import DealModal         from './components/DealModal';
import { useToast }      from './hooks/useToast';

const API_BASE = '/api';

// URL state helpers
function readParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    search:      p.get('q')        || '',
    bank:        p.get('bank')     || '',
    category:    p.get('category') || '',
    cardType:    p.get('cardType') || '',
    offerType:   p.get('offerType')|| '',
    channel:     p.get('channel')  || '',
    sortBy:      p.get('sort')     || 'newest',
    showExpired: p.get('expired')  === 'true',
  };
}

function pushParams(state) {
  const p = new URLSearchParams();
  if (state.search)              p.set('q',         state.search);
  if (state.bank)                p.set('bank',      state.bank);
  if (state.category)            p.set('category',  state.category);
  if (state.cardType)            p.set('cardType',  state.cardType);
  if (state.offerType)           p.set('offerType', state.offerType);
  if (state.channel)             p.set('channel',   state.channel);
  if (state.sortBy !== 'newest') p.set('sort',      state.sortBy);
  if (state.showExpired)         p.set('expired',   'true');
  const qs = p.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}

export default function App() {
  const [allDeals,    setAllDeals]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [banks,       setBanks]       = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Active section shortcut tab in Navbar ('all' | 'featured' | 'bnpl' | 'expiring')
  const [activeSection, setActiveSection] = useState('all');

  const initialParams = readParams();
  const [search,      setSearch]      = useState(initialParams.search);
  const [bank,        setBank]        = useState(initialParams.bank);
  const [category,    setCategory]    = useState(initialParams.category);
  const [cardType,    setCardType]    = useState(initialParams.cardType);
  const [offerType,   setOfferType]   = useState(initialParams.offerType);
  const [channel,     setChannel]     = useState(initialParams.channel);
  const [sortBy,      setSortBy]      = useState(initialParams.sortBy);
  const [showExpired, setShowExpired] = useState(initialParams.showExpired);

  const [adminMode, setAdminMode] = useState(false);
  const { toasts, showToast }     = useToast();

  const [selectedDeal, setSelectedDeal] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  useEffect(() => {
    pushParams({ search, bank, category, cardType, offerType, channel, sortBy, showExpired });
  }, [search, bank, category, cardType, offerType, channel, sortBy, showExpired]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [dealsRes, metaRes] = await Promise.all([
          fetch(`${API_BASE}/deals?all=true`),
          fetch(`${API_BASE}/deals/meta`),
        ]);
        if (!dealsRes.ok) throw new Error(`Deals API ${dealsRes.status}`);
        if (!metaRes.ok)  throw new Error(`Meta API ${metaRes.status}`);

        const dealsData = await dealsRes.json();
        const metaData  = await metaRes.json();

        const now = new Date();
        const tagged = dealsData.deals.map((d) => ({
          ...d,
          _isExpired: d.validUntil ? new Date(d.validUntil) < now : false,
        }));

        setAllDeals(tagged);
        setBanks(metaData.banks.sort());
        setCategories(metaData.categories.sort());

        const scraped = tagged.filter((d) => d.source === 'scraped' && d.lastVerified);
        if (scraped.length > 0) {
          const latest = new Date(Math.max(...scraped.map((d) => new Date(d.lastVerified))));
          setLastUpdated(latest);
        }
      } catch (err) {
        console.error('Failed to load data:', err.message);
        setError('Could not load deals. Please check if the API server is running on port 5000.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const activeCount  = useMemo(() => allDeals.filter((d) => !d._isExpired).length, [allDeals]);
  const scrapedCount = useMemo(() => allDeals.filter((d) => d.source === 'scraped').length, [allDeals]);

  const uniqueBrandsCount = useMemo(() => new Set(allDeals.map(d => d.brand)).size, [allDeals]);
  const bnplCount = useMemo(() => banks.filter(b => b.toLowerCase().includes('koko') || b.toLowerCase().includes('mintpay')).length || 2, [banks]);
  const supportedBanksCount = useMemo(() => Math.max(0, banks.length - bnplCount) || 12, [banks, bnplCount]);

  // Navbar section click handler
  const handleNavClick = (section) => {
    setActiveSection(section);
    if (section === 'all') {
      setBank(''); setCategory(''); setSearch(''); setSortBy('newest');
    } else if (section === 'featured') {
      setSortBy('discount');
    } else if (section === 'bnpl') {
      setBank('Koko');
    } else if (section === 'expiring') {
      setSortBy('expiring');
    }
    // Scroll smoothly to deals area
    const el = document.getElementById('catalog-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // Client-side filter + sort
  const filteredDeals = useMemo(() => {
    const q = search.toLowerCase();

    let results = allDeals.filter((deal) => {
      if (!showExpired && deal._isExpired) return false;

      const matchesSearch =
        !q ||
        deal.brand.toLowerCase().includes(q) ||
        deal.discountText.toLowerCase().includes(q) ||
        deal.bank.toLowerCase().includes(q) ||
        deal.category.toLowerCase().includes(q);

      const matchesBank     = !bank      || deal.bank === bank;
      const matchesCategory = !category  || deal.category === category;
      const matchesCardType = !cardType  || deal.cardType === cardType || deal.cardType === 'both';
      const matchesOfferType= !offerType || deal.offerType === offerType;
      const matchesChannel  = !channel   || deal.usageChannel === channel || deal.usageChannel === 'both';

      return matchesSearch && matchesBank && matchesCategory && matchesCardType && matchesOfferType && matchesChannel;
    });

    results = [...results].sort((a, b) => {
      if (sortBy === 'expiring') {
        if (!a.validUntil) return 1;
        if (!b.validUntil) return -1;
        return new Date(a.validUntil) - new Date(b.validUntil);
      }
      if (sortBy === 'discount') {
        return (b.discountValue || 0) - (a.discountValue || 0);
      }
      if (sortBy === 'az') {
        return a.brand.localeCompare(b.brand);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return results;
  }, [allDeals, search, bank, category, cardType, offerType, channel, sortBy, showExpired]);

  const handleToggleAdmin = () => {
    setAdminMode((v) => {
      const next = !v;
      showToast(next ? '🔓 Admin Mode Enabled — Delete buttons unlocked' : '🔒 Admin Mode Disabled', 'success');
      return next;
    });
  };

  const handleShare = useCallback((deal) => {
    const text = `${deal.brand} — ${deal.discountText} (${deal.bank})`;
    const url  = deal.scrapedFrom || window.location.href;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${text}\n${url}`)
        .then(() => showToast('Deal link copied to clipboard! 📋', 'success'))
        .catch(() => showToast('Could not copy automatically', 'error'));
    } else {
      showToast('Clipboard not supported in browser', 'error');
    }
  }, [showToast]);

  async function handleDelete(id) {
    setAllDeals((prev) => prev.filter((d) => d._id !== id));
    try {
      const res = await fetch(`${API_BASE}/deals/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      showToast('Deal permanently removed', 'success');
    } catch (err) {
      console.error('Delete error:', err.message);
      showToast('Delete failed — refreshing catalog...', 'error');
    }
  }

  const resetFilters = () => {
    setSearch(''); setBank(''); setCategory('');
    setCardType(''); setOfferType(''); setChannel('');
    setSortBy('newest'); setShowExpired(false);
  };

  function formatLastUpdated(date) {
    if (!date) return 'Just now';
    const diff = Math.floor((Date.now() - date) / 60000);
    if (diff < 1)  return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hrs = Math.floor(diff / 60);
    return `${hrs}h ago`;
  }

  return (
    <div className="ecommerce-app">
      <Navbar
        activeCount={activeCount}
        scrapedCount={scrapedCount}
        lastUpdated={lastUpdated}
        onNavClick={handleNavClick}
        activeSection={activeSection}
        adminMode={adminMode}
        onToggleAdmin={handleToggleAdmin}
        formatLastUpdated={formatLastUpdated}
      />

      {/* Hero Showcase Section */}
      <Hero
        search={search}
        onSearch={setSearch}
        activeCount={activeCount}
        supportedBanksCount={supportedBanksCount}
        bnplCount={bnplCount}
        uniqueBrandsCount={uniqueBrandsCount}
      />

      <main className="main-content" id="catalog-section">
        <div className="main-content__container">
          {/* Spotlight Carousel for Top Savings */}
          <SpotlightCarousel
            deals={allDeals}
            onSelectDeal={setSelectedDeal}
          />

          {/* Interactive Category Tabs */}
          <div className="catalog-header">
            <div className="catalog-header__top">
              <h2 className="catalog-title">Explore All Promotions</h2>
              <span className="catalog-count">
                Showing <strong>{filteredDeals.length}</strong> of {activeCount} live offers
              </span>
            </div>
            <CategoryTabs
              categories={categories}
              selectedCategory={category}
              onSelectCategory={setCategory}
            />
          </div>

          {/* E-Commerce Refinement Toolbar */}
          <FilterBar
            search={search}           onSearch={setSearch}
            bank={bank}               onBank={setBank}
            category={category}       onCategory={setCategory}
            cardType={cardType}       onCardType={setCardType}
            offerType={offerType}     onOfferType={setOfferType}
            channel={channel}         onChannel={setChannel}
            sortBy={sortBy}           onSortBy={setSortBy}
            showExpired={showExpired}   onShowExpired={setShowExpired}
            banks={banks}
            categories={categories}
            onReset={resetFilters}
          />

          {/* Deal Catalog Grid */}
          <DealList
            deals={filteredDeals}
            loading={loading}
            onDelete={handleDelete}
            onShare={handleShare}
            adminMode={adminMode}
            onReset={resetFilters}
            onSelect={setSelectedDeal}
          />
        </div>
      </main>

      {/* Professional Footer */}
      <Footer
        onBankClick={(b) => {
          setBank(b);
          const el = document.getElementById('catalog-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        onCategoryClick={(c) => {
          setCategory(c);
          const el = document.getElementById('catalog-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* E-Commerce Deal Modal Popup */}
      <DealModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />

      {/* Toast Popups */}
      <Toast toasts={toasts} />
    </div>
  );
}
