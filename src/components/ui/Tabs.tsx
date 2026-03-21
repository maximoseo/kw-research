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
        className="flex overflow-x-auto rounded-lg border border-border/50 bg-surface-inset/60 p-1 scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
               'relative min-h-tap cursor-pointer whitespace-nowrap rounded-md px-4 py-2 text-body-sm font-semibold transition-all',
               activeTab === tab.id
                 ? 'bg-surface text-accent shadow-elevation-1'
                 : 'text-text-muted hover:bg-surface/50 hover:text-text-primary',
             )}
          >
            {tab.label}
            {tab.hasContent && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-accent inline-block" />
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
