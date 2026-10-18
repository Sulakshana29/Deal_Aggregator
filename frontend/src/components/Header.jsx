/**
 * Header.jsx — brand identity, quick navigation, wallet shortcut, and data freshness.
 */
import Icon from './Icon';
import { timeAgo } from '../lib/format';

export default function Header({ walletCount = 0, onOpenWallet, lastUpdated }) {
  return (
    <header className="header">
      <div className="container header__inner">
        <a className="brand" href="/" aria-label="DealVault home">
          <span className="brand__mark" aria-hidden="true"><Icon name="tag" size={18} /></span>
          <span className="brand__name">DealVault</span>
        </a>

        <nav className="header__nav" aria-label="Main Navigation">
          <a href="#which-card" className="header__link">
            <Icon name="sparkles" size={14} /> Which card?
          </a>
          <a href="#offers" className="header__link">
            <Icon name="tag" size={14} /> All deals
          </a>
        </nav>

        <div className="header__actions">
          <button
            type="button"
            className="btn btn--ghost header__wallet-btn"
            onClick={onOpenWallet}
            aria-label="Open card wallet"
          >
            <Icon name="wallet" size={16} />
            <span className="header__wallet-text">My Wallet</span>
            <span className="header__wallet-badge">{walletCount}</span>
          </button>

          <p className="header__status" title={lastUpdated ? new Date(lastUpdated).toLocaleString() : undefined}>
            <span className="status-dot" aria-hidden="true" />
            <span className="status-text">Updated {timeAgo(lastUpdated)}</span>
          </p>
        </div>
      </div>
    </header>
  );
}
