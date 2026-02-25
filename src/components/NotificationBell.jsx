import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function NotificationBell({ currentUser }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes', currentUser?.id],
    queryFn: () => base44.entities.Notificacao.filter({ destinatario_id: currentUser?.id }, '-created_date', 50),
    enabled: !!currentUser?.id,
    refetchInterval: 30000,
  });

  const marcarLidaMutation = useMutation({
    mutationFn: (id) => base44.entities.Notificacao.update(id, { lida: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  const marcarTodasLidasMutation = useMutation({
    mutationFn: async () => {
      const naoLidas = notificacoes.filter(n => !n.lida);
      await Promise.all(naoLidas.map(n => base44.entities.Notificacao.update(n.id, { lida: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  const handleNotificationClick = (notificacao) => {
    marcarLidaMutation.mutate(notificacao.id);
    if (notificacao.link) {
      navigate(createPageUrl(notificacao.link));
      setOpen(false);
    }
  };

  const getTipoIcon = (tipo) => {
    const icons = {
      ranking_subiu: '📈',
      ranking_caiu: '📉',
      top3_semanal: '🏆',
      top3_mensal: '🥇',
      acao_corretiva: '⚠️',
      reconhecimento: '⭐',
      nova_solicitacao: '📩',
      novo_usuario: '👤',
      solicitacao_aprovada: '✅',
      solicitacao_rejeitada: '❌',
      nova_atividade: '📝',
      novo_fechamento: '📊',
      novo_incidente: '🚨',
      nova_questao: '❓',
      nova_avaliacao: '📋',
      alerta_atividade: '🔴',
      analista_atencao: '⚠️',
      prazo_vencendo: '⏰',
    };
    return icons[tipo] || '🔔';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-12 w-12">
          <Bell className="w-9 h-9" />
          {naoLidas > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#e74c3c] rounded-full text-white text-xs flex items-center justify-center font-bold">
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 bg-[#0a1628] border-[#1e3a5f]" align="end">
        <div className="p-4 border-b border-[#1e3a5f] flex items-center justify-between">
          <h3 className="font-semibold text-white">Notificações</h3>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => marcarTodasLidasMutation.mutate()}
              className="text-xs text-[#ADF802] hover:text-[#ADF802]"
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {notificacoes.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1e3a5f]">
              {notificacoes.map((notificacao) => (
                <button
                  key={notificacao.id}
                  onClick={() => handleNotificationClick(notificacao)}
                  className={`w-full p-4 text-left hover:bg-[#0f1f35] transition-colors ${
                    !notificacao.lida ? 'bg-[#0f1f35]/50' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="text-2xl">{getTipoIcon(notificacao.tipo)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-sm font-medium ${!notificacao.lida ? 'text-white' : 'text-gray-300'}`}>
                          {notificacao.titulo}
                        </h4>
                        {!notificacao.lida && (
                          <div className="w-2 h-2 bg-[#e74c3c] rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{notificacao.mensagem}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(notificacao.created_date), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}