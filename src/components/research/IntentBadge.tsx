'use client';

import { cn } from '@/lib/utils';
import type { ResearchIntent } from '@/lib/research';

interface IntentBadgeProps {
  intent: string;
  className?: string;
}

const intentStyles: Record<string, string> = {
  Informational:
    'border-blue-500/20 bg-blue-500/[0.08] text-blue-600 dark:text-blue-400',
  Commercial:
    'border-purple-500/20 bg-purple-500/[0.08] text-purple-600 dark:text-purple-400',
  Transactional:
    'border-green-500/20 bg-green-500/[0.08] text-green-600 dark:text-green-400',
  Navigational:
    'border-gray-400/20 bg-gray-400/[0.08] text-gray-500 dark:text-gray-400',
};

const intentTooltips: Record<string, string> = {
  Informational:
    'Seeking knowledge — "how to", "what is", "guide", "tutorial"',
  Commercial:
    'Comparing options — "best", "vs", "review", "top", "alternatives"',
  Transactional:
    'Ready to buy — "buy", "price", "discount", "free trial", "sign up"',
  Navigational:
    'Looking for a specific site — "login", brand names, product pages',
};

export default function IntentBadge({ intent, className }: IntentBadgeProps) {
  const style = intentStyles[intent] ?? intentStyles.Navigational;
  const tooltip = intentTooltips[intent] ?? 'Unknown intent';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        style,
        className,
      )}
      title={tooltip}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
      {intent || '—'}
    </span>
  );
}
