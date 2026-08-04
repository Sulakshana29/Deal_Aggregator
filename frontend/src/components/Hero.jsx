/**
 * Hero.jsx
 *
 * High-impact E-Commerce hero banner featuring:
 *   - Glowing live announcement badge
 *   - Clear value proposition headline & subtitle
 *   - Integrated Hero Search bar
 *   - Popular search keyword tags for 1-click filtering
 *   - Live platform metrics showcase
 */
import React from 'react';

const POPULAR_SEARCHES = [
  { label: '🛒 Cargills Food City', query: 'Cargills' },
  { label: '🍕 Dining Offers',       query: 'Dining' },
  { label: '⚡ Koko 0% Instalment',  query: 'Koko' },
  { label: '🔄 Mintpay',             query: 'Mintpay' },
  { label: '👗 Fashion Bug',         query: 'Fashion Bug' },
  { label: '💻 Electronics',         query: 'Electronics' },
];

export default function Hero({ search, onSearch, activeCount, supportedBanksCount, bnplCount, uniqueBrandsCount }) {
  return (
    <section className="hero">
      <div className="hero__glow hero__glow--1" aria-hidden="true" />
      <div className="hero__glow hero__glow--2" aria-hidden="true" />

      <div className="hero__content">
        {/* Live Announcement Badge */}
        <div className="hero__badge">
          <span className="hero__badge-pill">NEW</span>
          <span className="hero__badge-text">Premium Deal Aggregation Engine</span>
        </div>

        {/* Main Headline */}
        <h1 className="hero__title">
          Every Bank Card Discount &amp; <br />
          <span className="hero__title-highlight">0% BNPL Offer</span> in One Place.
        </h1>

        {/* Subtitle */}
        <p className="hero__subtitle">
          Stop hopping across 10 different bank websites. Discover stackable card promos,
          instant cashback, and 0% interest instalments from Sri Lanka's top banks and BNPL providers.
        </p>

        {/* Hero Search Box */}
        <div className="hero__search-container">
          <div className="hero__search-box">
            <span className="hero__search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="hero__search-input"
              placeholder="Search merchants, bank cards, Koko, Mintpay or categories..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              aria-label="Search deals across Sri Lanka"
            />
            {search && (
              <button
                className="hero__search-clear"
                onClick={() => onSearch('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Popular Keyword Tags */}
        <div className="hero__popular">
          <span className="hero__popular-label">Trending Searches:</span>
          <div className="hero__popular-tags">
            {POPULAR_SEARCHES.map((item) => (
              <button
                key={item.label}
                className="hero__popular-tag"
                onClick={() => onSearch(item.query)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Key Platform Stats */}
        <div className="hero__stats">
          <div className="hero__stat-card">
            <span className="hero__stat-icon" aria-hidden="true">⚡</span>
            <span className="hero__stat-value">{activeCount || 0}</span>
            <span className="hero__stat-label">Live Offers</span>
          </div>
          <div className="hero__stat-card">
            <span className="hero__stat-icon" aria-hidden="true">🏦</span>
            <span className="hero__stat-value">{supportedBanksCount || 0}</span>
            <span className="hero__stat-label">Supported Banks</span>
          </div>
          <div className="hero__stat-card">
            <span className="hero__stat-icon" aria-hidden="true">🛍️</span>
            <span className="hero__stat-value">{bnplCount || 0}</span>
            <span className="hero__stat-label">BNPL Partners</span>
          </div>
          <div className="hero__stat-card">
            <span className="hero__stat-icon" aria-hidden="true">🌟</span>
            <span className="hero__stat-value">{uniqueBrandsCount || 0}</span>
            <span className="hero__stat-label">Brands</span>
          </div>
        </div>
      </div>
    </section>
  );
}
