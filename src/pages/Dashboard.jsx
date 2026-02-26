import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PlanoAcaoIAWidget from '@/components/PlanoAcaoIAWidget';

function toArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (maybe && Array.isArray(maybe.items)) return maybe.items;
  return [];
}

function safeDateLabel(value) {
  if (!value) return '—';
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(d)) return '—';
  return format(d, 'dd/MM', { locale: ptBR });
}

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    base44.auth.me()
      .then(u => mounted && setCurrentUser(u))
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const { data: fechamentosRaw, isLoading: loadingFechamentos, error: errorFechamentos } = useQuery({
    queryKey: ['fechamentos'],
    queryFn: async () => {
      const todosFechamentos = await base44.entities.FechamentoSemanal.list('-semana_inicio', 12);

      // só aprovados
      const aprovacoes = await base44.entities.AprovacaoAtividade.list('-created_date', 500);
      const idsAprovados = toArray(aprovacoes)
        .filter(a => a.tipo === 'fechamento' && a.status === 'aprovado')
        .map(a => a.atividade_id);

      return toArray(todosFechamentos).filter(f => idsAprovados.includes(f.id));
    },
    staleTime: 5 * 60 * 1000,
  });

  const fechamentos = toArray(fechamentosRaw);

  const { data: atividadesRaw, isLoading: loadingAtividades, error: errorAtividades } = useQuery({
    queryKey: ['atividadesDashboard'],
    queryFn: async () => {
      const todasAtividadesRaw = await base44.entities.Atividade.list('-data', 100);
      const aprovacoesRaw = await base44.entities.AprovacaoAtividade.filter({ tipo: 'atividade', status: 'aprovado' });

      const aprovadasIds = new Set(toArray(aprovacoesRaw).map(a => a.atividade_id).filter(Boolean));
      return toArray(todasAtividadesRaw).filter(a => aprovadasIds.has(a.id));
    },
    staleTime: 5 * 60 * 1000,
  });

  const atividades = toArray(atividadesRaw);

  const { data: analistasRaw, error: errorAnalistas } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
    staleTime: 10 * 60 * 1000,
  });
  const analistas = toArray(analistasRaw);

  const { data: rankingRaw, error: errorRanking } = useQuery({
    queryKey: ['rankingAnalistas'],
    queryFn: () => base44.entities.RankingAnalista.list('-pontos_total', 50),
    staleTime: 5 * 60 * 1000,
  });
  const rankingAnalistas = toArray(rankingRaw);

  const isLoading = loadingFechamentos || loadingAtividades;
  const anyError = errorFechamentos || errorAtividades || errorAnalistas || errorRanking;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#ADF802]" />
      </div>
    );
  }

  if (anyError) {
    return (
      <div className="bg-[#1a1a1a] border border-red-500/30 rounded-lg p-6">
        <h2 className="text-white font-bold text-lg">Erro ao carregar o Dashboard</h2>
        <p className="text-gray-400 mt-2 text-sm">
          Abra o Console (F12) para ver detalhes. Erro: <span className="text-red-300">{String(anyError?.message || anyError)}</span>
        </p>
      </div>
    );
  }

  const ultimoFechamento = fechamentos[0] || {};

  const qualidadeAtual = atividades.length
    ? (atividades.reduce((sum, a) => sum + (Number(a?.nota) || 0), 0) / atividades.length)
    : 0;

  const qualidadeAnterior = atividades.length > 1
    ? (atividades
        .slice(0, Math.max(1, Math.floor(atividades.length / 2)))
        .reduce((sum, a) => sum + (Number(a?.nota) || 0), 0) / Math.max(1, Math.floor(atividades.length / 2)))
    : qualidadeAtual;

  const coberturaTreinamento = analistas.length
    ? ((rankingAnalistas.filter(r => (Number(r?.pontos_total) || 0) > 0).length / analistas.length) * 100)
    : 0;

  const satisfacaoAnalista = analistas.length
    ? ((rankingAnalistas.length / analistas.length) * 100)
    : 0;

  const kpis = {
    qualidadeMedia: {
      valor: Number.isFinite(qualidadeAtual) ? qualidadeAtual.toFixed(1) : '0.0',
      meta: 8.5,
      tendencia: qualidadeAtual >= qualidadeAnterior ? 'up' : 'down',
    },
    eficienciaOperacional: {
      valor: ultimoFechamento?.total_ligacoes_next_ip != null && ultimoFechamento?.total_chamados_verdana != null
        ? (((Number(ultimoFechamento?.total_ligacoes_next_ip) || 0) + (Number(ultimoFechamento?.total_chamados_verdana) || 0)) / 40).toFixed(0)
        : '0',
      meta: '100%',
      tendencia: 'up',
    },
    coberturaTreinamento: {
      valor: Number.isFinite(coberturaTreinamento) ? coberturaTreinamento.toFixed(0) : '0',
      meta: '100%',
      tendencia: 'up',
    },
    satisfacaoAnalista: {
      valor: Number.isFinite(satisfacaoAnalista) ? satisfacaoAnalista.toFixed(0) : '0',
      meta: '100%',
      tendencia: 'stable',
    },
  };

  const evolucaoPorSemana = [...fechamentos]
    .slice(0, 8)
    .reverse()
    .map(f => ({
      semana: safeDateLabel(f?.semana_inicio),
      ligacoes: Number(f?.total_ligacoes_next_ip) || 0,
      chamados: Number(f?.total_chamados_verdana) || 0,
    }))
    .filter(r => r.semana !== '—');

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-gray-500">Desempenho dos supervisores e planos de ação</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Qualidade Média', valor: kpis.qualidadeMedia.valor, meta: kpis.qualidadeMedia.meta, icon: '📊' },
          { label: 'Eficiência Operacional', valor: `${kpis.eficienciaOperacional.valor}%`, meta: kpis.eficienciaOperacional.meta, icon: '⚙️' },
          { label: 'Cobertura Treinamento', valor: `${kpis.coberturaTreinamento.valor}%`, meta: kpis.coberturaTreinamento.meta, icon: '🎓' },
          { label: 'Satisfação Analista', valor: `${kpis.satisfacaoAnalista.valor}%`, meta: kpis.satisfacaoAnalista.meta, icon: '😊' },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover:border-[#ADF802]/30 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-2">{kpi.label}</p>
                <p className="text-3xl font-bold text-white">{kpi.valor}</p>
                <p className="text-gray-500 text-xs mt-2">Meta: {kpi.meta}</p>
              </div>
              <span className="text-2xl">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {evolucaoPorSemana.length > 0 && (
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Evolução por Semana</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={evolucaoPorSemana}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="semana" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333' }} />
              <Legend />
              <Bar dataKey="ligacoes" fill="#3b82f6" name="Ligações" />
              <Bar dataKey="chamados" fill="#06b6d4" name="Chamados" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {currentUser?.role === 'admin' && (
        <PlanoAcaoIAWidget currentUser={currentUser} />
      )}
    </div>
  );
}