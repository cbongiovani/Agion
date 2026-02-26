import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Clock, Eye } from 'lucide-react';
import { toast } from 'sonner';
import VisualizarAtividade from '@/components/VisualizarAtividade';

// Helper para formatar datas com segurança
const formatDateBR = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('pt-BR');
};

export default function Aprovacao() {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: aprovacoes = [] } = useQuery({
    queryKey: ['aprovacoes'],
    queryFn: () => base44.entities.AprovacaoAtividade.filter({ status: 'pendente' }),
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => {
      const aprovacoesPendentes = await base44.entities.AprovacaoAtividade.filter({ status: 'pendente' });
      const idsNecessarios = aprovacoesPendentes
        .filter(a => a.tipo === 'atividade' && a.atividade_id)
        .map(a => a.atividade_id);
      
      if (idsNecessarios.length === 0) return [];
      
      const todas = await base44.entities.Atividade.list();
      return todas.filter(a => idsNecessarios.includes(a.id));
    },
  });

  const { data: fechamentos = [] } = useQuery({
    queryKey: ['fechamentos'],
    queryFn: async () => {
      const aprovacoesPendentes = await base44.entities.AprovacaoAtividade.filter({ status: 'pendente' });
      const idsNecessarios = aprovacoesPendentes
        .filter(a => a.tipo === 'fechamento' && a.atividade_id)
        .map(a => a.atividade_id);
      
      if (idsNecessarios.length === 0) return [];
      
      const todos = await base44.entities.FechamentoSemanal.list();
      return todos.filter(f => idsNecessarios.includes(f.id));
    },
  });

  const { data: incidentes = [] } = useQuery({
    queryKey: ['incidentes'],
    queryFn: async () => {
      const aprovacoesPendentes = await base44.entities.AprovacaoAtividade.filter({ status: 'pendente' });
      const idsNecessarios = aprovacoesPendentes
        .filter(a => a.tipo === 'warroom' && a.atividade_id)
        .map(a => a.atividade_id);
      
      if (idsNecessarios.length === 0) return [];
      
      const todos = await base44.entities.Incidente.list();
      return todos.filter(i => idsNecessarios.includes(i.id));
    },
  });

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ['avaliacoes'],
    queryFn: () => base44.entities.Avaliacao.list(),
  });

  const { data: quizzes = [] } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => base44.entities.QuizzRelampago.list(),
  });

  const { data: questoes = [] } = useQuery({
    queryKey: ['questoes'],
    queryFn: () => base44.entities.Questao.list(),
  });

  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const aprovarMutation = useMutation({
    mutationFn: async (item) => {
      const user = await base44.auth.me();
      
      if (item.tipo === 'atividade' || item.tipo === 'fechamento' || item.tipo === 'warroom') {
        await base44.entities.AprovacaoAtividade.update(item.id, {
          status: 'aprovado',
          aprovado_por: user.email,
          data_aprovacao: new Date().toISOString(),
        });
      } else if (item.tipo === 'avaliacao') {
        await base44.entities.Avaliacao.update(item.id, { status: 'Concluída' });
      } else if (item.tipo === 'questao') {
        await base44.entities.Questao.update(item.id, { status: 'Aprovada' });
      } else if (item.tipo === 'quizz') {
        await base44.entities.QuizzRelampago.update(item.id, { status: 'Ativo' });
      }
      
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'Aprovação',
        detalhes: `Aprovou registro ID: ${item.id}`,
      });
    },
    onSuccess: () => {
      // Sincronização completa de TODAS as queries afetadas
      queryClient.invalidateQueries({ queryKey: ['aprovacoes'] });
      queryClient.invalidateQueries({ queryKey: ['avaliacoes'] });
      queryClient.invalidateQueries({ queryKey: ['questoes'] });
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      queryClient.invalidateQueries({ queryKey: ['fechamentos'] });
      queryClient.invalidateQueries({ queryKey: ['incidentes'] });
      queryClient.invalidateQueries({ queryKey: ['minhasAtividadesPendentes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ranking'] });
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      queryClient.invalidateQueries({ queryKey: ['perfilAnalista'] });
      queryClient.invalidateQueries({ queryKey: ['supervisores'] });
      toast.success('Registro aprovado com sucesso!');
      setSelectedItem(null);
      setIsViewDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Erro ao aprovar: ' + error.message);
    },
  });

  const rejeitarMutation = useMutation({
    mutationFn: async (aprovacaoId) => {
      const user = await base44.auth.me();
      const aprovacao = aprovacoes.find(a => a.id === aprovacaoId);
      
      await base44.entities.AprovacaoAtividade.update(aprovacaoId, {
        status: 'rejeitado',
        motivo_rejeicao: rejectReason,
        aprovado_por: user.email,
        data_aprovacao: new Date().toISOString(),
      });
      
      // Enviar notificação para o supervisor
      if (aprovacao) {
        let registro = null;
        if (aprovacao.tipo === 'atividade') {
          registro = atividades.find(a => a.id === aprovacao.atividade_id);
        } else if (aprovacao.tipo === 'fechamento') {
          registro = fechamentos.find(f => f.id === aprovacao.atividade_id);
        } else if (aprovacao.tipo === 'warroom') {
          registro = incidentes.find(i => i.id === aprovacao.atividade_id);
        }
        
        if (registro) {
          const supervisorEmail = registro.created_by || registro.registrado_por;
          if (supervisorEmail) {
            await base44.entities.Notificacao.create({
              destinatario_id: supervisorEmail,
              tipo: 'acao_corretiva',
              titulo: 'Registro Rejeitado',
              mensagem: `Seu registro foi rejeitado. Motivo: ${rejectReason}`,
              lida: false,
            });
          }
        }
      }
      
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'Aprovação',
        detalhes: `Rejeitou registro ID: ${aprovacaoId} - Motivo: ${rejectReason}`,
      });
    },
    onSuccess: () => {
      // Sincronização completa de TODAS as queries afetadas
      queryClient.invalidateQueries({ queryKey: ['aprovacoes'] });
      queryClient.invalidateQueries({ queryKey: ['minhasAtividadesPendentes'] });
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ranking'] });
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      queryClient.invalidateQueries({ queryKey: ['perfilAnalista'] });
      queryClient.invalidateQueries({ queryKey: ['supervisores'] });
      queryClient.invalidateQueries({ queryKey: ['fechamentos'] });
      queryClient.invalidateQueries({ queryKey: ['incidentes'] });
      toast.success('Registro rejeitado e supervisor notificado!');
      setSelectedItem(null);
      setIsRejectDialogOpen(false);
      setRejectReason('');
    },
    onError: (error) => {
      toast.error('Erro ao rejeitar: ' + error.message);
    },
  });

  const getSupervisorNome = (supervisorId) => {
    const supervisor = supervisores.find(s => s.id === supervisorId);
    if (supervisor) {
      const usuario = usuarios.find(u => u.email === supervisor.usuario_email);
      return usuario?.nome_customizado || usuario?.full_name || supervisor.nome || '-';
    }
    return '-';
  };

  const getAnalistaNome = (analistaId) => {
    const analista = analistas.find(a => a.id === analistaId);
    if (analista) {
      const usuario = usuarios.find(u => u.email === analista.usuario_email);
      return usuario?.nome_customizado || usuario?.full_name || analista.nome || '-';
    }
    return '-';
  };

  const atividadesPendentes = aprovacoes.filter(a => a.tipo === 'atividade' && a.status === 'pendente');
  const fechamentosPendentes = aprovacoes.filter(a => a.tipo === 'fechamento' && a.status === 'pendente');
  const warroomPendentes = aprovacoes.filter(a => a.tipo === 'warroom' && a.status === 'pendente');
  const avaliacoesPendentes = avaliacoes.filter(a => a.status === 'Pendente');
  const quizzesPendentes = quizzes.filter(q => q.status === 'Agendado');
  const questoesPendentes = questoes.filter(q => q.status === 'Pendente');

  const isLoadingAny = !atividades.length || !fechamentos.length || !incidentes.length;

  if (isLoadingAny) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-[#1a1a1a] rounded-lg animate-pulse"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[#0f1f35] rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Aprovação de Registros</h1>
        <p className="text-gray-400 mt-1">Gerenciar aprovações de atividades, avaliações e quizzes</p>
      </div>

      <Tabs defaultValue="atividades" className="space-y-4">
        <TabsList className="bg-[#1a1a1a] border border-gray-700">
          <TabsTrigger value="atividades" className="relative">
            Atividades
            {(atividadesPendentes.length + fechamentosPendentes.length + warroomPendentes.length) > 0 && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></div>
            )}
          </TabsTrigger>
          <TabsTrigger value="avaliacoes" className="relative">
            Avaliações
            {(avaliacoesPendentes.length + quizzesPendentes.length + questoesPendentes.length) > 0 && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></div>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="atividades" className="space-y-6">
          {/* Atividades */}
          <div className="bg-[#242424] rounded-2xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Atividades Pendentes ({atividadesPendentes.length})
            </h2>
            {atividadesPendentes.length === 0 ? (
              <p className="text-gray-400">Nenhuma atividade pendente de aprovação</p>
            ) : (
              <div className="space-y-3">
                {atividadesPendentes.map((item) => {
                  const atividade = atividades.find(a => a.id === item.atividade_id);
                  const supervisorNome = atividade?.supervisor_id ? getSupervisorNome(atividade.supervisor_id) : '-';
                  return (
                    <div key={item.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-white font-medium">{atividade?.tipo || 'Atividade'}</p>
                        <p className="text-sm text-gray-400 mt-1">
                          {formatDateBR(atividade?.data)} • {supervisorNome}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem({ ...item, data: atividade });
                            setIsViewDialogOpen(true);
                          }}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Visualizar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => aprovarMutation.mutate({ ...item, tipo: 'atividade' })}
                          className="text-green-400 hover:text-green-300"
                          disabled={aprovarMutation.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsRejectDialogOpen(true);
                          }}
                          className="text-red-400 hover:text-red-300"
                          disabled={rejeitarMutation.isPending}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fechamentos */}
          <div className="bg-[#242424] rounded-2xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Fechamentos Semanais Pendentes ({fechamentosPendentes.length})
            </h2>
            {fechamentosPendentes.length === 0 ? (
              <p className="text-gray-400">Nenhum fechamento pendente de aprovação</p>
            ) : (
              <div className="space-y-3">
                {fechamentosPendentes.map((item) => {
                  const fechamento = fechamentos.find(f => f.id === item.atividade_id);
                  return (
                    <div key={item.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700 flex items-center justify-between">
                       <div className="flex-1">
                         <p className="text-white font-medium">Fechamento Semanal</p>
                        <p className="text-sm text-gray-400 mt-1">
                          {formatDateBR(fechamento?.semana_inicio)} - {formatDateBR(fechamento?.semana_fim)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem({ ...item, data: fechamento });
                            setIsViewDialogOpen(true);
                          }}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Visualizar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => aprovarMutation.mutate({ ...item, tipo: 'fechamento' })}
                          className="text-green-400 hover:text-green-300"
                          disabled={aprovarMutation.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsRejectDialogOpen(true);
                          }}
                          className="text-red-400 hover:text-red-300"
                          disabled={rejeitarMutation.isPending}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* War Room */}
          <div className="bg-[#242424] rounded-2xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Incidentes War Room Pendentes ({warroomPendentes.length})
            </h2>
            {warroomPendentes.length === 0 ? (
              <p className="text-gray-400">Nenhum incidente pendente de aprovação</p>
            ) : (
              <div className="space-y-3">
                {warroomPendentes.map((item) => {
                  const incidente = incidentes.find(i => i.id === item.atividade_id);
                  return (
                    <div key={item.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700 flex items-center justify-between">
                       <div className="flex-1">
                         <p className="text-white font-medium">{incidente?.titulo}</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Severidade: {incidente?.severidade}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem({ ...item, data: incidente });
                            setIsViewDialogOpen(true);
                          }}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Visualizar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => aprovarMutation.mutate({ ...item, tipo: 'warroom' })}
                          className="text-green-400 hover:text-green-300"
                          disabled={aprovarMutation.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsRejectDialogOpen(true);
                          }}
                          className="text-red-400 hover:text-red-300"
                          disabled={rejeitarMutation.isPending}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="avaliacoes" className="space-y-6">
           {/* Avaliações */}
           <div className="bg-[#242424] rounded-2xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Avaliações Pendentes ({avaliacoesPendentes.length})
            </h2>
            {avaliacoesPendentes.length === 0 ? (
              <p className="text-gray-400">Nenhuma avaliação pendente</p>
            ) : (
              <div className="space-y-3">
                {avaliacoesPendentes.map((item) => (
                  <div key={item.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white font-medium">{item.titulo}</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Período: {item.periodo} {item.ano}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => aprovarMutation.mutate({ ...item, tipo: 'avaliacao' })}
                        className="text-green-400 hover:text-green-300"
                        disabled={aprovarMutation.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Publicar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedItem(item);
                          setIsRejectDialogOpen(true);
                        }}
                        className="text-red-400 hover:text-red-300"
                        disabled={rejeitarMutation.isPending}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Questões */}
          <div className="bg-[#242424] rounded-2xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Questões Pendentes ({questoesPendentes.length})
            </h2>
            {questoesPendentes.length === 0 ? (
              <p className="text-gray-400">Nenhuma questão pendente</p>
            ) : (
              <div className="space-y-3">
                {questoesPendentes.map((item) => (
                  <div key={item.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">{item.enunciado}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Categoria: {item.categoria} | Dificuldade: {item.dificuldade}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => aprovarMutation.mutate({ ...item, tipo: 'questao' })}
                        className="text-green-400 hover:text-green-300"
                        disabled={aprovarMutation.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedItem(item);
                          setIsRejectDialogOpen(true);
                        }}
                        className="text-red-400 hover:text-red-300"
                        disabled={rejeitarMutation.isPending}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quizzes */}
          <div className="bg-[#242424] rounded-2xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Quizzes Agendados ({quizzesPendentes.length})
            </h2>
            {quizzesPendentes.length === 0 ? (
              <p className="text-gray-400">Nenhum quiz agendado</p>
            ) : (
              <div className="space-y-3">
                {quizzesPendentes.map((item) => (
                  <div key={item.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white font-medium">{item.titulo}</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {formatDateBR(item.data_inicio)} às {new Date(item.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => aprovarMutation.mutate({ ...item, tipo: 'quizz' })}
                        className="text-green-400 hover:text-green-300"
                        disabled={aprovarMutation.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Publicar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedItem(item);
                          setIsRejectDialogOpen(true);
                        }}
                        className="text-red-400 hover:text-red-300"
                        disabled={rejeitarMutation.isPending}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItem?.tipo === 'atividade' ? 'Visualizar Atividade' : 'Visualizar Registro'}</DialogTitle>
          </DialogHeader>
          {selectedItem?.data && selectedItem.tipo === 'atividade' && (
            <VisualizarAtividade 
              atividade={selectedItem.data}
              supervisorNome={getSupervisorNome(selectedItem.data.supervisor_id)}
              analistaNome={getAnalistaNome(selectedItem.data.analista_id)}
            />
          )}
          {selectedItem?.data && selectedItem.tipo !== 'atividade' && (
            <div className="space-y-4">
             <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedItem.tipo === 'fechamento' && (
                    <>
                      <div className="border-b border-gray-700 pb-3">
                        <p className="text-xs text-gray-400 uppercase">Período</p>
                        <p className="text-white font-medium mt-1">
                          {formatDateBR(selectedItem.data.semana_inicio)} - {formatDateBR(selectedItem.data.semana_fim)}
                        </p>
                      </div>
                      <div className="border-b border-gray-700 pb-3">
                        <p className="text-xs text-gray-400 uppercase">Total Ligações Next IP</p>
                        <p className="text-white font-medium mt-1">{selectedItem.data.total_ligacoes_next_ip || 0}</p>
                      </div>
                      <div className="border-b border-gray-700 pb-3">
                        <p className="text-xs text-gray-400 uppercase">Total Chamados Verdana</p>
                        <p className="text-white font-medium mt-1">{selectedItem.data.total_chamados_verdana || 0}</p>
                      </div>
                      <div className="border-b border-gray-700 pb-3">
                        <p className="text-xs text-gray-400 uppercase">Total Monitorias</p>
                        <p className="text-white font-medium mt-1">{selectedItem.data.total_monitorias || 0}</p>
                      </div>
                      {selectedItem.data.observacoes && (
                        <div className="col-span-2 border-b border-[#1e3a5f] pb-3">
                          <p className="text-xs text-gray-400 uppercase">Observações</p>
                          <p className="text-white font-medium mt-1">{selectedItem.data.observacoes}</p>
                        </div>
                      )}
                    </>
                  )}
                  {selectedItem.tipo === 'warroom' && (
                    <>
                      <div className="border-b border-gray-700 pb-3">
                        <p className="text-xs text-gray-400 uppercase">Título</p>
                        <p className="text-white font-medium mt-1">{selectedItem.data.titulo || '-'}</p>
                      </div>
                      <div className="border-b border-gray-700 pb-3">
                        <p className="text-xs text-gray-400 uppercase">Severidade</p>
                        <p className="text-white font-medium mt-1">{selectedItem.data.severidade || '-'}</p>
                      </div>
                      <div className="border-b border-gray-700 pb-3">
                        <p className="text-xs text-gray-400 uppercase">Categoria</p>
                        <p className="text-white font-medium mt-1">{selectedItem.data.categoria || '-'}</p>
                      </div>
                      <div className="border-b border-gray-700 pb-3">
                        <p className="text-xs text-gray-400 uppercase">Status</p>
                        <p className="text-white font-medium mt-1">{selectedItem.data.status || '-'}</p>
                      </div>
                      {selectedItem.data.descricao && (
                        <div className="col-span-2 border-b border-[#1e3a5f] pb-3">
                          <p className="text-xs text-gray-400 uppercase">Descrição</p>
                          <p className="text-white font-medium mt-1">{selectedItem.data.descricao}</p>
                        </div>
                      )}
                    </>
                  )}
                  {!selectedItem.tipo && (
                    <>
                      {Object.entries(selectedItem.data).map(([key, value]) => (
                        <div key={key} className="border-b border-[#1e3a5f] pb-3 last:border-0">
                          <p className="text-xs text-gray-400 uppercase tracking-wide">{key.replace(/_/g, ' ')}</p>
                          <p className="text-white font-medium mt-1 break-words">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value || '-')}
                          </p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Rejeitar Registro</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Forneça um motivo para a rejeição:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo da rejeição..."
              className="bg-[#1a1a1a] border-gray-700 text-white"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rejectReason.trim()) {
                  rejeitarMutation.mutate(selectedItem.id);
                } else {
                  toast.error('Forneça um motivo para a rejeição');
                }
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={rejeitarMutation.isPending}
            >
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}