import React from 'react';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, icon: Icon, variant = 'default', trend }) {
  const variants = {
    default: 'from-gray-800 to-gray-900 border-gray-700',
    emerald: 'from-emerald-900/50 to-emerald-950/50 border-emerald-500/30',
    blue: 'from-blue-900/50 to-blue-950/50 border-blue-500/30',
    amber: 'from-amber-900/50 to-amber-950/50 border-amber-500/30',
    red: 'from-red-900/50 to-red-950/50 border-red-500/30',
  };

  const iconVariants = {
    default: 'bg-gray-700 text-gray-300',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    blue: 'bg-blue-500/20 text-blue-400',
    amber: 'bg-amber-500/20 text-amber-400',
    red: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className={cn(
      'rounded-2xl border bg-gradient-to-br p-6 transition-all duration-300 hover:scale-[1.02]',
      variants[variant]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {trend && (
            <p className={cn(
              'text-xs mt-2 font-medium',
              trend > 0 ? 'text-emerald-400' : 'text-red-400'
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