/**
 * DealCard.jsx — v4 (Modern E-Commerce Promotion Card)
 *
 * Features:
 *  - Bold, high-contrast Discount Callout Box (e.g. "25% OFF")
 *  - Merchant brand prominence + Category badge
 *  - Clear Bank provider styling (custom colored badges for Koko, Mintpay, Banks)
 *  - Expiry countdown urgency indicator
 *  - Interactive "Claim Offer" / "View Deal" primary action button
 */
import React from 'react';

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function getDaysLeft(validUntil) {
  if (!validUntil) return { daysLeft: null, label: 'Ongoing', status: 'ongoing' };

  const now  = new Date();
  const end  = new Date(validUntil);
  const diff = Math.floor((end - now) / (1000 * 60 * 60 * 24));

  if (diff < 0)   return { daysLeft: diff, label: 'Expired', status: 'expired' };
  if (diff === 0) return { daysLeft: 0, label: 'Expires today!', status: 'urgent' };
  if (diff <= 7)  return { daysLeft: diff, label: `${diff}d left`, status: 'urgent' };
  if (diff <= 30) return { daysLeft: diff, label: `${diff}d left`, status: 'warning' };
  return { daysLeft: diff, label: `${diff}d left`, status: 'ok' };
}

function bankBadgeClass(bank) {
  const b = (bank || '').toLowerCase();
  if (b === 'koko')    return 'badge badge--koko';
  if (b === 'mintpay') return 'badge badge--mintpay';
  return 'badge badge--bank';
}

function getDiscountCallout(deal) {
  const text = (deal.discountText || '').toLowerCase();
  const bank = (deal.bank || '').toLowerCase();

  if (deal.offerType === 'percentage_discount' && deal.discountValue > 0) {
    return `${deal.discountValue}% OFF`;
  }
  if (deal.offerType === 'cashback' && deal.discountValue > 0) {
    return `${deal.discountValue}% CASHBACK`;
  }
  if (deal.offerType === 'bogo') {
    return 'BUY 1 GET 1';
  }
  if (deal.offerType === 'flat_discount' && deal.discountValue > 0) {
    return `RS. ${deal.discountValue.toLocaleString()} OFF`;
  }
  if (deal.offerType === 'instalment' || text.includes('instalment') || text.includes('installment') || text.includes('0%') || bank.includes('koko') || bank.includes('mintpay')) {
    const offMatch = text.match(/(\d+)%\s*off/i);
    if (offMatch) {
      return `${offMatch[1]}% OFF & 0% INT.`;
    }
    if (text.includes('pay in 3') || bank.includes('koko') || bank.includes('mintpay')) {
      return 'PAY IN 3 INSTALMENTS';
    }
    const monthMatch = text.match(/(\d+)\s*months?/i);
    if (monthMatch) {
      return `0% INT. UP TO ${monthMatch[1]} MO.`;
    }
    return '0% INTEREST INSTALMENT';
  }
  return 'SPECIAL OFFER';
}

function getBrandAvatar(brand) {
  const b = (brand || 'Store').trim();
  const initials = b
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'LK';

  // Deterministic curated gradient based on brand name characters
  const charCode = b.charCodeAt(0) + (b.length > 1 ? b.charCodeAt(1) : 0);
  const gradients = [
    'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', // Indigo/Purple
    'linear-gradient(135deg, #059669 0%, #10b981 100%)', // Emerald
    'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', // Amber
    'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)', // Rose
    'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)', // Cyan
    'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', // Blue
  ];
  const gradient = gradients[charCode % gradients.length];

  return { initials, gradient };
}

