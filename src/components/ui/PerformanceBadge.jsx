import React from 'react';
import { cn } from '@/lib/utils';

export default function PerformanceBadge({ media, showLabel = true }) {
  const isDark = document.documentElement.classList.contains('dark');
  
  const getClassification = (m) => {
    if (m >= 8) return { 
      label: 'Alta Performance', 
      color: isDark ? 'bg-[#ADF802]/20 text-[#ADF802] border-[#ADF802]/30' : 'bg-[#ADF802]/30 text-[#5a7701] border-[#ADF802]/50'
    };
    if (m >= 6) return { 
      label: 'Adequada', 
      color: isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-200 text-amber-800 border-amber-400'
    };
    return { 
      label: 'Atenção', 
      color: isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-200 text-red-800 border-red-400'
    };
  };

  const classification = getClassification(media);

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border',
      classification.color
    )}>
      <span className={cn(
        'w-2 h-2 rounded-full',
        media >= 8 ? (isDark ? 'bg-[#ADF802]' : 'bg-[#5a7701]') : 
        media >= 6 ? (isDark ? 'bg-amber-400' : 'bg-amber-600') : 
        (isDark ? 'bg-red-400' : 'bg-red-600')
      )} />
      {showLabel ? classification.label : media?.toFixed(1)}
    </span>
  );
}