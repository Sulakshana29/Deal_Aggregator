/**
 * Filters.jsx — category chips plus provider / card type / sort selects.
 * Options and counts come from /deals/meta, so filters never offer an empty choice.
 */
import Icon from './Icon';

const SORTS = [
  { id: 'ending', label: 'Ending soonest' },
  { id: 'discount', label: 'Biggest discount' },
  { id: 'newest', label: 'Newest' },
];

export default function Filters({ mode, filters, meta, onChange, onReset }) {
  const categories = meta?.categories || [];
  const banks = (meta?.providers || []).filter((p) => p.type === 'bank');
  const bnpl = (meta?.providers || []).filter((p) => p.type === 'bnpl');
  const hasActive = filters.category || filters.provider || filters.cardType || filters.search;

  return (
    <div className="filters">
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
            {c.name}
          </button>
        ))}
      </div>

      <div className="filters__row">
        <label className="select">
          <span className="select__label"><Icon name="bank" size={15} /> Bank / provider</span>
          <select value={filters.provider} onChange={(e) => onChange({ provider: e.target.value })}>
            <option value="">All</option>
            {banks.length > 0 && (
              <optgroup label="Banks">
                {banks.map((p) => <option key={p.name} value={p.name}>{p.name} ({p.count})</option>)}
              </optgroup>
            )}
            {bnpl.length > 0 && (
              <optgroup label="Pay later">
                {bnpl.map((p) => <option key={p.name} value={p.name}>{p.name} ({p.count})</option>)}
              </optgroup>
            )}
          </select>
        </label>

        {mode === 'card' && (
          <label className="select">
            <span className="select__label"><Icon name="card" size={15} /> Card type</span>
            <select value={filters.cardType} onChange={(e) => onChange({ cardType: e.target.value })}>
              <option value="">Any card</option>
              <option value="credit">Credit card</option>
              <option value="debit">Debit card</option>
            </select>
          </label>
        )}

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
