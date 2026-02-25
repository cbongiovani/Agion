import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock } from 'lucide-react';

const ACTIVITY_LIMITS = {
  'Chamados': { limit: 1, period: 'day' },
  'Ligações': { limit: 1, period: 'day' },
  'Monitoria Offline': { limit: 1, period: 'day' },
  'Monitoria Assistida': { limit: 1, period: 'week' },
  'Feedback Individual': { limit: 1, period: 'week' }
};

export function checkActivityLimit(atividades, analistaId, tipoAtividade, currentDate) {
  const limit = ACTIVITY_LIMITS[tipoAtividade];
  if (!limit) return { allowed: true };

  let startDate, endDate;
  const current = new Date(currentDate);

  if (limit.period === 'day') {
    startDate = new Date(current);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(current);
    endDate.setHours(23, 59, 59, 999);
  } else if (limit.period === 'week') {
    startDate = new Date(current);
    startDate.setDate(current.getDate() - current.getDay());
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  }

  const sameTypeActivities = atividades.filter(a => {
    const ativDate = new Date(a.data);
    return (
      a.analista_id === analistaId &&
      a.tipo === tipoAtividade &&
      ativDate >= startDate &&
      ativDate <= endDate
    );
  });

  if (sameTypeActivities.length >= limit.limit) {
    return {
      allowed: false,
      period: limit.period,
      nextAvailableDate: limit.period === 'day' ? new Date(endDate.getTime() + 1000) : new Date(endDate.getTime() + 1000),
      message: `Você já registrou uma ${tipoAtividade.toLowerCase()} para este analista ${limit.period === 'day' ? 'hoje' : 'esta semana'}.`
    };
  }

  return { allowed: true };
}

export default function AtividadeLimitModal({ isOpen, onClose, tipo, nextAvailableDate, message }) {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    if (!isOpen || !nextAvailableDate) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = nextAvailableDate - now;

      if (diff <= 0) {
        setTimeRemaining('Disponível agora!');
        setTimeout(() => onClose(), 2000);
        return;
      }

      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isOpen, nextAvailableDate, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <Clock className="w-5 h-5" />
            Limite de Atividade Atingido
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-gray-300 mb-2">{message}</p>
            <p className="text-sm text-gray-400">
              Tipo de atividade: <span className="text-white font-semibold">{tipo}</span>
            </p>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
            <p className="text-sm text-gray-400 mb-2">Próxima disponibilidade em:</p>
            <p className="text-2xl font-mono font-bold text-emerald-400">
              {timeRemaining || 'Calculando...'}
            </p>
          </div>

          <p className="text-xs text-gray-500 text-center">
            O modal será fechado automaticamente quando a atividade estiver disponível.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}