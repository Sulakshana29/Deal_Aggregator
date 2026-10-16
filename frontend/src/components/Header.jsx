/**
 * Header.jsx — brand, the two browsing modes, and data freshness.
 */
import Icon from './Icon';
import { timeAgo } from '../lib/format';

export default function Header({ mode, onModeChange, lastUpdated }) {
  return (
    <header className="header">
      <div className="container header__inner">
        <a className="brand" href="/" aria-label="DealVault home">
          <span className="brand__mark" aria-hidden="true"><Icon name="tag" size={18} /></span>
          <span className="brand__name">DealVault</span>
        </a>

        <nav className="header__nav" aria-label="Offer type">
          <button
            type="button"
            className={`header__link ${mode === 'card' ? 'is-active' : ''}`}
            aria-current={mode === 'card' ? 'page' : undefined}
            onClick={() => onModeChange('card')}
          >
            Card offers
          </button>
          <button
            type="button"
            className={`header__link ${mode === 'paylater' ? 'is-active' : ''}`}
            aria-current={mode === 'paylater' ? 'page' : undefined}
            onClick={() => onModeChange('paylater')}
          >
            Pay later
          </button>
        </nav>

        <p className="header__status" title={lastUpdated ? new Date(lastUpdated).toLocaleString() : undefined}>
          <span className="status-dot" aria-hidden="true" />
          Updated {timeAgo(lastUpdated)}
        </p>
      </div>
    </header>
  );
}
