import { cn } from '@/lib/utils';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-xs', lg: 'w-10 h-10 text-sm' };

const colorMap = [
  'border-accent/20 bg-accent/[0.14] text-accent',
  'border-info/20 bg-info/[0.14] text-info',
  'border-success/20 bg-success/[0.14] text-success',
  'border-warning/20 bg-warning/[0.14] text-warning',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const color = colorMap[hashString(name) % colorMap.length];

  return (
    <div
      className={cn(
        `${sizeMap[size]} ${color} flex items-center justify-center rounded-full border font-bold`,
        className,
      )}
      title={name}
    >
      {initials}
    </div>
  );
}
