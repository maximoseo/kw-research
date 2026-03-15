'use client';

import { useRef, useState, useEffect } from 'react';

interface ScrollAreaProps {
  children: React.ReactNode;
  maxHeight?: string;
  className?: string;
}

export default function ScrollArea({ children, maxHeight = '400px', className = '' }: ScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const check = () => {
    const el = ref.current;
    if (!el) return;
    setShowTop(el.scrollTop > 4);
    setShowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  };

  useEffect(() => {
    check();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      {showTop && (
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none rounded-t-lg" />
      )}
      <div
        ref={ref}
        className="overflow-auto"
        style={{ maxHeight }}
      >
        {children}
      </div>
      {showBottom && (
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none rounded-b-lg" />
      )}
    </div>
  );
}
