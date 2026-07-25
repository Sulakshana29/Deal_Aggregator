/**
 * useToast.js — simple toast notification hook
 * Usage: const { toasts, showToast } = useToast();
 * showToast('Copied!', 'success');
 */
import { useState, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Start fade-out after 2.5s, remove after 2.75s
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
      );
    }, 2500);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2750);
  }, []);

  return { toasts, showToast };
}
