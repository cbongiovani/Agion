import React from 'react';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, icon: Icon, variant = 'default', trend }) {
  const variants = {
    default: 'from-[#0a1628] to-[#0f1f35] border-[#1e3a5f]',
    emerald: 'from-[#e74c3c]/20 to-[#c0392b]/20 border-[#e74c3c]/30',
    blue: 'from-[#3498db]/20 to-[#2980b9]/20 border-[#3498db]/30',
    amber: 'from-[#f39c12]/20 to-[#e67e22]/20 border-[#f39c12]/30',
    red: 'from-[#e74c3c]/20 to-[#c0392b]/20 border-[#e74c3c]/30',
  };

  const iconVariants = {
    default: 'bg-[#1e3a5f] text-gray-300',
    emerald: 'bg-[#e74c3c]/20 text-[#e74c3c]',
    blue: 'bg-[#3498db]/20 text-[#3498db]',
    amber: 'bg-[#f39c12]/20 text-[#f39c12]',
    red: 'bg-[#e74c3c]/20 text-[#e74c3c]',
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