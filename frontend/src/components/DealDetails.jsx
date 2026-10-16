/**
 * DealDetails.jsx — full offer details in an accessible dialog.
 * Answers: what you get, who is eligible, when, where, conditions, source.
 *
 * Uses the native <dialog> element: built-in focus trapping, Esc to close
 * and a proper modal role, without a UI library.
 */
import { useEffect, useRef } from 'react';
import Icon from './Icon';
import {
  benefitLabel, daysLabel, cardTypeLabel, channelLabel, expiryInfo, formatDate, formatLKR,
  initials, brandHue, timeAgo,
} from '../lib/format';

function Row({ icon, label, children }) {
  return (
    <div className="details__row">
      <dt><Icon name={icon} size={16} />{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function DealDetails({ deal, onClose, onShare }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (deal && !dialog.open) dialog.showModal?.();
    if (!deal && dialog.open) dialog.close?.();
  }, [deal]);

  if (!deal) return <dialog ref={ref} className="details" />;

  const expiry = expiryInfo(deal.validUntil);
  const isBnpl = deal.providerType === 'bnpl';

  return (
    <dialog
      ref={ref}
      className="details"
      aria-labelledby="details-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }} // click on backdrop
    >
      <div className="details__panel">
        <header className="details__head">
          <span className="avatar avatar--lg" style={{ '--hue': brandHue(deal.brand) }} aria-hidden="true">
            {initials(deal.brand)}
          </span>
          <div>
            <p className="details__brand">{deal.brand} · {deal.category}</p>
            <h2 id="details-title" className="details__title">{deal.discountText}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>

        <p className="details__benefit">{benefitLabel(deal)}</p>
        {deal.description && <p className="details__desc">{deal.description}</p>}

        <dl className="details__grid">
          <Row icon={isBnpl ? 'wallet' : 'bank'} label={isBnpl ? 'Pay with' : 'Bank'}>{deal.bank}</Row>
          {!isBnpl && <Row icon="card" label="Cards">{cardTypeLabel(deal.cardType)}</Row>}
          <Row icon="calendar" label="Valid on">{daysLabel(deal.validDays)}</Row>
          <Row icon="clock" label="Valid until">
            {deal.validUntil ? formatDate(deal.validUntil) : 'No end date given'}
            {['soon', 'today', 'expired'].includes(expiry.status) && (
              <span className={`expiry expiry--${expiry.status} details__expiry`}>{expiry.label}</span>
            )}
          </Row>
          <Row icon={deal.usageChannel === 'online' ? 'globe' : 'store'} label="Where">{channelLabel(deal.usageChannel)}</Row>
          {deal.minSpend > 0 && <Row icon="tag" label="Minimum bill">{formatLKR(deal.minSpend)}</Row>}
          {deal.maxDiscount > 0 && <Row icon="tag" label="Maximum saving">{formatLKR(deal.maxDiscount)}</Row>}
        </dl>

        <p className="details__note">
          <Icon name="info" size={15} />
          Offers can change without notice. Always confirm the terms with the store or bank before you pay.
          {deal.lastVerified && <> Last checked {timeAgo(deal.lastVerified)}.</>}
        </p>

        <footer className="details__actions">
          {deal.scrapedFrom && deal.source === 'scraped' && (
            <a className="btn btn--primary" href={deal.scrapedFrom} target="_blank" rel="noopener noreferrer">
              View on mypromo.lk <Icon name="external" size={15} />
            </a>
          )}
          <button type="button" className="btn" onClick={() => onShare(deal)}>
            <Icon name="link" size={15} /> Copy link
          </button>
        </footer>
      </div>
    </dialog>
  );
}
