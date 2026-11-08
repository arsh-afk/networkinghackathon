"use client";
import { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'info' | 'success' | 'error';
type Toast = { id: number; message: string; type: ToastType };

const ToastCtx = createContext<{ show: (msg: string, type?: ToastType) => void }>({ show: () => {} });

let _id = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++_id;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div key={t.id} className="toast" role="status">
            <span style={{ color: t.type === 'error' ? 'var(--error)' : t.type === 'success' ? 'var(--success)' : 'var(--paper)' }}>
              {t.type === 'error' ? '✕' : t.type === 'success' ? '✓' : '◆'}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() { return useContext(ToastCtx); }
