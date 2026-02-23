import React from 'react';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, icon: Icon, variant = 'default', trend }) {
  const isDark = document.documentElement.classList.contains('dark');
  
  const variants = {
    default: isDark ? 'from-[#0d0d0d] to-[#121212] border-gray-800' : 'from-white to-gray-50 border-gray-200',
    emerald: isDark ? 'from-[#ADF802]/10 to-[#ADF802]/20 border-[#ADF802]/30' : 'from-[#ADF802]/20 to-[#ADF802]/30 border-[#ADF802]/40',
    blue: isDark ? 'from-blue-500/10 to-blue-600/20 border-blue-500/30' : 'from-blue-100/50 to-blue-200/50 border-blue-300',
    amber: isDark ? 'from-amber-500/10 to-amber-600/20 border-amber-500/30' : 'from-amber-100/50 to-amber-200/50 border-amber-300',
    red: isDark ? 'from-red-500/10 to-red-600/20 border-red-500/30' : 'from-red-100/50 to-red-200/50 border-red-300',
  };

  const iconVariants = {
    default: isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700',
    emerald: isDark ? 'bg-[#ADF802]/20 text-[#ADF802]' : 'bg-[#ADF802]/30 text-[#5a7701]',
    blue: isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-200 text-blue-700',
    amber: isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-200 text-amber-700',
    red: isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-200 text-red-700',
  };

  return (
    <div className={cn(
      'rounded-2xl border bg-gradient-to-br p-6 transition-all duration-300 hover:scale-[1.02]',
      variants[variant]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn("text-sm mb-1 font-medium", isDark ? "text-gray-400" : "text-gray-600")}>{title}</p>
          <p className={cn("text-3xl font-bold", isDark ? "text-white" : "text-gray-900")}>{value}</p>
          {trend && (
            <p className={cn(
              'text-xs mt-2 font-medium',
              trend > 0 ? (isDark ? 'text-[#ADF802]' : 'text-green-600') : 'text-red-500'
            )}>
              {trend > 0 ? '+' : ''}{trend}% vs semana anterior
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('p-3 rounded-xl', iconVariants[variant])}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}