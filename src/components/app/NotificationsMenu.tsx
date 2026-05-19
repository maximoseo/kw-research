'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/utils';

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  link?: string;
}

interface NotificationsMenuProps {
  className?: string;
}

function notificationDotColor(type?: Notification['type']): string {
  switch (type) {
    case 'success':
      return 'bg-success';
    case 'warning':
      return 'bg-warning';
    case 'error':
      return 'bg-destructive';
    case 'info':
    default:
      return 'bg-accent';
  }
}

export default function NotificationsMenu({ className }: NotificationsMenuProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // silently fail — badge stays stale
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Poll every 60s while open
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const markAsRead = async (id: string) => {
    setMarkingIds((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    } catch {
      // silently fail
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    for (const id of unreadIds) {
      setMarkingIds((prev) => new Set(prev).add(id));
    }
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // silently fail
    } finally {
      setMarkingIds(new Set());
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* ── Bell button ── */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all',
          open
            ? 'border-accent/30 bg-accent/[0.08] text-accent'
            : 'border-transparent text-text-muted hover:border-border/60 hover:bg-surface-raised hover:text-text-primary',
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-accent px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <>
          {/* Invisible backdrop for click-outside on mobile */}
          <div
            className="fixed inset-0 z-40 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute right-0 top-full z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] origin-top-right animate-slide-down rounded-xl border border-border/60 bg-surface shadow-elevation-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-body-sm font-semibold text-text-primary">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-accent/[0.10] px-2 py-0.5 text-[11px] font-semibold text-accent">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-caption font-medium text-text-muted transition-all hover:bg-surface-hover hover:text-text-primary"
                >
                  <Check className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-body-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Bell className="h-6 w-6 text-text-muted/60" />
                  <p className="text-body-sm text-text-muted">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'group relative flex gap-3 px-4 py-3 transition-colors',
                        n.read
                          ? 'bg-transparent'
                          : 'bg-accent/[0.03]',
                      )}
                    >
                      {/* Dot */}
                      <div className="mt-1.5 shrink-0">
                        <span
                          className={cn(
                            'block h-2 w-2 rounded-full',
                            n.read ? 'bg-transparent' : notificationDotColor(n.type),
                          )}
                        />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-body-sm',
                            n.read ? 'text-text-secondary' : 'font-semibold text-text-primary',
                          )}
                        >
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-caption text-text-muted line-clamp-2">
                          {n.body}
                        </p>
                        <p className="mt-1.5 text-[11px] text-text-muted/70">
                          {formatRelative(n.createdAt)}
                        </p>
                      </div>

                      {/* Mark read button */}
                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => markAsRead(n.id)}
                          disabled={markingIds.has(n.id)}
                          className="shrink-0 mt-1.5 flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-text-muted opacity-0 transition-all hover:border-border/60 hover:bg-surface-raised hover:text-text-primary group-hover:opacity-100"
                          aria-label="Mark as read"
                        >
                          {markingIds.has(n.id) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
