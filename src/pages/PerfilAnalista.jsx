import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Loader2, 
  Calendar, 
  User, 
  Phone, 
  Ticket, 
  MessageSquare,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NotaBadge from '@/components/ui/NotaBadge';
import PerformanceBadge from '@/components/ui/PerformanceBadge';
import StatCard from '@/components/ui/StatCard';
import PlanoAcaoSugestoes from '@/components/PlanoAcaoSugestoes';
import AtividadeInfoTooltip from '@/components/AtividadeInfoTooltip';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function PerfilAnalista() {
  const urlParams = new URLSearchParams(window.location.search);
  const analistaId = urlParams.get('id');

  const { data: analista, isLoading: loadingAnalista } = useQuery({
    queryKey: ['analista', analistaId],
    queryFn: async () => {
      const analistas = await base44.entities.Analista.list();
      return analistas.find(a => a.id === analistaId);
    },
    enabled: !!analistaId,
  });

  const { data: atividades = [], isLoading: loadingAtividades } = useQuery({
    queryKey: ['atividades', analistaId],
    queryFn: async () => {
      const todas = await base44.entities.Atividade.list('-data');
      return todas.filter(a => a.analista_id === analistaId);
    },
    enabled: !!analistaId,
  });

  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
  });

  const isLoading = loadingAnalista || loadingAtividades;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!analista) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Analista não encontrado</p>
        <Link to={createPageUrl('Analistas')}>
          <Button variant="outline" className="mt-4 border-gray-700">
            Voltar para Analistas
          </Button>
        </Link>
      </div>
    );
  }

  const getSupervisorNome = (id) => supervisores.find(s => s.id === id)?.nome || '-';

  // Cálculos
  const media = atividades.length > 0 
    ? atividades.reduce((sum, a) => sum + (a.nota || 0), 0) / atividades.length 
    : 0;
  
  const totalChamados = atividades.filter(a => a.tipo === 'Chamados').length;
  const totalLigacoes = atividades.filter(a => a.tipo === 'Ligações').length;
  const total1_1 = atividades.filter(a => a.tipo === 'Feedback Individual').length;
  const totalMonitorias = atividades.filter(a => a.tipo === 'Monitoria Offline' || a.tipo === 'Monitoria Assistida').length;

  const ultimo1_1 = atividades.find(a => a.tipo === 'Feedback Individual');

  // Evolução das notas
  const evolucaoNotas = atividades
    .slice()
    .reverse()
    .slice(0, 20)
    .map(a => ({
      data: format(new Date(a.data), 'dd/MM', { locale: ptBR }),
      nota: a.nota,
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Analistas')}>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Perfil do Analista</h1>
          <p className="text-gray-400 mt-1">Histórico e performance detalhada</p>
        </div>
      </div>

      {/* Info do Analista */}
      <div className="bg-[#242424] rounded-2xl border border-gray-800 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-white font-bold text-3xl">
              {analista.nome.charAt(0)}
            </span>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">{analista.nome}</h2>
            <p className="text-gray-400 mt-1">
              Supervisor: {getSupervisorNome(analista.supervisor_id)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <PerformanceBadge media={media} />
            <p className="text-sm text-gray-500">Média geral: {media.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {/* Plano de Ação */}
      <PlanoAcaoSugestoes analista={analista} atividades={atividades} />

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Total Atividades" 
          value={atividades.length} 
          icon={TrendingUp} 
          variant="emerald" 
        />
        <StatCard 
          title="Chamados" 
          value={totalChamados} 
          icon={Ticket} 
          variant="blue" 
        />
        <StatCard 
          title="Ligações" 
          value={totalLigacoes} 
          icon={Phone} 
          variant="emerald" 
        />
        <StatCard 
          title="Monitorias" 
          value={totalMonitorias} 
          icon={User} 
          variant="amber" 
        />
        <StatCard 
          title="Feedbacks Individuais" 
          value={total1_1} 
          icon={MessageSquare} 
          variant="blue" 
        />
      </div>

      {/* Último Feedback */}
      {ultimo1_1 && (
        <div className="bg-[#242424] rounded-2xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Último Feedback Individual</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(ultimo1_1.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>
            <NotaBadge nota={ultimo1_1.nota} />
          </div>
          {ultimo1_1.comentario && (
            <p className="text-gray-300 mt-3">{ultimo1_1.comentario}</p>
          )}
        </div>
      )}

      {/* Gráfico de Evolução */}
      {evolucaoNotas.length > 1 && (
        <div className="bg-[#242424] rounded-2xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Evolução das Notas</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={evolucaoNotas}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="data" stroke="#888" tick={{ fill: '#888' }} />
              <YAxis domain={[0, 10]} stroke="#888" tick={{ fill: '#888' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Line 
                type="monotone" 
                dataKey="nota" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-[#242424] rounded-2xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Timeline de Atividades</h3>
        <div className="space-y-4">
          {atividades.slice(0, 20).map((atividade, index) => (
            <div 
              key={atividade.id}
              className="flex items-start gap-4 pb-4 border-b border-gray-800 last:border-0 last:pb-0"
            >
              <div className="flex flex-col items-center">
                <NotaBadge nota={atividade.nota} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {atividade.tipo}
                  </span>
                  <AtividadeInfoTooltip tipo={atividade.tipo} />
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    atividade.status === 'Concluído' 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : atividade.status === 'Em evolução'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}>
                    {atividade.status}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(atividade.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  Supervisor: {getSupervisorNome(atividade.supervisor_id)}
                </p>
                {atividade.comentario && (
                  <p className="text-gray-300 text-sm mt-2 bg-[#1a1a1a] p-3 rounded-lg">
                    {atividade.comentario}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {atividades.length === 0 && (
          <p className="text-center text-gray-500 py-8">Nenhuma atividade registrada</p>
        )}
      </div>
    </div>
  );
}