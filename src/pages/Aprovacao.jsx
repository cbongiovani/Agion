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
    queryFn: () => base44.entities.AprovacaoAtividade.list(),
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ['atividades'],
    queryFn: () => base44.entities.Atividade.list(),
  });

  const { data: fechamentos = [] } = useQuery({
    queryKey: ['fechamentos'],
    queryFn: () => base44.entities.FechamentoSemanal.list(),
  });

  const { data: incidentes = [] } = useQuery({
    queryKey: ['incidentes'],
    queryFn: () => base44.entities.Incidente.list(),
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
      queryClient.invalidateQueries({ queryKey: ['aprovacoes'] });
      queryClient.invalidateQueries({ queryKey: ['avaliacoes'] });
      queryClient.invalidateQueries({ queryKey: ['questoes'] });
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
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
      await base44.entities.AprovacaoAtividade.update(aprovacaoId, {
        status: 'rejeitado',
        motivo_rejeicao: rejectReason,
        aprovado_por: user.email,
        data_aprovacao: new Date().toISOString(),
      });
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'Aprovação',
        detalhes: `Rejeitou registro ID: ${aprovacaoId} - Motivo: ${rejectReason}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes'] });
      toast.success('Registro rejeitado!');
      setSelectedItem(null);
      setIsRejectDialogOpen(false);
      setRejectReason('');
    },
    onError: (error) => {
      toast.error('Erro ao rejeitar: ' + error.message);
    },
  });

  const atividadesPendentes = aprovacoes.filter(a => a.tipo === 'atividade' && a.status === 'pendente');
  const fechamentosPendentes = aprovacoes.filter(a => a.tipo === 'fechamento' && a.status === 'pendente');
  const warroomPendentes = aprovacoes.filter(a => a.tipo === 'warroom' && a.status === 'pendente');
  const avaliacoesPendentes = avaliacoes.filter(a => a.status === 'Pendente');
  const quizzesPendentes = quizzes.filter(q => q.status === 'Agendado');
  const questoesPendentes = questoes.filter(q => q.status === 'Pendente');

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-400 text-lg">Acesso apenas para coordenadores</p>
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
        <TabsList className="bg-[#0f1f35] border border-[#1e3a5f]">
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
          <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] p-6">
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
                  return (
                    <div key={item.id} className="bg-[#0f1f35] rounded-lg p-4 border border-[#1e3a5f] flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-white font-medium">{atividade?.tipo || 'Atividade'}</p>
                        <p className="text-sm text-gray-400 mt-1">
                          {new Date(atividade?.data).toLocaleDateString('pt-BR')}
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
          <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] p-6">
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
                    <div key={item.id} className="bg-[#0f1f35] rounded-lg p-4 border border-[#1e3a5f] flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-white font-medium">Fechamento Semanal</p>
                        <p className="text-sm text-gray-400 mt-1">
                          {new Date(fechamento?.semana_inicio).toLocaleDateString('pt-BR')} - {new Date(fechamento?.semana_fim).toLocaleDateString('pt-BR')}
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
          <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] p-6">
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
                    <div key={item.id} className="bg-[#0f1f35] rounded-lg p-4 border border-[#1e3a5f] flex items-center justify-between">
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
          <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Avaliações Pendentes ({avaliacoesPendentes.length})
            </h2>
            {avaliacoesPendentes.length === 0 ? (
              <p className="text-gray-400">Nenhuma avaliação pendente</p>
            ) : (
              <div className="space-y-3">
                {avaliacoesPendentes.map((item) => (
                  <div key={item.id} className="bg-[#0f1f35] rounded-lg p-4 border border-[#1e3a5f] flex items-center justify-between">
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
          <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Questões Pendentes ({questoesPendentes.length})
            </h2>
            {questoesPendentes.length === 0 ? (
              <p className="text-gray-400">Nenhuma questão pendente</p>
            ) : (
              <div className="space-y-3">
                {questoesPendentes.map((item) => (
                  <div key={item.id} className="bg-[#0f1f35] rounded-lg p-4 border border-[#1e3a5f] flex items-center justify-between">
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
          <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Quizzes Agendados ({quizzesPendentes.length})
            </h2>
            {quizzesPendentes.length === 0 ? (
              <p className="text-gray-400">Nenhum quiz agendado</p>
            ) : (
              <div className="space-y-3">
                {quizzesPendentes.map((item) => (
                  <div key={item.id} className="bg-[#0f1f35] rounded-lg p-4 border border-[#1e3a5f] flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white font-medium">{item.titulo}</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {new Date(item.data_inicio).toLocaleDateString('pt-BR')} às {new Date(item.data_inicio).toLocaleTimeString('pt-BR')}
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
        <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar Registro</DialogTitle>
          </DialogHeader>
          {selectedItem?.data && (
            <div className="space-y-4">
              <div className="bg-[#0f1f35] rounded-lg p-4 border border-[#1e3a5f]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(selectedItem.data).map(([key, value]) => (
                    <div key={key} className="border-b border-[#1e3a5f] pb-3 last:border-0">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">{key.replace(/_/g, ' ')}</p>
                      <p className="text-white font-medium mt-1 break-words">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value || '-')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent className="bg-[#0a1628] border-[#1e3a5f]">
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
              className="bg-[#0f1f35] border-[#1e3a5f] text-white"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#1e3a5f]">Cancelar</AlertDialogCancel>
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