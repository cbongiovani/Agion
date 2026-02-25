import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function QuizzNotificationWidget() {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState('');
  
  const { data: quizzAtivo } = useQuery({
    queryKey: ['quizzAtivo'],
    queryFn: async () => {
      const quizzes = await base44.entities.QuizzRelampago.list();
      return quizzes.find(q => q.status === 'Ativo') || null;
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!quizzAtivo) return;

    const updateCountdown = () => {
      const now = new Date();
      const fim = new Date(quizzAtivo.data_fim);
      const diff = fim - now;

      if (diff <= 0) {
        setTimeLeft('Encerrado');
        return;
      }

      const horas = Math.floor(diff / (1000 * 60 * 60));
      const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const segundos = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${horas}h ${minutos}m ${segundos}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [quizzAtivo]);

  if (!quizzAtivo) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => navigate(createPageUrl('QuizzRelampago'))}
        className="w-full relative overflow-hidden group"
      >
        {/* Animação de balanço */}
        <style>{`
          @keyframes swing {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(-3deg); }
            75% { transform: rotate(3deg); }
          }
          .quiz-widget-icon { animation: swing 0.5s ease-in-out 2s; }
        `}</style>

        <div className="bg-gradient-to-r from-orange-500/30 to-red-500/30 border border-orange-500/50 rounded-lg p-3 hover:from-orange-500/40 hover:to-red-500/40 transition-all duration-300">
          <div className="flex items-center gap-2">
            <Zap className="quiz-widget-icon w-5 h-5 text-orange-400 flex-shrink-0 animate-pulse" />
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-bold text-orange-300 uppercase break-words">
                {quizzAtivo.titulo}
              </p>
              <p className="text-xs text-orange-200 font-semibold break-words">
                ⏱️ {timeLeft}
              </p>
            </div>
          </div>

          {/* Brilho no hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-orange-400/0 via-white/0 to-orange-400/0 group-hover:via-white/20 transition-all duration-300 pointer-events-none" />
        </div>
      </button>
    </div>
  );
}