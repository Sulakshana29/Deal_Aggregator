/**
 * Filters.jsx — category chips, smart quick-toggles (Valid Today, My Wallet Only),
 * provider, offer type, card type, and sort controls.
 */
import Icon from './Icon';

const SORTS = [
  { id: 'ending', label: 'Ending soonest' },
  { id: 'discount', label: 'Biggest discount' },
  { id: 'newest', label: 'Newest' },
];

export default function Filters({
  filters,
  meta,
  wallet,
  onChange,
  onReset,
  onOpenWallet,
}) {
  const categories = meta?.categories || [];
  const banks = (meta?.providers || []).filter((p) => p.type === 'bank');
  const bnpl = (meta?.providers || []).filter((p) => p.type === 'bnpl');
  const hasActive =
    filters.category ||
    filters.provider ||
    filters.cardType ||
    filters.search ||
    filters.day ||
    filters.walletOnly ||
    (filters.mode && filters.mode !== 'all');

  const todayLabel = meta?.today ? `Valid Today (${meta.today})` : 'Valid Today';

  return (
    <div className="filters">
      {/* Category chips row */}
      <div className="chips-wrapper">
        <div className="chips" role="group" aria-label="Category">
          <button
            type="button"
            className={`chip ${!filters.category ? 'is-active' : ''}`}
            aria-pressed={!filters.category}
            onClick={() => onChange({ category: '' })}
          >
            All categories
          </button>
          {categories.map((c) => (
            <button
              type="button"
              key={c.name}
              className={`chip ${filters.category === c.name ? 'is-active' : ''}`}
              aria-pressed={filters.category === c.name}
              onClick={() => onChange({ category: filters.category === c.name ? '' : c.name })}
            >
              {c.name} ({c.count})
            </button>
          ))}
        </div>
      </div>

      {/* Smart Quick-Action Toggles (My Wallet & Valid Today) */}
      <div className="filters__quick-bar">
        <div className="quick-toggles">
          <button
            type="button"
            className={`toggle-chip ${filters.walletOnly ? 'is-active' : ''}`}
            onClick={() => {
              if (wallet.length === 0 && !filters.walletOnly) {
                onOpenWallet();
              } else {
                onChange({ walletOnly: !filters.walletOnly });
              }
            }}
            aria-pressed={Boolean(filters.walletOnly)}
          >
            <Icon name="wallet" size={15} />
            <span>Only My Cards</span>
            {wallet.length > 0 && <span className="toggle-count">{wallet.length}</span>}
          </button>

          <button
            type="button"
            className={`toggle-chip ${filters.day === 'today' ? 'is-active' : ''}`}
            onClick={() => onChange({ day: filters.day === 'today' ? '' : 'today' })}
            aria-pressed={filters.day === 'today'}
          >
            <Icon name="calendar" size={15} />
            <span>{todayLabel}</span>
          </button>
        </div>

        <button
          type="button"
          className="btn btn--ghost btn--sm manage-wallet-btn"
          onClick={onOpenWallet}
        >
          <Icon name="sliders" size={14} />
          <span>Manage Wallet ({wallet.length})</span>
        </button>
      </div>

      {/* Filter selects row */}
      <div className="filters__row">
        {/* Offer Type selector: All / Discounts / 0% Instalments */}
        <label className="select">
          <span className="select__label"><Icon name="tag" size={15} /> Offer type</span>
          <select
            value={filters.mode || 'all'}
            onChange={(e) => onChange({ mode: e.target.value === 'all' ? '' : e.target.value })}
          >
            <option value="all">All Offers (Discounts &amp; Instalments)</option>
            <option value="card">Card Discounts Only</option>
            <option value="paylater">0% Instalments / Pay Later Only</option>
          </select>
        </label>

        {/* Bank / Provider */}
        <label className="select">
          <span className="select__label"><Icon name="bank" size={15} /> Bank / Provider</span>
          <select value={filters.provider} onChange={(e) => onChange({ provider: e.target.value })}>
            <option value="">All Banks &amp; Providers</option>
            {banks.length > 0 && (
              <optgroup label="Banks">
                {banks.map((p) => (
                  <option key={p.name} value={p.name}>{p.name} ({p.count})</option>
                ))}
              </optgroup>
            )}
            {bnpl.length > 0 && (
              <optgroup label="Pay later">
                {bnpl.map((p) => (
                  <option key={p.name} value={p.name}>{p.name} ({p.count})</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        {/* Card type */}
        <label className="select">
          <span className="select__label"><Icon name="card" size={15} /> Card type</span>
          <select value={filters.cardType} onChange={(e) => onChange({ cardType: e.target.value })}>
            <option value="">Any card (Credit &amp; Debit)</option>
            <option value="credit">Credit card</option>
            <option value="debit">Debit card</option>
          </select>
        </label>

        {/* Sort */}
        <label className="select">
          <span className="select__label"><Icon name="sliders" size={15} /> Sort by</span>
          <select value={filters.sort} onChange={(e) => onChange({ sort: e.target.value })}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>

        {hasActive && (
          <button type="button" className="btn btn--ghost filters__reset" onClick={onReset}>
            <Icon name="x" size={15} /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
