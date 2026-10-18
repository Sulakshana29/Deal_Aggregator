import { useState, useEffect } from 'react';
import Icon from './Icon';
import { fetchBest } from '../api';
import { serializeWallet } from '../lib/wallet';
import { formatLKR, brandHue, initials } from '../lib/format';

export default function BestCardSection({ meta, wallet, onOpenWallet, onOpenDeal }) {
  const [selectedBrand, setSelectedBrand] = useState('');
  const [bill, setBill] = useState('');
  const [onlyToday, setOnlyToday] = useState(false);
  const [results, setResults] = useState(null);

  const brands = meta?.brands || [];
  const topBrands = brands.slice(0, 15);

  const queryKey = JSON.stringify([selectedBrand, bill, onlyToday, serializeWallet(wallet)]);
  const loading = Boolean(selectedBrand) && results?.key !== queryKey;
  const error = results?.error || null;

  const handleBrandChange = (e) => {
    setSelectedBrand(e.target.value);
  };

  useEffect(() => {
    if (!selectedBrand) return;

    const ctrl = new AbortController();
    const params = {
      brand: selectedBrand,
      bill: bill ? String(bill) : undefined,
      wallet: serializeWallet(wallet),
      day: onlyToday ? 'today' : undefined,
    };

    fetchBest(params, ctrl.signal)
      .then((data) => {
        setResults({ ...data, key: queryKey });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setResults({ key: queryKey, error: err.message, items: [] });
        }
      });

    return () => ctrl.abort();
  }, [selectedBrand, bill, onlyToday, wallet, queryKey]);

  const setPresetBill = (amount) => {
    setBill(String(amount));
  };

  return (
    <section className="best-card-section" aria-label="Which card should I use?">
      <div className="best-card-panel">
        <div className="best-card-header">
          <div className="best-card-badge">
            <Icon name="sparkles" size={16} />
            <span>Smart Card Recommender</span>
          </div>
          <h2 className="best-card-title">Which card saves me the most at checkout?</h2>
          <p className="best-card-subtitle">
            Pick a store and your bill amount. We&apos;ll rank every offer, apply caps &amp; conditions, and show the exact saving for your wallet.
          </p>
        </div>

        {/* Inputs */}
        <div className="best-card-controls">
          <div className="best-card-field">
            <label className="select" htmlFor="best-card-store">
              <span className="select__label"><Icon name="store" size={15} /> Select Store</span>
              <select
                id="best-card-store"
                value={selectedBrand}
                onChange={handleBrandChange}
              >
                <option value="">Choose a store (e.g. Cargills, Glomark, Keells)...</option>
                {topBrands.map((b) => (
                  <option key={b.name} value={b.name}>{b.name} ({b.count} offers)</option>
                ))}
              </select>
            </label>
          </div>

          <div className="best-card-field">
            <label className="select" htmlFor="best-card-bill">
              <span className="select__label"><Icon name="tag" size={15} /> Bill Amount (LKR)</span>
              <input
                id="best-card-bill"
                type="number"
                min="0"
                step="100"
                placeholder="e.g. 5000"
                className="best-card-input"
                value={bill}
                onChange={(e) => setBill(e.target.value)}
              />
            </label>
            <div className="bill-presets">
              {[2500, 5000, 10000, 20000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`bill-preset-chip ${bill === String(amt) ? 'is-active' : ''}`}
                  onClick={() => setPresetBill(amt)}
                >
                  {formatLKR(amt)}
                </button>
              ))}
            </div>
          </div>

          <div className="best-card-options">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={onlyToday}
                onChange={(e) => setOnlyToday(e.target.checked)}
              />
              <span>Valid today only {meta?.today ? `(${meta.today})` : ''}</span>
            </label>

            <button
              type="button"
              className="btn btn--ghost btn--sm wallet-quick-btn"
              onClick={onOpenWallet}
            >
              <Icon name="wallet" size={15} />
              <span>Wallet: {wallet.length} card{wallet.length === 1 ? '' : 's'}</span>
            </button>
          </div>
        </div>

        {/* Results Area */}
        {loading && (
          <div className="best-card-loading">
            <span className="status-dot pulse" />
            <span>Calculating best card discounts...</span>
          </div>
        )}

        {error && (
          <div className="notice notice--error">
            <Icon name="alert" size={18} />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && results && results.items && (
          <div className="best-card-results">
            {results.items.length === 0 ? (
              <div className="notice">
                <Icon name="search" size={18} />
                <div>
                  <p className="notice__title">No offers found at {selectedBrand} {onlyToday ? 'valid today' : ''}</p>
                  <p className="notice__text">Try unchecking &quot;Valid today only&quot; or choose another store.</p>
                </div>
              </div>
            ) : (
              <div className="ranked-cards-list">
                {results.items.map((item, index) => {
                  const isTop = index === 0 && item.calculation.saving > 0;
                  const inWallet = item.walletMatch?.inWallet;

                  return (
                    <article
                      key={item._id}
                      className={`ranked-card ${isTop ? 'ranked-card--top' : ''} ${inWallet ? 'ranked-card--in-wallet' : ''}`}
                    >
                      <div className="ranked-card__rank">
                        {isTop ? (
                          <span className="rank-badge rank-badge--winner">
                            <Icon name="sparkles" size={14} /> #1 Best
                          </span>
                        ) : (
                          <span className="rank-badge">#{index + 1}</span>
                        )}
                      </div>

                      <div className="ranked-card__body">
                        <div className="ranked-card__top">
                          <span className="avatar avatar--sm" style={{ '--hue': brandHue(item.bank) }}>
                            {initials(item.bank)}
                          </span>
                          <div className="ranked-card__bank">
                            <strong>{item.bank}</strong>
                            <span className="ranked-card__type">
                              {item.cardType === 'both' ? 'Credit & Debit' : `${item.cardType} cards`}
                            </span>
                          </div>

                          {inWallet ? (
                            <span className="badge badge--wallet-owned">
                              <Icon name="check" size={12} /> In Your Wallet
                            </span>
                          ) : (
                            <span className="badge badge--not-owned">Not in wallet</span>
                          )}
                        </div>

                        <p className="ranked-card__benefit">{item.discountText}</p>

                        <div className="ranked-card__saving-box">
                          {item.calculation.eligible && item.calculation.saving > 0 ? (
                            <div className="saving-amount">
                              <span className="saving-label">Estimated Saving:</span>
                              <strong className="saving-val">{formatLKR(item.calculation.saving)}</strong>
                            </div>
                          ) : item.calculation.isPerk ? (
                            <div className="saving-amount saving-amount--perk">
                              <span className="saving-label">Perk:</span>
                              <strong className="saving-val">{item.calculation.headline}</strong>
                            </div>
                          ) : (
                            <div className="saving-amount saving-amount--ineligible">
                              <span className="saving-label">Requires higher bill:</span>
                            </div>
                          )}
                          <p className="saving-reason">{item.calculation.reason}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn--ghost ranked-card__view-btn"
                        onClick={() => onOpenDeal(item)}
                      >
                        Details →
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
