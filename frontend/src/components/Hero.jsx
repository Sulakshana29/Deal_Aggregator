/**
 * Hero.jsx — what the site is, a search box, and real numbers from /deals/meta.
 */
import Icon from './Icon';

export default function Hero({ search, onSearch, stats }) {
  const items = [
    { label: 'Live offers', value: stats?.live },
    { label: 'Banks & providers', value: stats?.providers },
    { label: 'Stores', value: stats?.brands },
    { label: 'Ending this week', value: stats?.endingSoon },
  ];

  return (
    <section className="hero">
      <div className="container hero__inner">
        <h1 className="hero__title">
          Every bank card offer in Sri Lanka, <span className="hero__accent">in one place.</span>
        </h1>
        <p className="hero__lead">
          Discounts, cashback and pay-later plans from Sri Lankan banks, Koko and Mintpay —
          collected from mypromo.lk and refreshed every 12 hours.
        </p>

        <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
          <Icon name="search" className="search__icon" />
          <label htmlFor="hero-search" className="sr-only">Search offers</label>
          <input
            id="hero-search"
            type="search"
            className="search__input"
            placeholder="Search a store, bank or offer — e.g. Keells, HNB, pizza"
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
