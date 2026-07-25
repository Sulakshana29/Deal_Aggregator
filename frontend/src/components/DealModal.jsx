/**
 * DealModal.jsx
 *
 * E-Commerce Promotion Details Modal.
 * Shows multi-bank weekly schedules (e.g. Popeyes Tuesday DFCC, Wednesday ComBank),
 * terms, validation status, and official claim links.
 */
import React from 'react';

export default function DealModal({ deal, onClose }) {
  if (!deal) return null;

  const {
    brand,
    discountText,
    bank,
    category,
    offerType,
    cardType,
    validUntil,
    scrapedFrom,
    isStackable,
    source,
    description,
    bankSchedules,
  } = deal;

  const hasSchedule = bankSchedules && bankSchedules.length > 0;
  const isMultiBank = bank === 'Multi-Bank (5 Banks)' || bank.includes('Multi') || hasSchedule;

  const formatExpiry = (dateStr) => {
    if (!dateStr) return 'Ongoing Promotion';
    const date = new Date(dateStr);
    return isNaN(date.getTime())
      ? 'Ongoing'
      : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getBankColor = (bankName) => {
    if (!bankName) return '#94a3b8';
    const b = bankName.toLowerCase();
    if (b.includes('koko')) return '#ec4899';
    if (b.includes('mintpay')) return '#10b981';
    if (b.includes('commercial')) return '#3b82f6';
    if (b.includes('hnb')) return '#f59e0b';
    if (b.includes('sampath')) return '#ef4444';
    if (b.includes('boc')) return '#8b5cf6';
    if (b.includes('dfcc')) return '#06b6d4';
    if (b.includes('multi')) return '#e11d48';
    return '#6366f1';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="deal-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="deal-modal__header">
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
              <span className="deal-card__category" style={{ position: 'static' }}>
                {category}
              </span>
              <span
                className="deal-card__bank"
                style={{ backgroundColor: getBankColor(bank), position: 'static' }}
              >
                {isMultiBank ? '🏆 Multi-Bank Weekly Offer' : bank}
              </span>
              {isStackable && (
                <span className="deal-card__stackable" style={{ position: 'static' }}>
                  ⚡ BNPL Stackable
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: '4px 0' }}>
              {brand}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Source: {source === 'scraped' ? '🤖 Live Web Scraper / Partner Directory' : '📝 Manual Submission'}
            </p>
          </div>
          <button className="deal-modal__close" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="deal-modal__body">
          <div style={{ padding: '16px 20px', background: 'var(--bg-card-hover)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--accent-primary)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {discountText}
            </h3>
            {description && (
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.6' }}>
                {description}
              </p>
            )}
          </div>

          {/* Multi-Bank Weekly Schedule Table */}
          {hasSchedule && (
            <div className="deal-modal__schedule">
              <div className="deal-modal__schedule-title">📅 Multi-Bank Weekly Timetable</div>
              {bankSchedules.map((item, index) => (
                <div key={index} className="schedule-row">
                  <span className="schedule-day">{item.day}</span>
                  <span className="schedule-bank" style={{ color: getBankColor(item.bank) }}>
                    {item.bank}
                  </span>
                  <span className="schedule-discount">{item.discount}</span>
                </div>
              ))}
            </div>
          )}

          {/* Offer Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
            <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px' }}>Valid Until</div>
              <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>⏳ {formatExpiry(validUntil)}</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px' }}>Applicable Cards</div>
              <div style={{ fontWeight: '700', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                💳 {cardType === 'both' ? 'Credit & Debit Cards' : `${cardType} Cards Only`}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            {scrapedFrom && (
              <a
                href={scrapedFrom}
                target="_blank"
                rel="noopener noreferrer"
                className="deal-card__btn deal-card__btn--claim"
                style={{ flex: 1, textAlign: 'center', padding: '14px', fontSize: '15px', fontWeight: '700', textDecoration: 'none' }}
              >
                Claim Offer on Official Site ↗
              </a>
            )}
            <button
              className="deal-card__btn"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '14px 20px', fontWeight: '600' }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
