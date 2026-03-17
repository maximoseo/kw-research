import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export default function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'relative isolate rounded-2xl border border-accent/10 bg-surface-raised/70 shadow-elevation backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/10 transition-all duration-300 hover:border-accent/25 hover:shadow-[0_8px_32px_rgba(var(--accent-rgb),0.08)] overflow-visible',
        paddingMap[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
