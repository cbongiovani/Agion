import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DashboardIntro from '@/components/DashboardIntro';
import { 
  Eye, 
  Users, 
  Activity,
  FileDown,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trophy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PlanoAcaoIAWidget from '@/components/PlanoAcaoIAWidget';

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [expandedCharts, setExpandedCharts] = useState({
    kpiTendencia: false,
    okrProgresso: false,
  });

  useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);
    }).catch(() => {});
  }, []);

  const toggleChart = (chartName) => {
    setExpandedCharts(prev => ({ ...prev, [chartName]: !prev[chartName] }));
  };

  const { data: fechamentos = [], isLoading: loadingFechamentos } = useQuery({
    queryKey: ['fechamentos'],
    queryFn: () => base44.entities.FechamentoSemanal.list('-semana_inicio', 12),
    staleTime: 5 * 60 * 1000,
  });

  const { data: atividades = [], isLoading: loadingAtividades } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => {
      const todasAtividades = await base44.entities.Atividade.list('-data', 100);
      
      // Buscar aprovações para filtrar apenas as aprovadas
      const aprovacoes = await base44.entities.AprovacaoAtividade.filter({ tipo: 'atividade', status: 'aprovado' });
      const atividadesAprovadasIds = aprovacoes.map(a => a.atividade_id);
      
      // Retornar apenas atividades aprovadas
      return todasAtividades.filter(ativ => atividadesAprovadasIds.includes(ativ.id));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: rankingAnalistas = [] } = useQuery({
    queryKey: ['rankingAnalistas'],
    queryFn: () => base44.entities.RankingAnalista.list('-pontos_total', 50),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = loadingFechamentos || loadingAtividades;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#ADF802]" />
      </div>
    );
  }

  // Calcular KPIs (Key Performance Indicators)
  const ultimoFechamento = fechamentos[0] || {};
  const semanaAnterior = fechamentos[1] || {};

  const qualidadeAtual = atividades.length > 0 
    ? (atividades.reduce((sum, a) => sum + (a.nota || 0), 0) / atividades.length)
    : 0;
  const qualidadeAnterior = atividades.length > 1
    ? (atividades.slice(0, Math.floor(atividades.length / 2)).reduce((sum, a) => sum + (a.nota || 0), 0) / Math.floor(atividades.length / 2))
    : qualidadeAtual;

  const kpis = {
    qualidadeMedia: {
      valor: qualidadeAtual.toFixed(1),
      meta: 8.5,
      tendencia: qualidadeAtual >= qualidadeAnterior ? 'up' : 'down'
    },
    eficienciaOperacional: {
      valor: fechamentos.length > 0 && ultimoFechamento.total_ligacoes_next_ip != null && ultimoFechamento.total_chamados_verdana != null
        ? (((ultimoFechamento.total_ligacoes_next_ip || 0) + (ultimoFechamento.total_chamados_verdana || 0)) / 40).toFixed(0) 
        : 0,
      meta: 100,
      tendencia: 'up'
    },
    coberturaTreinamento: {
      valor: analistas.length > 0 
        ? ((rankingAnalistas.filter(r => r.pontos_total > 0).length / analistas.length) * 100).toFixed(0)
        : 0,
      meta: 100,
      tendencia: 'up'
    },
    satisfacaoAnalista: {
      valor: analistas.length > 0 
        ? ((rankingAnalistas.length / analistas.length) * 100).toFixed(0)
        : 0,
      meta: 100,
      tendencia: 'stable'
    }
  };

  // Calcular OKRs (Objectives and Key Results)
  const okrs = [
    {
      objetivo: 'Maximizar Qualidade de Atendimento',
      keyResults: [
        {
          resultado: 'Atingir média de nota 8.5+',
          progresso: Math.min((parseFloat(kpis.qualidadeMedia.valor) / 8.5) * 100, 100),
          atual: kpis.qualidadeMedia.valor,
          meta: 8.5
        },
        {
          resultado: 'Reduzir variabilidade entre analistas',
          progresso: 75,
          atual: '3.2 pts',
          meta: '< 2.5 pts'
        }
      ]
    },
    {
      objetivo: 'Aumentar Eficiência Operacional',
      keyResults: [
        {
          resultado: 'Processar 800+ atividades/semana',
          progresso: Math.min((((ultimoFechamento.total_ligacoes_next_ip || 0) + (ultimoFechamento.total_chamados_verdana || 0) + (ultimoFechamento.total_monitorias || 0)) / 800) * 100, 100),
          atual: (ultimoFechamento.total_ligacoes_next_ip || 0) + (ultimoFechamento.total_chamados_verdana || 0) + (ultimoFechamento.total_monitorias || 0),
          meta: 800
        },
        {
          resultado: 'Manter backlog < 50',
          progresso: ultimoFechamento.backlog_final != null ? Math.min(Math.max(((50 - ultimoFechamento.backlog_final) / 50) * 100, 0), 100) : 0,
          atual: ultimoFechamento.backlog_final != null ? ultimoFechamento.backlog_final : 0,
          meta: 50
        }
      ]
    },
    {
      objetivo: 'Fortalecer Desenvolvimento da Equipe',
      keyResults: [
        {
          resultado: 'Realizarem 100% dos analistas monitorias',
          progresso: kpis.coberturaTreinamento.valor,
          atual: `${rankingAnalistas.length}/${analistas.length}`,
          meta: `${analistas.length}/${analistas.length}`
        },
        {
          resultado: 'Aumentar score de ranking médio',
          progresso: 68,
          atual: '2450 pts',
          meta: '3600 pts'
        }
      ]
    }
  ];

  const evolucaoPorSemana = [...fechamentos].slice(0, 8).reverse().map(f => ({
    semana: format(new Date(f.semana_inicio), 'dd/MM', { locale: ptBR }),
    ligacoes: f.total_ligacoes_next_ip || 0,
    chamados: f.total_chamados_verdana || 0,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-gray-500">Desempenho dos supervisores e planos de ação</p>
        </div>
      </div>



      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Qualidade Média', valor: kpis.qualidadeMedia.valor, meta: kpis.qualidadeMedia.meta, icon: '📊' },
          { label: 'Eficiência Operacional', valor: `${kpis.eficienciaOperacional.valor}%`, meta: '100%', icon: '⚙️' },
          { label: 'Cobertura Treinamento', valor: `${kpis.coberturaTreinamento.valor}%`, meta: '100%', icon: '🎓' },
          { label: 'Satisfação Analista', valor: `${kpis.satisfacaoAnalista.valor}%`, meta: '100%', icon: '😊' },
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

      {/* OKR Progress */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Objetivos e Resultados (OKRs)</h2>
        {okrs.map((okr, idx) => (
          <div key={idx} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-[#ADF802] mb-4">{okr.objetivo}</h3>
            <div className="space-y-4">
              {okr.keyResults.map((kr, krIdx) => (
                <div key={krIdx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 text-sm">{kr.resultado}</span>
                    <span className="text-gray-400 text-xs">{kr.progresso.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-[#ADF802] to-emerald-500 h-2 rounded-full"
                      style={{ width: `${kr.progresso}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-500 text-xs">Atual: {kr.atual}</span>
                    <span className="text-gray-500 text-xs">Meta: {kr.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Weekly Evolution Chart */}
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

      {/* Agente IA - Planos de Ação baseados em Supervisores */}
      {currentUser?.role === 'admin' && (
        <PlanoAcaoIAWidget currentUser={currentUser} />
      )}
    </div>
  );
}