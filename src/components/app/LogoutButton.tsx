'use client';

import { LogOut } from 'lucide-react';
import { SELECTED_PROJECT_STORAGE_KEY } from '@/lib/project-context';
import { Button } from '@/components/ui';

export function LogoutButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon={<LogOut className="h-3.5 w-3.5" />}
      onClick={() => {
        window.localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
        window.location.assign('/auth/logout');
      }}
      className="border-border/70 text-text-secondary hover:border-destructive/28 hover:bg-destructive/[0.08] hover:text-destructive"
    >
      Logout
    </Button>
  );
}
