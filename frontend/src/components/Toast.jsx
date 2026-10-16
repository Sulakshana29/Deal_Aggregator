/**
 * Toast.jsx — renders the toast container + individual toasts
 */
import Icon from './Icon';

export default function Toast({ toasts }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type}${t.leaving ? ' toast--leaving' : ''}`}
          role="status"
        >
          <Icon name={t.type === 'error' ? 'alert' : 'check'} size={16} />
          {t.message}
        </div>
      ))}
    </div>
  );
}
