/**
 * FilterBar.jsx — v4 (E-Commerce Refinement Toolbar)
 */
import React, { useState } from 'react';

const SORT_OPTIONS = [
  { value: 'newest',   label: '⬆ Newest First' },
  { value: 'discount', label: '💰 Biggest Savings' },
  { value: 'expiring', label: '⏰ Expiring Soon' },
  { value: 'az',       label: '🔤 Brand A → Z' },
];

export default function FilterBar({
  search,      onSearch,
  bank,        onBank,
  category,    onCategory,
  cardType,    onCardType,
  offerType,   onOfferType,
  channel,     onChannel,
  sortBy,      onSortBy,
  showExpired, onShowExpired,
  banks,       categories,
  onReset,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasActiveFilter = search || bank || category || cardType || offerType || channel || showExpired;

  return (
    <div className="filter-toolbar" aria-label="Deal filtering and sorting">
      {/* Primary Row: Search + Sort + Show Expired + Clear */}
      <div className="filter-toolbar__primary">
        <div className="filter-toolbar__search">
          <span className="filter-toolbar__search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            placeholder="Search brand, bank or offer text..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Filter deals"
          />
          {search && (
            <button className="filter-toolbar__clear-search" onClick={() => onSearch('')}>✕</button>
          )}
        </div>

        <div className="filter-toolbar__controls">
          <select
            className="filter-toolbar__select"
            value={bank}
            onChange={(e) => onBank(e.target.value)}
            aria-label="Filter by bank"
          >
            <option value="">🏦 All Banks &amp; BNPL</option>
            {banks.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            className="filter-toolbar__select filter-toolbar__sort"
            value={sortBy}
            onChange={(e) => onSortBy(e.target.value)}
            aria-label="Sort deals"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            className={`filter-toolbar__toggle-btn ${showAdvanced ? 'filter-toolbar__toggle-btn--active' : ''}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▲ Less Filters' : '▼ More Filters'}
          </button>

          {hasActiveFilter && (
            <button
              className="filter-toolbar__reset-btn"
              onClick={onReset}
              aria-label="Reset filters"
            >
              ✕ Reset
            </button>
          )}
        </div>
      </div>

      {/* Secondary / Advanced Row */}
      {showAdvanced && (
        <div className="filter-toolbar__secondary">
          <div className="filter-toolbar__field">
            <label>Card Type:</label>
            <select
              className="filter-toolbar__select-sm"
              value={cardType}
              onChange={(e) => onCardType(e.target.value)}
            >
              <option value="">💳 Any Card</option>
              <option value="credit">💳 Credit Cards Only</option>
              <option value="debit">🏧 Debit Cards Only</option>
              <option value="both">💳🏧 Both Accepted</option>
            </select>
          </div>

          <div className="filter-toolbar__field">
            <label>Offer Type:</label>
            <select
              className="filter-toolbar__select-sm"
              value={offerType}
              onChange={(e) => onOfferType(e.target.value)}
            >
              <option value="">🏷 All Offer Types</option>
              <option value="percentage_discount">% Discount</option>
              <option value="cashback">💰 Cashback</option>
              <option value="instalment">📅 0% Instalment</option>
              <option value="bogo">🎁 Buy 1 Get 1</option>
              <option value="flat_discount">🏷 Flat Discount</option>
            </select>
          </div>

          <div className="filter-toolbar__field">
            <label>Channel:</label>
            <select
              className="filter-toolbar__select-sm"
              value={channel}
              onChange={(e) => onChannel(e.target.value)}
            >
              <option value="">🌐 Online &amp; In-Store</option>
              <option value="online">🌐 Online Only</option>
              <option value="instore">🏪 In-Store Only</option>
            </select>
          </div>

          <label className="filter-toolbar__checkbox">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => onShowExpired(e.target.checked)}
            />
            <span>Show Expired Offers</span>
          </label>
        </div>
      )}
    </div>
  );
}
