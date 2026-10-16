/**
 * ModeTabs.jsx — the main split of the catalogue: bank card discounts vs. pay-later.
 * Each tab explains in one line what it contains, so the two are never confused.
 */
import Icon from './Icon';

const MODES = [
  {
    id: 'card',
    icon: 'card',
    title: 'Card offers',
    hint: 'Discounts, cashback & deals when you pay with a bank card',
  },
  {
    id: 'paylater',
    icon: 'wallet',
    title: 'Pay later',
    hint: 'Koko, Mintpay and 0% instalment plans — split the cost',
  },
];

export default function ModeTabs({ mode, counts, onChange }) {
  return (
    <div className="modes" role="tablist" aria-label="Offer type">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={mode === m.id}
          className={`modes__tab ${mode === m.id ? 'is-active' : ''}`}
          onClick={() => onChange(m.id)}
        >
          <span className="modes__icon"><Icon name={m.icon} size={20} /></span>
          <span className="modes__text">
            <span className="modes__title">
              {m.title}
              {counts && <span className="modes__count">{counts[m.id] ?? 0}</span>}
            </span>
            <span className="modes__hint">{m.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
