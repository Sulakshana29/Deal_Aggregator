/**
 * DealCard.jsx — one offer, answering at a glance:
 * what do I get, where, with which card, when, and until when.
 */
import Icon from './Icon';
import {
  benefitLabel, conditionsLabel, daysLabel, cardTypeLabel, expiryInfo, initials, brandHue, freshnessLabel,
} from '../lib/format';

export default function DealCard({ deal, inWallet = false, onOpen }) {
  const expiry = expiryInfo(deal.validUntil);
  const conditions = conditionsLabel(deal);
  const isPayLater = deal.providerType === 'bnpl' || deal.offerType === 'instalment';
  const freshness = freshnessLabel(deal);

  return (
    <article className="deal">
      <button type="button" className="deal__hit" onClick={() => onOpen(deal)} aria-label={`View details: ${deal.discountText}`} />

      <header className="deal__head">
        <span className="avatar" style={{ '--hue': brandHue(deal.brand) }} aria-hidden="true">
          {initials(deal.brand)}
        </span>
        <div className="deal__merchant">
          <h3 className="deal__brand">{deal.brand}</h3>
          <span className="deal__category">{deal.category}</span>
        </div>
        {freshness === 'new' && <span className="badge badge--new" title="Discovered recently">New</span>}
        {freshness === 'updated' && <span className="badge badge--updated" title="Offer details recently updated">Updated</span>}
        {inWallet && (
          <span className="badge badge--in-wallet" title="Card in your wallet">
            <Icon name="check" size={11} /> Wallet
          </span>
        )}
        {deal.source === 'sample' && <span className="badge badge--sample" title="Local sample data">Sample</span>}
      </header>

      <p className={`deal__benefit ${isPayLater ? 'deal__benefit--paylater' : ''}`}>{benefitLabel(deal)}</p>
      <p className="deal__title">{deal.discountText}</p>

      <ul className="deal__facts">
        <li><Icon name={deal.providerType === 'bnpl' ? 'wallet' : 'bank'} size={15} />{deal.bank}</li>
        {deal.providerType !== 'bnpl' && <li><Icon name="card" size={15} />{cardTypeLabel(deal.cardType)}</li>}
        <li><Icon name="calendar" size={15} />{daysLabel(deal.validDays)}</li>
      </ul>

      {conditions && <p className="deal__conditions">{conditions}</p>}

      <footer className="deal__foot">
        <span className={`expiry expiry--${expiry.status}`}>
          <Icon name="clock" size={14} />{expiry.label}
        </span>
        <span className="deal__more" aria-hidden="true">Details →</span>
      </footer>
    </article>
  );
}
