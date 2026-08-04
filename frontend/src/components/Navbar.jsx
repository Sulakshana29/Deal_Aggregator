/**
 * Navbar.jsx
 *
 * Modern sticky E-Commerce & Deal Aggregator navigation bar.
 * Features:
 *   - Glowing brand identity
 *   - Quick navigation shortcuts (All Deals, Featured, BNPL, Expiring Soon)
 *   - Live Scraper / System Status badge
 *   - Quick Admin mode unlock button
 */
import React from 'react';

export default function Navbar({
  activeCount,
  scrapedCount,
  lastUpdated,
  onNavClick,
  activeSection,
  adminMode,
  onToggleAdmin,
  formatLastUpdated,
}) {
  return (
    <header className="navbar">
      <div className="navbar__container">
        {/* Left: Logo & Brand identity */}
        <div className="navbar__brand" onClick={() => onNavClick('all')}>
          <div className="navbar__logo-icon">
            <span className="navbar__logo-emoji" aria-hidden="true">💳</span>
          </div>
          <div className="navbar__logo-text">
            <span className="navbar__title">DealVault</span>
            <span className="navbar__badge">LK PRO</span>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <nav className="navbar__nav" aria-label="Primary navigation">
          <button
            className={`navbar__link ${activeSection === 'all' ? 'navbar__link--active' : ''}`}
            onClick={() => onNavClick('all')}
          >
            All Offers
          </button>
          <button
            className={`navbar__link ${activeSection === 'featured' ? 'navbar__link--active' : ''}`}
            onClick={() => onNavClick('featured')}
          >
            🔥 Featured
          </button>
          <button
            className={`navbar__link ${activeSection === 'bnpl' ? 'navbar__link--active' : ''}`}
            onClick={() => onNavClick('bnpl')}
          >
            ⚡ BNPL Deals
          </button>
          <button
            className={`navbar__link ${activeSection === 'expiring' ? 'navbar__link--active' : ''}`}
            onClick={() => onNavClick('expiring')}
          >
            ⏰ Expiring Soon
          </button>
        </nav>

        {/* Right: Live System Status, Theme Toggle & Admin Toggle */}
        <div className="navbar__actions">
          {/* Live Status indicator */}
          <div className="navbar__status" title={`Last updated: ${formatLastUpdated(lastUpdated)}`}>
            <span className="navbar__status-dot" />
            <span className="navbar__status-text">
              <strong>{activeCount}</strong> Active • 🤖 <strong>{scrapedCount}</strong> Live
            </span>
          </div>

          {/* Admin mode toggle */}
          <button
            className={`navbar__admin-btn ${adminMode ? 'navbar__admin-btn--active' : ''}`}
            onClick={onToggleAdmin}
            title={adminMode ? 'Disable Admin Mode' : 'Enable Admin Mode'}
          >
            {adminMode ? '🔓 Admin On' : '🔒 Admin'}
          </button>
        </div>
      </div>
    </header>
  );
}
