import React from 'react';
import { cn } from '@/lib/utils';

export default function PerformanceBadge({ media, showLabel = true }) {
  const getClassification = (m) => {
    if (m >= 8) return { label: 'Alta Performance', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    if (m >= 6) return { label: 'Adequada', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    return { label: 'Atenção', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  };

  const classification = getClassification(media);

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border',
      classification.color
    )}>
      <span className={cn(
        'w-2 h-2 rounded-full',
        media >= 8 ? 'bg-emerald-400' : media >= 6 ? 'bg-amber-400' : 'bg-red-400'
      )} />
      {showLabel ? classification.label : media?.toFixed(1)}
    </span>
  );
}