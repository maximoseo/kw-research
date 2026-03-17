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
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6 lg:p-7',
};

const variantMap = {
  default:
    'rounded-xl border border-border/75 bg-[linear-gradient(180deg,hsl(var(--surface))/0.98,hsl(var(--surface-raised))/0.95)] shadow-elevation-2',
  muted:
    'rounded-xl border border-border/70 bg-surface-raised/[0.72] shadow-elevation-1',
  interactive:
    'rounded-xl border border-border/75 bg-[linear-gradient(180deg,hsl(var(--surface))/0.98,hsl(var(--surface-raised))/0.95)] shadow-elevation-1 hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-[0_28px_72px_-46px_rgba(var(--accent-rgb),0.18)]',
  hero:
    'rounded-xl border border-border/70 bg-[linear-gradient(180deg,hsl(var(--surface))/0.99,hsl(var(--surface-raised))/0.95)] shadow-elevation-3',
};

export default function Card({ children, className = '', padding = 'md', variant = 'default' }: CardProps) {
  return (
    <div
      className={cn(
        'relative isolate overflow-visible backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/[0.06] transition-all duration-300',
        variantMap[variant],
        paddingMap[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
