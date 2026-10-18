/**
 * DealGrid.jsx — the result list with every state handled explicitly:
 * loading skeletons, an error with retry, an empty result, and "load more".
 */
import DealCard from './DealCard';
import Icon from './Icon';

function Skeleton() {
  return (
    <div className="deal deal--skeleton" aria-hidden="true">
      <div className="sk sk--avatar" />
      <div className="sk sk--line sk--wide" />
      <div className="sk sk--line" />
      <div className="sk sk--line sk--short" />
    </div>
  );
}

export default function DealGrid({ state, wallet = [], onOpen, onRetry, onReset, onLoadMore }) {
  const { items, total, loading, loadingMore, error, page, pages } = state;

  const isDealInWallet = (deal) => {
    if (!wallet || wallet.length === 0) return false;
    return wallet.some(
      (c) => c.bank.toLowerCase() === deal.bank?.toLowerCase() &&
             (deal.cardType === 'both' || deal.cardType === c.type)
    );
  };

  if (error && !loading && items.length === 0) {
    return (
      <div className="notice notice--error" role="alert">
        <Icon name="alert" size={22} />
        <div>
          <p className="notice__title">Couldn&apos;t load offers</p>
          <p className="notice__text">{error}</p>
        </div>
        <button type="button" className="btn" onClick={onRetry}><Icon name="refresh" size={15} /> Try again</button>
      </div>
    );
  }

  if (loading && items.length === 0) {
    return (
      <div className="grid" aria-busy="true" aria-label="Loading offers">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="notice">
        <Icon name="search" size={22} />
        <div>
          <p className="notice__title">No live offers match these filters</p>
          <p className="notice__text">Try another category or bank, or clear the filters.</p>
        </div>
        <button type="button" className="btn" onClick={onReset}>Clear filters</button>
      </div>
    );
  }

  return (
    <>
      <p className="results__count" aria-live="polite">
        Showing <strong>{items.length}</strong> of {total} offer{total === 1 ? '' : 's'}
      </p>
      <div className={`grid ${loading ? 'is-refreshing' : ''}`}>
        {items.map((deal) => (
          <DealCard
            key={deal._id}
            deal={deal}
            inWallet={isDealInWallet(deal)}
            onOpen={onOpen}
          />
        ))}
      </div>
      {page < pages && (
        <div className="results__more">
          <button type="button" className="btn" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more offers'}
          </button>
        </div>
      )}
    </>
  );
}
