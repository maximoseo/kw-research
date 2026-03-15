'use client';

import { LogOut } from 'lucide-react';

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.assign('/auth/logout');
      }}
      className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-surface-raised/70 px-4 py-2.5 text-sm font-medium text-text-secondary transition-all hover:-translate-y-0.5 hover:border-destructive/30 hover:bg-destructive/[0.08] hover:text-destructive"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );
}
