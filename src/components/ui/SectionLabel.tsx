import { cn } from '@/lib/utils';

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export default function SectionLabel({ children, className = '' }: SectionLabelProps) {
  return (
    <h2 className={cn('eyebrow mb-3', className)}>
      {children}
    </h2>
  );
}
