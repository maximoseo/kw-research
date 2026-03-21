import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'muted' | 'interactive' | 'hero';
}

const paddingMap = {
  none: '',
  sm: 'p-3.5',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-7 lg:p-8',
};

const variantMap = {
  default:
    'rounded-xl border border-border/60 bg-surface shadow-elevation-1',
  muted:
    'rounded-xl border border-border/40 bg-surface-raised shadow-elevation-1',
  interactive:
    'rounded-xl border border-border/60 bg-surface shadow-elevation-1 hover:border-accent/25 hover:shadow-elevation-2 hover:-translate-y-px',
  hero:
    'rounded-xl border border-accent/20 bg-surface shadow-elevation-2',
};

export default function Card({ children, className = '', padding = 'md', variant = 'default' }: CardProps) {
  return (
    <div
      className={cn(
        'relative transition-all duration-200',
        variantMap[variant],
        paddingMap[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
