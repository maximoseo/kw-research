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
        'relative isolate overflow-hidden rounded-[26px] border border-[rgba(124,92,255,0.1)] bg-[rgba(20,26,49,0.7)] shadow-[0_32px_90px_-52px_rgba(0,0,0,0.85)] backdrop-blur-[20px] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/10 transition-all duration-300 hover:border-[rgba(124,92,255,0.25)] hover:shadow-[0_8px_32px_rgba(124,92,255,0.08)]',
        paddingMap[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
