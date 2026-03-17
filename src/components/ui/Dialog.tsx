'use client';

import { useEffect, useRef, ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export default function Dialog({ open, onClose, title, children, maxWidth = 'max-w-lg' }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="fixed inset-0 bg-background/[0.78] backdrop-blur-xl animate-fade-in" />
      <div className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-[28px] border border-border/80 bg-[linear-gradient(180deg,hsl(var(--surface))/0.98,hsl(var(--surface-raised))/0.96)] shadow-[0_40px_120px_-60px_rgba(0,0,0,0.95)] animate-slide-up`}>
        <div className="sticky top-0 flex items-center justify-between gap-4 rounded-t-[28px] border-b border-border/70 bg-surface/85 px-6 py-4 backdrop-blur">
          <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-transparent text-text-muted transition-all hover:border-border/70 hover:bg-surface-raised hover:text-text-primary"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 sm:p-7">{children}</div>
      </div>
    </div>
  );
}
