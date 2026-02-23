import React from 'react';
import { cn } from '@/lib/utils';

export default function NotaBadge({ nota }) {
  const isDark = document.documentElement.classList.contains('dark');
  
  const getColor = (n) => {
    if (n >= 8) return isDark 
      ? 'bg-[#ADF802]/20 text-[#ADF802] border-[#ADF802]/30' 
      : 'bg-[#ADF802]/30 text-[#5a7701] border-[#ADF802]/50';
    if (n >= 6) return isDark 
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
      : 'bg-amber-200 text-amber-800 border-amber-400';
    return isDark 
      ? 'bg-red-500/20 text-red-400 border-red-500/30' 
      : 'bg-red-200 text-red-800 border-red-400';
  };

  return (
    <span className={cn(
      'inline-flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold border shadow-sm',
      getColor(nota)
    )}>
      {nota?.toFixed(1)}
    </span>
  );
}