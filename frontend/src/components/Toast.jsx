/**
 * Toast.jsx — renders the toast container + individual toasts
 */
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
          {t.type === 'success' && '✅'}
          {t.type === 'error'   && '❌'}
          {t.message}
        </div>
      ))}
    </div>
  );
}
