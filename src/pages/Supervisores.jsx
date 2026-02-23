import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Users, Loader2, TrendingUp, TrendingDown, Award, AlertCircle, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Supervisores() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [expandedSupervisor, setExpandedSupervisor] = useState(null);
  const [formData, setFormData] = useState({ nome: '', equipe: '' });

  const { data: supervisores = [], isLoading } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ['atividades'],
    queryFn: () => base44.entities.Atividade.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Supervisor.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisores'] });
      toast.success('Supervisor criado com sucesso!');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supervisor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisores'] });
      toast.success('Supervisor atualizado com sucesso!');
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Supervisor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisores'] });
      toast.success('Supervisor excluído com sucesso!');
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setFormData({ nome: '', equipe: '' });
    setEditingSupervisor(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSupervisor) {
      updateMutation.mutate({ id: editingSupervisor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (supervisor) => {
    setEditingSupervisor(supervisor);
    setFormData({ nome: supervisor.nome, equipe: supervisor.equipe });
    setIsDialogOpen(true);
  };

  const getAnalistasCount = (supervisorId) => {
    return analistas.filter(a => a.supervisor_id === supervisorId).length;
  };

  const getCurrentMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { firstDay, lastDay };
  };

  const getSupervisorData = (supervisorId) => {
    const { firstDay, lastDay } = getCurrentMonthRange();
    const teamAnalysts = analistas.filter(a => a.supervisor_id === supervisorId);
    const teamActivities = atividades.filter(ativ => {
      const ativDate = new Date(ativ.data);
      return ativ.supervisor_id === supervisorId && 
             ativDate >= firstDay && 
             ativDate <= lastDay;
    });

    const analystStats = teamAnalysts.map(analyst => {
      const analystActivities = teamActivities.filter(a => a.analista_id === analyst.id);
      const totalActivities = analystActivities.length;
      const avgNota = totalActivities > 0
        ? analystActivities.reduce((sum, a) => sum + (a.nota || 0), 0) / totalActivities
        : 0;
      
      const byType = {
        'Chamados': analystActivities.filter(a => a.tipo === 'Chamados').length,
        'Ligações': analystActivities.filter(a => a.tipo === 'Ligações').length,
        'Monitoria Offline': analystActivities.filter(a => a.tipo === 'Monitoria Offline').length,
        'Monitoria Assistida': analystActivities.filter(a => a.tipo === 'Monitoria Assistida').length,
        'Feedback Individual': analystActivities.filter(a => a.tipo === 'Feedback Individual').length,
      };

      return {
        ...analyst,
        totalActivities,
        avgNota: parseFloat(avgNota.toFixed(2)),
        byType,
        activities: analystActivities
      };
    });

    analystStats.sort((a, b) => b.avgNota - a.avgNota);

    const best = analystStats[0];
    const worst = analystStats[analystStats.length - 1];

    const teamAvg = analystStats.length > 0
      ? analystStats.reduce((sum, a) => sum + a.avgNota, 0) / analystStats.length
      : 0;

    const totalActivities = teamActivities.length;

    return {
      analystStats,
      best,
      worst,
      teamAvg: parseFloat(teamAvg.toFixed(2)),
      totalActivities,
      teamAnalysts
    };
  };

  const toggleSupervisor = (supervisorId) => {
    setExpandedSupervisor(expandedSupervisor === supervisorId ? null : supervisorId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Supervisores</h1>
          <p className="text-gray-400 mt-1">Gerencie os supervisores do Suporte N1</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Plus className="w-4 h-4" />
              Novo Supervisor
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#242424] border-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>{editingSupervisor ? 'Editar Supervisor' : 'Novo Supervisor'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="bg-[#1a1a1a] border-gray-700 mt-2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="equipe">Equipe</Label>
                <Input
                  id="equipe"
                  value={formData.equipe}
                  onChange={(e) => setFormData({ ...formData, equipe: e.target.value })}
                  className="bg-[#1a1a1a] border-gray-700 mt-2"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="border-gray-700">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                  {editingSupervisor ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {supervisores.map((supervisor) => {
          const supervisorData = getSupervisorData(supervisor.id);
          const isExpanded = expandedSupervisor === supervisor.id;
          const { firstDay, lastDay } = getCurrentMonthRange();

          return (
            <div key={supervisor.id} className="space-y-4">
              <div
                onClick={() => toggleSupervisor(supervisor.id)}
                className="bg-[#242424] rounded-2xl border border-gray-800 p-6 hover:border-emerald-500/30 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <span className="text-emerald-400 font-bold text-lg">
                        {supervisor.nome.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{supervisor.nome}</h3>
                      <p className="text-sm text-gray-400">{supervisor.equipe}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); openEdit(supervisor); }}
                      className="text-gray-400 hover:text-white"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(supervisor.id); }}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>{getAnalistasCount(supervisor.id)} analistas</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Target className="w-4 h-4" />
                    <span>Média: {supervisorData.teamAvg}</span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-4 pl-4">
                  {/* Período */}
                  <Card className="bg-[#0a1628] border-[#1e3a5f] p-4">
                    <p className="text-sm text-gray-400">
                      Período de Avaliação: <span className="text-white font-medium">{firstDay.toLocaleDateString('pt-BR')} - {lastDay.toLocaleDateString('pt-BR')}</span>
                    </p>
                  </Card>

                  {/* Indicadores Gerais */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-[#0a1628] border-[#1e3a5f] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <Target className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Média da Equipe</p>
                          <p className="text-2xl font-bold text-white">{supervisorData.teamAvg}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="bg-[#0a1628] border-[#1e3a5f] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Total de Atividades</p>
                          <p className="text-2xl font-bold text-white">{supervisorData.totalActivities}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="bg-[#0a1628] border-[#1e3a5f] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                          <Award className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Analistas Ativos</p>
                          <p className="text-2xl font-bold text-white">{supervisorData.teamAnalysts.length}</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Pontos Positivos e Negativos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-emerald-500/10 border-emerald-500/30 p-4">
                      <div className="flex items-start gap-3">
                        <TrendingUp className="w-5 h-5 text-emerald-400 mt-1" />
                        <div>
                          <h3 className="font-semibold text-emerald-400 mb-2">Pontos Positivos</h3>
                          {supervisorData.best ? (
                            <ul className="text-sm text-gray-300 space-y-1">
                              <li>• Melhor analista: <strong>{supervisorData.best.nome}</strong> com média {supervisorData.best.avgNota}</li>
                              <li>• {supervisorData.best.totalActivities} atividades registradas</li>
                              {supervisorData.teamAvg >= 8 && <li>• Equipe com média alta ({supervisorData.teamAvg})</li>}
                              {supervisorData.totalActivities >= 20 && <li>• Alto volume de atividades no período</li>}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-400">Sem dados no período</p>
                          )}
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-red-500/10 border-red-500/30 p-4">
                      <div className="flex items-start gap-3">
                        <TrendingDown className="w-5 h-5 text-red-400 mt-1" />
                        <div>
                          <h3 className="font-semibold text-red-400 mb-2">Pontos de Atenção</h3>
                          {supervisorData.worst ? (
                            <ul className="text-sm text-gray-300 space-y-1">
                              <li>• Analista com menor média: <strong>{supervisorData.worst.nome}</strong> ({supervisorData.worst.avgNota})</li>
                              {supervisorData.worst.totalActivities < 5 && <li>• Poucas atividades registradas ({supervisorData.worst.totalActivities})</li>}
                              {supervisorData.teamAvg < 7 && <li>• Média da equipe abaixo do esperado</li>}
                              {supervisorData.totalActivities < 10 && <li>• Volume de atividades baixo no período</li>}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-400">Sem dados no período</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Plano de Ação */}
                  <Card className="bg-[#0a1628] border-[#1e3a5f] p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-[#ADF802] mt-1" />
                      <div>
                        <h3 className="font-semibold text-[#ADF802] mb-2">Recomendações para Evolução</h3>
                        <ul className="text-sm text-gray-300 space-y-1">
                          {supervisorData.worst && supervisorData.worst.avgNota < 7 && (
                            <li>• Agendar feedback individual com {supervisorData.worst.nome} para entender dificuldades</li>
                          )}
                          {supervisorData.worst && supervisorData.worst.totalActivities < 5 && (
                            <li>• Aumentar frequência de monitorias para {supervisorData.worst.nome}</li>
                          )}
                          {supervisorData.teamAvg < 8 && (
                            <li>• Realizar treinamento coletivo sobre os principais gaps identificados</li>
                          )}
                          {supervisorData.totalActivities < 20 && (
                            <li>• Estabelecer meta mínima de atividades por analista no mês</li>
                          )}
                          <li>• Reconhecer e compartilhar boas práticas de {supervisorData.best?.nome || 'top performers'}</li>
                        </ul>
                      </div>
                    </div>
                  </Card>

                  {/* Ranking */}
                  <Card className="bg-[#0a1628] border-[#1e3a5f] p-6">
                    <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" />
                      Ranking da Equipe
                    </h3>
                    <div className="space-y-3">
                      {supervisorData.analystStats.map((analyst, index) => (
                        <div 
                          key={analyst.id}
                          className={`p-4 rounded-lg border ${
                            index === 0 
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : index === supervisorData.analystStats.length - 1 && supervisorData.analystStats.length > 1
                              ? 'bg-red-500/10 border-red-500/30'
                              : 'bg-[#0f1f35] border-[#1e3a5f]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className={`text-2xl font-bold ${
                                index === 0 ? 'text-emerald-400' : 
                                index === supervisorData.analystStats.length - 1 && supervisorData.analystStats.length > 1 ? 'text-red-400' : 'text-gray-400'
                              }`}>
                                #{index + 1}
                              </span>
                              <div>
                                <p className="font-semibold text-white">{analyst.nome}</p>
                                <p className="text-xs text-gray-400">Média: {analyst.avgNota} | {analyst.totalActivities} atividades</p>
                              </div>
                            </div>
                            {index === 0 && <Award className="w-6 h-6 text-amber-400" />}
                            {index === supervisorData.analystStats.length - 1 && supervisorData.analystStats.length > 1 && (
                              <AlertCircle className="w-6 h-6 text-red-400" />
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-2">
                            {index === 0 && (
                              <p className="text-emerald-400">
                                ✓ Melhor desempenho devido a {analyst.avgNota >= 8 ? 'notas consistentemente altas' : 'bom volume de atividades'} 
                                {analyst.totalActivities >= 10 && ' e alto engajamento'}
                              </p>
                            )}
                            {index === supervisorData.analystStats.length - 1 && supervisorData.analystStats.length > 1 && (
                              <p className="text-red-400">
                                ⚠ Necessita atenção: {analyst.avgNota < 7 ? 'média abaixo do esperado' : ''}
                                {analyst.totalActivities < 5 ? ' poucos registros de atividades' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Gráfico de Desempenho */}
                  {supervisorData.analystStats.length > 0 && (
                    <Card className="bg-[#0a1628] border-[#1e3a5f] p-6">
                      <h3 className="font-semibold text-white mb-4">Desempenho por Analista</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={supervisorData.analystStats}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                          <XAxis 
                            dataKey="nome" 
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                          />
                          <YAxis 
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                            domain={[0, 10]}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#0a1628', 
                              border: '1px solid #1e3a5f',
                              borderRadius: '8px'
                            }}
                          />
                          <Bar dataKey="avgNota" fill="#10b981" name="Média" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {supervisores.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum supervisor cadastrado</p>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir este supervisor? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}