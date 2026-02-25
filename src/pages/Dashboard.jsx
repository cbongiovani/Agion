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
    queryFn: () => base44.entities.Atividade.list('-data', 100),
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

  const kpis = {
    qualidadeMedia: {
      valor: atividades.length > 0 
        ? (atividades.reduce((sum, a) => sum + (a.nota || 0), 0) / atividades.length).toFixed(1)
        : 0,
      meta: 8.5,
      tendencia: (parseFloat(ultimoFechamento.total_monitorias || 0) >= parseFloat(semanaAnterior.total_monitorias || 0)) ? 'up' : 'down'
    },
    eficienciaOperacional: {
      valor: fechamentos.length > 0 ? ((ultimoFechamento.total_ligacoes_next_ip + ultimoFechamento.total_chamados_verdana) / 40).toFixed(0) : 0,
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
          progresso: Math.min((kpis.qualidadeMedia.valor / 8.5) * 100, 100),
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
          progresso: Math.min(((ultimoFechamento.total_ligacoes_next_ip + ultimoFechamento.total_chamados_verdana + ultimoFechamento.total_monitorias) / 800) * 100, 100),
          atual: ultimoFechamento.total_ligacoes_next_ip + ultimoFechamento.total_chamados_verdana + ultimoFechamento.total_monitorias,
          meta: 800
        },
        {
          resultado: 'Manter backlog < 50',
          progresso: Math.min(((50 - (ultimoFechamento.backlog_final || 0)) / 50) * 100, 100),
          atual: ultimoFechamento.backlog_final || 0,
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

  const evolucaoPorSemana = fechamentos.slice(0, 8).reverse().map(f => ({
    semana: format(new Date(f.semana_inicio), 'dd/MM', { locale: ptBR }),
    ligacoes: f.total_ligacoes_next_ip || 0,
    chamados: f.total_chamados_verdana || 0,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Dashboard KPI & OKR</h1>
          <p className="mt-1 text-gray-500">Métricas de desempenho e objetivos estratégicos</p>
        </div>
        <Link to={createPageUrl('RelatorioSemanal')}>
          <Button className="bg-[#ADF802] hover:bg-[#9DE002] text-[#0a0a0a] font-bold gap-2">
            <FileDown className="w-4 h-4" />
            Exportar Relatório PDF
          </Button>
        </Link>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Qualidade Média', ...kpis.qualidadeMedia, icon: Eye },
          { label: 'Eficiência Operacional', ...kpis.eficienciaOperacional, icon: Activity },
          { label: 'Cobertura Treinamento', ...kpis.coberturaTreinamento, icon: Users, suffix: '%' },
          { label: 'Satisfação Analista', ...kpis.satisfacaoAnalista, icon: Trophy, suffix: '%' },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          const progresso = (kpi.valor / kpi.meta) * 100;
          const statusColor = progresso >= 100 ? 'bg-green-500/10 border-green-500/30' : progresso >= 75 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-amber-500/10 border-amber-500/30';
          
          return (
            <div key={idx} className={`rounded-xl border p-6 ${statusColor}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-gray-400">{kpi.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{kpi.valor}{kpi.suffix || ''}</p>
                </div>
                <Icon className="w-5 h-5 text-[#ADF802]" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Progresso</span>
                  <span>{Math.min(progresso, 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-[#ADF802] to-[#9DE002] h-full transition-all duration-300"
                    style={{ width: `${Math.min(progresso, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">Meta: {kpi.meta}{kpi.suffix || ''}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* OKRs Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#ADF802]" />
          Objetivos & Resultados Chave (OKRs)
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {okrs.map((okr, okrIdx) => (
            <div key={okrIdx} className="rounded-xl border bg-[#0d0d0d] border-gray-800 p-6 hover:border-gray-700 transition-all">
              <h3 className="text-lg font-semibold text-white mb-4">{okr.objetivo}</h3>
              
              <div className="space-y-4">
                {okr.keyResults.map((kr, krIdx) => {
                   const progresso = typeof kr.progresso === 'number' ? kr.progresso : 0;
                   const statusColor = progresso >= 100 ? 'border-green-500/30' : progresso >= 75 ? 'border-blue-500/30' : 'border-amber-500/30';

                   return (
                     <div key={krIdx} className={`border rounded-lg p-4 bg-[#1a1a1a] ${statusColor}`}>
                       <div className="flex items-start justify-between mb-2">
                         <p className="text-sm text-gray-300 flex-1">{kr.resultado}</p>
                         <span className="text-xs font-bold text-[#ADF802] ml-2">{Math.round(progresso)}%</span>
                       </div>

                       <div className="w-full bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
                         <div 
                           className="bg-gradient-to-r from-[#ADF802] to-[#9DE002] h-full transition-all duration-300"
                           style={{ width: `${Math.min(progresso, 100)}%` }}
                         />
                       </div>

                       <div className="flex justify-between text-xs text-gray-500">
                         <span>Atual: {kr.atual}</span>
                         <span>Meta: {kr.meta}</span>
                       </div>
                     </div>
                   );
                 })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tendência Semanal */}
      <div className="rounded-2xl border bg-[#0d0d0d] border-gray-800 overflow-hidden">
        <button
          onClick={() => toggleChart('kpiTendencia')}
          className="w-full p-6 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
        >
          <h3 className="text-lg font-semibold text-white">Tendência Semanal</h3>
          {expandedCharts.kpiTendencia ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        {expandedCharts.kpiTendencia && (
          <div className="px-6 pb-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolucaoPorSemana}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="semana" stroke="#888" tick={{ fill: '#888' }} />
                <YAxis stroke="#888" tick={{ fill: '#888' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line type="monotone" dataKey="ligacoes" stroke="#ADF802" strokeWidth={2} name="Ligações" />
                <Line type="monotone" dataKey="chamados" stroke="#3498db" strokeWidth={2} name="Chamados" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}