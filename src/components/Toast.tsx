'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, variant: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, variant: ToastVariant, duration = 5000) => {
    const id = Date.now().toString();
    const newToast: Toast = { id, message, variant, duration };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const clearToasts = () => {
    setToasts([]);
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed left-4 right-4 top-4 z-[100] flex flex-col gap-3 sm:left-auto sm:right-4 sm:w-full sm:max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isLeaving, setIsLeaving] = useState(false);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 200);
  };

  const variantStyles = {
    success: 'border-success/25 bg-[linear-gradient(135deg,hsl(var(--success))/0.18,hsl(var(--surface))/0.98)] text-text-primary',
    error: 'border-destructive/25 bg-[linear-gradient(135deg,hsl(var(--destructive))/0.18,hsl(var(--surface))/0.98)] text-text-primary',
    warning: 'border-warning/25 bg-[linear-gradient(135deg,hsl(var(--warning))/0.18,hsl(var(--surface))/0.98)] text-text-primary',
    info: 'border-info/25 bg-[linear-gradient(135deg,hsl(var(--info))/0.18,hsl(var(--surface))/0.98)] text-text-primary',
  };

  const iconStyles = {
    success: 'text-success',
    error: 'text-destructive',
    warning: 'text-warning',
    info: 'text-info',
  };

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-[22px] border px-4 py-4 shadow-[0_24px_54px_-34px_rgba(0,0,0,0.82)] backdrop-blur-md transition-all duration-200 ease-out',
        variantStyles[toast.variant],
        isLeaving ? 'translate-x-4 scale-95 opacity-0' : 'translate-x-0 scale-100 opacity-100',
      )}
    >
      <span className={cn('mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-current/15 bg-current/[0.08]', iconStyles[toast.variant])}>
        {toast.variant === 'success' && <CheckCircle2 className="h-5 w-5" />}
        {toast.variant === 'error' && <XCircle className="h-5 w-5" />}
        {toast.variant === 'warning' && <AlertTriangle className="h-5 w-5" />}
        {toast.variant === 'info' && <Info className="h-5 w-5" />}
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-text-primary">
          {toast.variant === 'success'
            ? 'Success'
            : toast.variant === 'error'
              ? 'Action failed'
              : toast.variant === 'warning'
                ? 'Attention'
                : 'Update'}
        </p>
        <p className="mt-1 text-sm leading-6 text-text-secondary">{toast.message}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
