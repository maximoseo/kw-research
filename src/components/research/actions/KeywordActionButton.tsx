'use client';

import { Button } from '@/components/ui';
import { Plus } from 'lucide-react';

interface KeywordActionButtonProps {
  keyword: string;
  cluster?: string;
  onCreateAction: (keyword: string, cluster?: string) => void;
}

export default function KeywordActionButton({ keyword, cluster, onCreateAction }: KeywordActionButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => onCreateAction(keyword, cluster)}
      icon={<Plus className="h-3 w-3" />}
    >
      Action
    </Button>
  );
}
