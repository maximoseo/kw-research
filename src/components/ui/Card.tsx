import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'muted' | 'interactive' | 'hero';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-7 lg:p-8',
};

const variantMap = {
  default:
    'rounded-2xl border border-border/60 bg-surface shadow-elevation-1',
  muted:
    'rounded-2xl border border-border/40 bg-surface-raised',
  interactive:
    'rounded-2xl border border-border/60 bg-surface shadow-elevation-1 cursor-pointer hover:border-accent/30 hover:shadow-elevation-2 hover:-translate-y-0.5',
  hero:
    'rounded-2xl border-2 border-accent/25 bg-[linear-gradient(135deg,hsl(var(--accent-surface)),hsl(var(--surface))_60%)] shadow-elevation-2',
};

export default function Card({ children, className = '', padding = 'md', variant = 'default' }: CardProps) {
  return (
    <div
      className={cn(
        'relative min-w-0 overflow-hidden transition-all duration-200',
        variantMap[variant],
        paddingMap[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
