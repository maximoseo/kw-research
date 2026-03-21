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
    'rounded-2xl border border-border/60 bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]',
  muted:
    'rounded-2xl border border-border/40 bg-surface-raised',
  interactive:
    'rounded-2xl border border-border/60 bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] cursor-pointer hover:border-accent/30 hover:shadow-[0_8px_30px_-8px_rgba(var(--accent-rgb),0.15),0_2px_8px_rgba(0,0,0,0.06)] hover:-translate-y-0.5',
  hero:
    'rounded-2xl border-2 border-accent/25 bg-[linear-gradient(135deg,hsl(var(--accent-surface)),hsl(var(--surface))_60%)] shadow-[0_4px_20px_-4px_rgba(var(--accent-rgb),0.12),0_2px_6px_rgba(0,0,0,0.04)]',
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
