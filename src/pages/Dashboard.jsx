import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Phone, 
  Ticket, 
  Eye, 
  Users, 
  Activity,
  Calendar,
  FileDown,
  Loader2
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

  const isLoading = loadingFechamentos || loadingAtividades;

  // Calcular totais consolidados
  const totais = fechamentos.reduce((acc, f) => ({
    ligacoes: acc.ligacoes + (f.total_ligacoes_next_ip || 0),
    chamados: acc.chamados + (f.total_chamados_verdana || 0),
    monitorias: acc.monitorias + (f.total_monitorias || 0),
    oneOnOne: acc.oneOnOne + (f.total_1_1 || 0),
  }), { ligacoes: 0, chamados: 0, monitorias: 0, oneOnOne: 0 });

  // Dados por supervisor
  const dadosPorSupervisor = supervisores.map(sup => {
    const fechamentosSup = fechamentos.filter(f => f.supervisor_id === sup.id);
    return {
      nome: sup.nome,
      chamados: fechamentosSup.reduce((sum, f) => sum + (f.total_chamados_verdana || 0), 0),
      ligacoes: fechamentosSup.reduce((sum, f) => sum + (f.total_ligacoes_next_ip || 0), 0),
    };
  });

  // Distribuição por tipo de atividade
  const tiposAtividade = ['Chamados', 'Ligações', 'Monitoria Offline', 'Monitoria Assistida', '1:1'];
  const distribuicaoTipo = tiposAtividade.map(tipo => ({
    name: tipo,
    value: atividades.filter(a => a.tipo === tipo).length,
  })).filter(d => d.value > 0);

  // Evolução por semana
  const evolucaoPorSemana = fechamentos.slice(0, 8).reverse().map(f => ({
    semana: format(new Date(f.semana_inicio), 'dd/MM', { locale: ptBR }),
    ligacoes: f.total_ligacoes_next_ip || 0,
    chamados: f.total_chamados_verdana || 0,
  }));

  // Média por analista
  const mediaPorAnalista = analistas.map(an => {
    const atividadesAn = atividades.filter(a => a.analista_id === an.id);
    const media = atividadesAn.length > 0 
      ? atividadesAn.reduce((sum, a) => sum + (a.nota || 0), 0) / atividadesAn.length 
      : 0;
    return {
      nome: an.nome,
      media: parseFloat(media.toFixed(1)),
    };
  }).sort((a, b) => b.media - a.media);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#e74c3c]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Dashboard Executivo</h1>
          <p className="text-gray-400 mt-1">Visão consolidada do Suporte N1</p>
        </div>
        <Link to={createPageUrl('RelatorioSemanal')}>
          <Button className="bg-[#e74c3c] hover:bg-[#c0392b] text-white gap-2">
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

      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chamados por Supervisor */}
        <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Chamados por Supervisor</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosPorSupervisor}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="nome" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
              <YAxis stroke="#888" tick={{ fill: '#888' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="chamados" fill="#3498db" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ligações por Supervisor */}
        <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Ligações por Supervisor</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosPorSupervisor}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="nome" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
              <YAxis stroke="#888" tick={{ fill: '#888' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="ligacoes" fill="#e74c3c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Evolução Semanal */}
        <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Evolução Semanal</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={evolucaoPorSemana}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="semana" stroke="#888" tick={{ fill: '#888' }} />
              <YAxis stroke="#888" tick={{ fill: '#888' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line type="monotone" dataKey="ligacoes" stroke="#e74c3c" strokeWidth={2} name="Ligações" />
              <Line type="monotone" dataKey="chamados" stroke="#3498db" strokeWidth={2} name="Chamados" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Distribuição por Tipo */}
        <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Distribuição por Tipo de Atividade</h3>
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
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Analistas */}
      <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Performance dos Analistas</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-800">
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
                  <td className="py-4 text-white font-medium">{an.nome}</td>
                  <td className="py-4">
                    <span className="text-white font-semibold">{an.media.toFixed(1)}</span>
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
    </div>
  );
}