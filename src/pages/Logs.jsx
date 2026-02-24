import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FileText, Filter, X, Loader2, Activity, User, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACOES = ['Todas', 'Criou', 'Atualizou', 'Excluiu', 'Login', 'Logout', 'Convidou Usuário', 'Alterou Permissão', 'Exportou Relatório'];
const ENTIDADES = ['Todas', 'Atividade', 'FechamentoSemanal', 'Analista', 'Supervisor', 'Incidente', 'Usuário', 'Sistema'];

export default function Logs() {
  const [filters, setFilters] = useState({
    usuario_email: '',
    acao: 'Todas',
    entidade: 'Todas',
    dataInicio: '',
    dataFim: '',
    detalhes: '',
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: () => base44.entities.Log.list('-created_date'),
  });

  const clearFilters = () => {
    setFilters({
      usuario_email: '',
      acao: 'Todas',
      entidade: 'Todas',
      dataInicio: '',
      dataFim: '',
      detalhes: '',
    });
  };

  const filteredLogs = logs.filter((log) => {
    const matchEmail = !filters.usuario_email || log.usuario_email?.toLowerCase().includes(filters.usuario_email.toLowerCase());
    const matchAcao = filters.acao === 'Todas' || log.acao === filters.acao;
    const matchEntidade = filters.entidade === 'Todas' || log.entidade === filters.entidade;
    const matchDetalhes = !filters.detalhes || log.detalhes?.toLowerCase().includes(filters.detalhes.toLowerCase());
    
    const logDate = new Date(log.created_date);
    const matchDataInicio = !filters.dataInicio || logDate >= new Date(filters.dataInicio);
    const matchDataFim = !filters.dataFim || logDate <= new Date(filters.dataFim + 'T23:59:59');
    
    return matchEmail && matchAcao && matchEntidade && matchDetalhes && matchDataInicio && matchDataFim;
  });

  const hasActiveFilters = Object.values(filters).some(v => v && v !== 'Todas');

  const getAcaoColor = (acao) => {
    const colors = {
      'Criou': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Atualizou': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Excluiu': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Login': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      'Logout': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      'Convidou Usuário': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Alterou Permissão': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      'Exportou Relatório': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    };
    return colors[acao] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getAcaoIcon = (acao) => {
    if (acao === 'Criou') return '➕';
    if (acao === 'Atualizou') return '📝';
    if (acao === 'Excluiu') return '🗑️';
    if (acao === 'Login') return '🔓';
    if (acao === 'Logout') return '🔒';
    if (acao === 'Convidou Usuário') return '📨';
    if (acao === 'Alterou Permissão') return '🔐';
    if (acao === 'Exportou Relatório') return '📄';
    return '📋';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#ADF802]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Logs do Sistema</h1>
          <p className="text-gray-400 mt-1">Registro completo de todas as ações realizadas no painel</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#242424] border border-gray-800 rounded-xl">
          <Activity className="w-5 h-5 text-[#ADF802]" />
          <span className="text-sm text-gray-400">Total de eventos:</span>
          <span className="text-lg font-bold text-white">{filteredLogs.length}</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-[#242424] rounded-2xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-[#ADF802]" />
            <span className="font-medium text-white">Filtros Avançados</span>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-400 hover:text-white gap-1">
              <X className="w-3 h-3" />
              Limpar Filtros
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-gray-400 text-xs mb-2">Usuário (E-mail)</Label>
            <Input
              value={filters.usuario_email}
              onChange={(e) => setFilters({ ...filters, usuario_email: e.target.value })}
              className="bg-[#1a1a1a] border-gray-700"
              placeholder="Buscar por e-mail..."
            />
          </div>
          
          <div>
            <Label className="text-gray-400 text-xs mb-2">Ação</Label>
            <Select value={filters.acao} onValueChange={(value) => setFilters({ ...filters, acao: value })}>
              <SelectTrigger className="bg-[#1a1a1a] border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#242424] border-gray-700">
                {ACOES.map((acao) => (
                  <SelectItem key={acao} value={acao}>{acao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-400 text-xs mb-2">Entidade</Label>
            <Select value={filters.entidade} onValueChange={(value) => setFilters({ ...filters, entidade: value })}>
              <SelectTrigger className="bg-[#1a1a1a] border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#242424] border-gray-700">
                {ENTIDADES.map((entidade) => (
                  <SelectItem key={entidade} value={entidade}>{entidade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-400 text-xs mb-2">Data Início</Label>
            <Input
              type="date"
              value={filters.dataInicio}
              onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
              className="bg-[#1a1a1a] border-gray-700"
            />
          </div>

          <div>
            <Label className="text-gray-400 text-xs mb-2">Data Fim</Label>
            <Input
              type="date"
              value={filters.dataFim}
              onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
              className="bg-[#1a1a1a] border-gray-700"
            />
          </div>

          <div>
            <Label className="text-gray-400 text-xs mb-2">Detalhes</Label>
            <Input
              value={filters.detalhes}
              onChange={(e) => setFilters({ ...filters, detalhes: e.target.value })}
              className="bg-[#1a1a1a] border-gray-700"
              placeholder="Buscar em detalhes..."
            />
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-[#242424] rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-gray-800 bg-[#1a1a1a]">
                <th className="px-6 py-4 font-medium">Data/Hora</th>
                <th className="px-6 py-4 font-medium">Usuário</th>
                <th className="px-6 py-4 font-medium">Ação</th>
                <th className="px-6 py-4 font-medium">Entidade</th>
                <th className="px-6 py-4 font-medium">Detalhes</th>
                <th className="px-6 py-4 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-300 text-sm">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      {format(new Date(log.created_date), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#ADF802]/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-[#ADF802]" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{log.usuario_nome || '-'}</p>
                        <p className="text-gray-500 text-xs">{log.usuario_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getAcaoColor(log.acao)}`}>
                      <span>{getAcaoIcon(log.acao)}</span>
                      {log.acao}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-700/50 text-gray-300 border border-gray-700">
                      {log.entidade}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm max-w-md truncate">
                    {log.detalhes || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs font-mono">
                    {log.ip_address || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="lg:hidden space-y-4">
        {filteredLogs.map((log) => (
          <div key={log.id} className="bg-[#242424] rounded-2xl border border-gray-800 p-4">
            <div className="flex items-start justify-between mb-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getAcaoColor(log.acao)}`}>
                <span>{getAcaoIcon(log.acao)}</span>
                {log.acao}
              </span>
              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-700/50 text-gray-300">
                {log.entidade}
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-white text-sm font-medium">{log.usuario_nome || '-'}</p>
                  <p className="text-gray-500 text-xs">{log.usuario_email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <Calendar className="w-4 h-4" />
                {format(new Date(log.created_date), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </div>

              {log.detalhes && (
                <p className="text-sm text-gray-400 border-t border-gray-800 pt-2 mt-2">
                  {log.detalhes}
                </p>
              )}

              {log.ip_address && (
                <p className="text-xs text-gray-500 font-mono">
                  IP: {log.ip_address}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredLogs.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-gray-800 bg-[#242424]">
          <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-white mb-2">Nenhum log encontrado</p>
          <p className="text-gray-400">Ajuste os filtros ou aguarde novas ações no sistema</p>
        </div>
      )}
    </div>
  );
}