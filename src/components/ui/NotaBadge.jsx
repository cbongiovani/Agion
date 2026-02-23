import React from 'react';
import { cn } from '@/lib/utils';

export default function NotaBadge({ nota }) {
  const getColor = (n) => {
    if (n >= 8) return 'bg-[#27ae60]/20 text-[#27ae60] border-[#27ae60]/30';
    if (n >= 6) return 'bg-[#f39c12]/20 text-[#f39c12] border-[#f39c12]/30';
    return 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30';
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