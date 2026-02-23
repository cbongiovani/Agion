import React from 'react';
import { cn } from '@/lib/utils';

export default function NotaBadge({ nota }) {
  const getColor = (n) => {
    if (n >= 8) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (n >= 6) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  return (
    <span className={cn(
      'inline-flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold border',
      getColor(nota)
    )}>
      {nota?.toFixed(1)}
    </span>
  );
}