export default function DealCard({ deal, onDelete, adminMode, onShare, onSelect }) {
  const expiry = getDaysLeft(deal.validUntil);
  const isExpired = expiry.status === 'expired';
  const isUrgent  = expiry.status === 'urgent';
  const callout   = getDiscountCallout(deal);
  const avatar    = getBrandAvatar(deal.brand);

  const hasSchedule = deal.bankSchedules && deal.bankSchedules.length > 0;
  const isMultiBank = deal.bank === 'Multi-Bank (5 Banks)' || deal.bank.includes('Multi') || hasSchedule;

  let cardClass = 'deal-card';
  if (isExpired)     cardClass += ' deal-card--expired';
  else if (isUrgent) cardClass += ' deal-card--expiring-soon';
  if (hasSchedule)   cardClass += ' deal-card--multibank';

  const handleClaim = (e) => {
    e.stopPropagation();
    if (deal.scrapedFrom) {
      window.open(deal.scrapedFrom, '_blank', 'noopener,noreferrer');
    } else {
      onShare(deal);
    }
  };

  return (
    <article
      className={cardClass}
      aria-label={`${deal.brand} deal`}
      onClick={() => onSelect && onSelect(deal)}
      style={{ cursor: onSelect ? 'pointer' : 'default' }}
    >
      {/* Top Header: Store Avatar + Brand Name + Actions */}
      <div className="deal-card__header">
        <div className="deal-card__merchant-info">
          <div
            className="deal-card__avatar"
            style={{ background: avatar.gradient }}
            aria-hidden="true"
          >
            {avatar.initials}
          </div>
          <div className="deal-card__merchant-text">
            <h3 className="deal-card__brand">{deal.brand}</h3>
            <span className="badge badge--category">{deal.category}</span>
          </div>
        </div>

        <div className="deal-card__actions">
          <button
            className="deal-card__icon-btn"
            onClick={(e) => { e.stopPropagation(); onShare(deal); }}
            aria-label="Share deal"
            title="Copy deal link"
          >
            🔗
          </button>
          {adminMode && (
            <button
              className="deal-card__icon-btn deal-card__icon-btn--delete"
              onClick={(e) => { e.stopPropagation(); onDelete(deal._id); }}
              aria-label="Delete deal"
              title="Delete deal (admin)"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Bold E-Commerce Discount Callout Banner with Voucher Ticket Icon */}
      <div className="deal-card__callout">
        <div className="deal-card__callout-left">
          <span className="deal-card__callout-icon" aria-hidden="true">🏷️</span>
          <span className="deal-card__callout-text">{callout}</span>
        </div>
        {deal.minSpend > 0 && (
          <span className="deal-card__min-spend">Min Rs. {deal.minSpend.toLocaleString()}</span>
        )}
      </div>

      {/* Detailed Description */}
      <p className="deal-card__discount">{deal.discountText}</p>

      {/* Multi-Bank indicator pill if schedule exists */}
      {hasSchedule && (
        <div className="deal-card__schedule-pill">
          <span className="schedule-pill__icon">📅</span>
          <span className="schedule-pill__text">Weekly 5-Bank Schedule (Click for details) ↗</span>
        </div>
      )}

      {/* Usage Channel & Conditions Row */}
      <div className="deal-card__conditions" style={{ marginTop: '12px' }}>
        <span className={`badge badge--channel badge--channel-${deal.usageChannel}`}>
          {deal.usageChannel === 'online'  && '🌐 Online'}
          {deal.usageChannel === 'instore' && '🏪 In-store'}
          {deal.usageChannel === 'both'    && '🌐🏪 Both'}
        </span>

        {deal.validDays && deal.validDays.length > 0 && (
          <span className="badge badge--days">📆 {deal.validDays.join(', ')}</span>
        )}

        {deal.isStackable && (
          <span className="badge badge--stackable" title="Can combine with BNPL">
            ⚡ Stackable
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="deal-card__divider" />

      {/* Footer: Bank Provider + Card Type + Expiry + Claim CTA */}
      <div className="deal-card__footer">
        <div className="deal-card__provider-row">
          <span className={bankBadgeClass(deal.bank)}>
            🏦 {isMultiBank ? '🏆 Multi-Bank (5 Banks)' : deal.bank}
          </span>
          <span className={`badge badge--card-type badge--card-${deal.cardType}`}>
            {deal.cardType === 'credit' && '💳 Credit'}
            {deal.cardType === 'debit'  && '🏧 Debit'}
            {deal.cardType === 'both'   && '💳 Any Card'}
          </span>
        </div>

        <div className="deal-card__bottom-row">
          {/* Expiry Pill */}
          <div className="deal-card__expiry-info">
            <span className={`deal-card__days-pill deal-card__days-pill--${expiry.status}`}>
              {expiry.label}
            </span>
            {deal.validUntil && (
              <span className="deal-card__date">End: {formatDate(deal.validUntil)}</span>
            )}
          </div>

          {/* Primary Action Button */}
          <button
            className="deal-card__cta"
            onClick={handleClaim}
            title={deal.scrapedFrom ? 'Open original promo page' : 'Copy deal details'}
          >
            {deal.scrapedFrom ? 'Claim Offer ↗' : 'Share Offer ↗'}
          </button>
        </div>
      </div>
    </article>
  );
}
