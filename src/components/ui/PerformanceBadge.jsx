import React from 'react';
import { cn } from '@/lib/utils';

export default function PerformanceBadge({ media, showLabel = true }) {
  const getClassification = (m) => {
    if (m >= 8) return { label: 'Alta Performance', color: 'bg-[#27ae60]/20 text-[#27ae60] border-[#27ae60]/30' };
    if (m >= 6) return { label: 'Adequada', color: 'bg-[#f39c12]/20 text-[#f39c12] border-[#f39c12]/30' };
    return { label: 'Atenção', color: 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30' };
  };

  const classification = getClassification(media);

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border',
      classification.color
    )}>
      <span className={cn(
        'w-2 h-2 rounded-full',
        media >= 8 ? 'bg-[#27ae60]' : media >= 6 ? 'bg-[#f39c12]' : 'bg-[#e74c3c]'
      )} />
      {showLabel ? classification.label : media?.toFixed(1)}
    </span>
  );
}