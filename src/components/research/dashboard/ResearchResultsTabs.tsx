'use client';

import { cn } from '@/lib/utils';

interface ResearchResultsTabsProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function ResearchResultsTabs({ tabs, activeTab, onChange, className }: ResearchResultsTabsProps) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto scrollbar-none', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-body-sm font-semibold transition-all min-h-[36px]',
            activeTab === tab.id
              ? 'border-accent/25 bg-accent/[0.08] text-accent shadow-elevation-1'
              : 'border-transparent bg-transparent text-text-muted hover:border-border/40 hover:bg-surface-raised/80 hover:text-text-primary',
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
