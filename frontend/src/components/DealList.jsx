/**
 * DealList.jsx — v3
 *
 * Props:
 *   deals      — array of deal objects to display
 *   loading    — boolean: show skeleton placeholders?
 *   onDelete(id) — passed through to each DealCard
 *   onShare(deal) — share button handler
 *   adminMode  — boolean: show delete buttons?
 *   onReset    — clear-all-filters callback for empty state
 */
import DealCard from './DealCard';

function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-line skeleton-line--title" />
      <div className="skeleton-line skeleton-line--body" />
      <div className="skeleton-line skeleton-line--body2" />
      <div className="skeleton-line skeleton-line--badge" />
    </div>
  );
}

export default function DealList({ deals, loading, onDelete, onShare, adminMode, onReset, onSelect }) {
  if (loading) {
    return (
      <div className="deal-grid" aria-label="Loading deals">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="deal-grid">
        <div className="empty-state">
          <div className="empty-state__icon">🔍</div>
          <p className="empty-state__text">No deals match your filters.</p>
          <p className="empty-state__suggestion">
            Try removing a filter, enabling &quot;Show expired&quot;, or clearing all.
          </p>
          <button className="empty-state__reset" onClick={onReset}>
            Clear all filters
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="deal-grid" aria-label="Deal listings">
      {deals.map((deal) => (
        <DealCard
          key={deal._id}
          deal={deal}
          onDelete={onDelete}
          onShare={onShare}
          adminMode={adminMode}
          onSelect={onSelect}
        />
      ))}
    </main>
  );
}
