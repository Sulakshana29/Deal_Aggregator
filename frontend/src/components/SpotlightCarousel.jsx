/**
 * SpotlightCarousel.jsx
 *
 * Featured E-Commerce spotlight row for high-savings & stackable deals.
 * Gives visitors immediate visibility into top offers.
 */
import React from 'react';

function getBrandAvatar(brand) {
  const b = (brand || 'Store').trim();
  const initials = b
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'LK';

  const charCode = b.charCodeAt(0) + (b.length > 1 ? b.charCodeAt(1) : 0);
  const gradients = [
    'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
    'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
    'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
  ];
  return { initials, gradient: gradients[charCode % gradients.length] };
}

export default function SpotlightCarousel({ deals, onSelectDeal }) {
  const spotlightDeals = deals
    .filter((d) => !d._isExpired)
    .sort((a, b) => {
      if (a.isStackable && !b.isStackable) return -1;
      if (!a.isStackable && b.isStackable) return 1;
      return (b.discountValue || 0) - (a.discountValue || 0);
    })
    .slice(0, 3);

  if (spotlightDeals.length === 0) return null;

  return (
    <section className="spotlight" aria-label="Featured Spotlight Deals">
      <div className="spotlight__header">
        <div className="spotlight__header-left">
          <span className="spotlight__icon">🔥</span>
          <h2 className="spotlight__title">Featured Spotlight Offers</h2>
        </div>
        <span className="spotlight__subtitle">Hand-picked top card discounts &amp; stackable BNPL savings</span>
      </div>

      <div className="spotlight__grid">
        {spotlightDeals.map((deal) => {
          const avatar = getBrandAvatar(deal.brand);
          return (
            <div
              key={deal._id}
              className="spotlight-card"
              onClick={() => onSelectDeal(deal)}
            >
              <div className="spotlight-card__top">
                <div className="spotlight-card__brand-wrap">
                  <div
                    className="spotlight-card__avatar"
                    style={{ background: avatar.gradient }}
                    aria-hidden="true"
                  >
                    {avatar.initials}
                  </div>
                  <span className="spotlight-card__brand">{deal.brand}</span>
                </div>
                {deal.isStackable ? (
                  <span className="spotlight-card__stack-badge">⚡ Stackable</span>
                ) : (
                  <span className="spotlight-card__bank-badge">{deal.bank}</span>
                )}
              </div>

              <h3 className="spotlight-card__discount">{deal.discountText}</h3>

              <div className="spotlight-card__footer">
                <div className="spotlight-card__meta">
                  <span className="spotlight-card__provider">🏦 {deal.bank}</span>
                  <span className="spotlight-card__category">🗂 {deal.category}</span>
                </div>
                <span className="spotlight-card__cta">View Offer →</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
