import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DashboardIntro from '@/components/DashboardIntro';
import { 
  Phone, 
  Ticket, 
  Eye, 
  Users, 
  Activity,
  Calendar,
  FileDown,
  Loader2,
  ChevronDown,
  ChevronUp
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
import StatCard from '@/components/ui/StatCard';
import PerformanceBadge from '@/components/ui/PerformanceBadge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const COLORS = ['#e74c3c', '#3498db', '#f39c12', '#27ae60', '#9b59b6'];

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
    queryFn: () => base44.entities.FechamentoSemanal.list('-semana_inicio'),
  });

  const { data: atividades = [], isLoading: loadingAtividades } = useQuery({
    queryKey: ['atividades'],
    queryFn: () => base44.entities.Atividade.list('-data'),
  });

  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: rankingAnalistas = [] } = useQuery({
    queryKey: ['rankingAnalistas'],
    queryFn: () => base44.entities.RankingAnalista.list('-pontos_total'),
  });

  const isLoading = loadingFechamentos || loadingAtividades;

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
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Dashboard Executivo</h1>
          <p className="mt-1 text-gray-500">Visão consolidada do Suporte N1</p>
        </div>
        <Link to={createPageUrl('RelatorioSemanal')}>
          <Button className="bg-[#ADF802] hover:bg-[#9DE002] text-[#0a0a0a] font-bold gap-2">
            <FileDown className="w-4 h-4" />
            Exportar Relatório PDF
          </Button>
        </Link>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard 
          title="Ligações Next IP" 
          value={totais.ligacoes.toLocaleString()} 
          icon={Phone} 
          variant="emerald" 
        />
        <StatCard 
          title="Chamados Verdana" 
          value={totais.chamados.toLocaleString()} 
          icon={Ticket} 
          variant="blue" 
        />
        <StatCard 
          title="Monitorias" 
          value={totais.monitorias.toLocaleString()} 
          icon={Eye} 
          variant="amber" 
        />
        <StatCard 
          title="Feedbacks Individuais" 
          value={totais.oneOnOne.toLocaleString()} 
          icon={Users} 
          variant="emerald" 
        />
        <StatCard 
          title="Atividades" 
          value={atividades.length.toLocaleString()} 
          icon={Activity} 
          variant="blue" 
        />
        <StatCard 
          title="Fechamentos" 
          value={fechamentos.length.toLocaleString()} 
          icon={Calendar} 
          variant="amber" 
        />
      </div>

      {/* Gráficos Expansíveis */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chamados por Supervisor */}
        <div className="rounded-2xl border bg-[#0d0d0d] border-gray-800 overflow-hidden">
          <button
            onClick={() => toggleChart('chamadosSupervisor')}
            className="w-full p-6 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">Chamados por Supervisor</h3>
            {expandedCharts.chamadosSupervisor ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {expandedCharts.chamadosSupervisor && (
            <div className="px-6 pb-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosPorSupervisor}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="nome" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
                  <YAxis stroke="#888" tick={{ fill: '#888' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="chamados" fill="#3498db" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Ligações por Supervisor */}
        <div className="rounded-2xl border bg-[#0d0d0d] border-gray-800 overflow-hidden">
          <button
            onClick={() => toggleChart('ligacoesSupervisor')}
            className="w-full p-6 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">Ligações por Supervisor</h3>
            {expandedCharts.ligacoesSupervisor ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {expandedCharts.ligacoesSupervisor && (
            <div className="px-6 pb-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosPorSupervisor}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="nome" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
                  <YAxis stroke="#888" tick={{ fill: '#888' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="ligacoes" fill="#e74c3c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Evolução Semanal */}
        <div className="rounded-2xl border bg-[#0d0d0d] border-gray-800 overflow-hidden">
          <button
            onClick={() => toggleChart('evolucao')}
            className="w-full p-6 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">Evolução Semanal</h3>
            {expandedCharts.evolucao ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {expandedCharts.evolucao && (
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
                  <Line type="monotone" dataKey="ligacoes" stroke="#e74c3c" strokeWidth={2} name="Ligações" />
                  <Line type="monotone" dataKey="chamados" stroke="#3498db" strokeWidth={2} name="Chamados" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Distribuição por Tipo */}
        <div className="rounded-2xl border bg-[#0d0d0d] border-gray-800 overflow-hidden">
          <button
            onClick={() => toggleChart('distribuicao')}
            className="w-full p-6 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">Distribuição por Tipo de Atividade</h3>
            {expandedCharts.distribuicao ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {expandedCharts.distribuicao && (
            <div className="px-6 pb-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distribuicaoTipo}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {distribuicaoTipo.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Top Analistas */}
      <div className="rounded-2xl border bg-[#0d0d0d] border-gray-800 overflow-hidden">
        <button
          onClick={() => toggleChart('performance')}
          className="w-full p-6 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
        >
          <h3 className="text-lg font-semibold text-white">Performance dos Analistas</h3>
          {expandedCharts.performance ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        {expandedCharts.performance && (
          <div className="px-6 pb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm border-b text-gray-400 border-gray-800">
                    <th className="pb-4 font-medium">Posição</th>
                    <th className="pb-4 font-medium">Analista</th>
                    <th className="pb-4 font-medium">Média</th>
                    <th className="pb-4 font-medium">Classificação</th>
                  </tr>
                </thead>
                <tbody>
                  {mediaPorAnalista.slice(0, 10).map((an, index) => (
                    <tr key={an.nome} className="border-b border-gray-800/50">
                      <td className="py-4">
                        <span className={`
                          inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                          ${index === 0 ? 'bg-yellow-500/20 text-yellow-400' : 
                            index === 1 ? 'bg-gray-400/20 text-gray-300' :
                            index === 2 ? 'bg-amber-600/20 text-amber-500' : 
                            'bg-gray-800 text-gray-400'}
                        `}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-4 font-medium text-white">{an.nome}</td>
                      <td className="py-4">
                        <span className="font-semibold text-white">{an.media.toFixed(1)}</span>
                      </td>
                      <td className="py-4">
                        <PerformanceBadge media={an.media} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}