'use client';

import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  hasContent?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFadeRight, setShowFadeRight] = useState(false);
  const [showFadeLeft, setShowFadeLeft] = useState(false);

  const checkOverflow = () => {
    const el = containerRef.current;
    if (!el) return;
    setShowFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    setShowFadeLeft(el.scrollLeft > 2);
  };

  useEffect(() => {
    checkOverflow();
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkOverflow, { passive: true });
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkOverflow);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      {showFadeLeft && (
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-surface to-transparent" />
      )}
      <div
        ref={containerRef}
        className="flex overflow-x-auto rounded-[24px] border border-border/70 bg-surface-overlay/75 p-1.5 scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
               'relative min-h-tap whitespace-nowrap rounded-[18px] px-4 py-2.5 text-body-sm font-medium transition-all sm:min-h-0',
               activeTab === tab.id
                 ? 'bg-accent/[0.14] text-accent shadow-[inset_0_0_0_1px_rgba(var(--accent-rgb),0.2)] font-semibold'
                 : 'text-tab-inactive hover:bg-surface-raised/60 hover:text-text-primary',
             )}
          >
            {tab.label}
            {tab.hasContent && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-success inline-block" />
            )}
          </button>
        ))}
      </div>
      {showFadeRight && (
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-surface to-transparent" />
      )}
    </div>
  );
}
