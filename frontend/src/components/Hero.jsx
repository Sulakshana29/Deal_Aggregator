/**
 * Hero.jsx — new wallet-first pitch, quick search, and live stats.
 */
import Icon from './Icon';

export default function Hero({ search, onSearch, stats, onOpenWallet }) {
  const items = [
    { label: 'Live offers', value: stats?.live },
    { label: 'Banks & providers', value: stats?.providers },
    { label: 'Stores & brands', value: stats?.brands },
    { label: 'Ending this week', value: stats?.endingSoon },
  ];

  return (
    <section className="hero">
      <div className="container hero__inner">
        <div className="hero__pill">
          <Icon name="sparkles" size={14} />
          <span>Wallet-first card deal recommender</span>
        </div>

        <h1 className="hero__title">
          Which card saves you the most <span className="hero__accent">at checkout today?</span>
        </h1>
        <p className="hero__lead">
          Stop guessing discounts at supermarkets and restaurants. Add your cards to calculate exact rupee savings, compare bank offers, and find live deals in Sri Lanka.
        </p>

        <div className="hero__cta-group">
          <a href="#which-card" className="btn btn--primary hero__cta-btn">
            <Icon name="sparkles" size={16} /> Which Card Should I Use?
          </a>
          <button type="button" className="btn hero__cta-btn" onClick={onOpenWallet}>
            <Icon name="wallet" size={16} /> Set Up My Cards
          </button>
        </div>

        <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
          <Icon name="search" className="search__icon" />
          <label htmlFor="hero-search" className="sr-only">Search offers</label>
          <input
            id="hero-search"
            type="search"
            className="search__input"
            placeholder="Search a store, bank or food — e.g. Keells, Cargills, ComBank, pizza..."
            value={search}
            maxLength={100}
            onChange={(e) => onSearch(e.target.value)}
          />
        </form>

        <dl className="stats">
          {items.map((s) => (
            <div className="stats__item" key={s.label}>
              <dt className="stats__label">{s.label}</dt>
              <dd className="stats__value">{s.value ?? '–'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
