import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Clock, Eye } from 'lucide-react';
import { toast } from 'sonner';
import VisualizarAtividade from '@/components/VisualizarAtividade';

const formatDateBR = (value) => {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('pt-BR');
};

function toArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (maybe && Array.isArray(maybe.items)) return maybe.items;
  return [];
}

// pega a aprovação mais recente por (tipo + atividade_id)
function pickLatestApprovals(aprovacoes) {
  const map = new Map();
  for (const a of aprovacoes) {
    if (!a?.tipo || !a?.atividade_id) continue;
    const key = `${a.tipo}:${a.atividade_id}`;
    const t = new Date(a?.created_date || a?.created_at || a?.data_aprovacao || 0).getTime();
    const prev = map.get(key);
    const pt = prev ? new Date(prev?.created_date || prev?.created_at || prev?.data_aprovacao || 0).getTime() : -1;
    if (!prev || t >= pt) map.set(key, a);
  }
  return Array.from(map.values());
}

export default function Aprovacao() {
  const queryClient = useQueryClient();

  const [selectedItem, setSelectedItem] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 60 * 1000,
  });

  // ✅ 1) pega pendentes e deduplica
  const { data: aprovacoesPendentes = [] } = useQuery({
    queryKey: ['aprovacoesPendentes'],
    queryFn: async () => {
      const raw = await base44.entities.AprovacaoAtividade.list('-created_date', 500);
      const pendentes = toArray(raw).filter(a => a?.status === 'pendente' && a?.tipo && a?.atividade_id);
      return pickLatestApprovals(pendentes);
    },
    staleTime: 3000,
  });

  const atividadesIds = useMemo(
    () => aprovacoesPendentes.filter(a => a.tipo === 'atividade').map(a => a.atividade_id),
    [aprovacoesPendentes]
  );
  const fechamentosIds = useMemo(
    () => aprovacoesPendentes.filter(a => a.tipo === 'fechamento').map(a => a.atividade_id),
    [aprovacoesPendentes]
  );
  const incidentesIds = useMemo(
    () => aprovacoesPendentes.filter(a => a.tipo === 'warroom').map(a => a.atividade_id),
    [aprovacoesPendentes]
  );

  // ✅ 2) carrega registros necessários
  const { data: atividades = [] } = useQuery({
    queryKey: ['atividadesPendentes', atividadesIds.join('|')],
    enabled: atividadesIds.length > 0,
    queryFn: async () => {
      const raw = await base44.entities.Atividade.list('-created_date', 500);
      const set = new Set(atividadesIds);
      return toArray(raw).filter(a => set.has(a.id));
    },
  });

  const { data: fechamentos = [] } = useQuery({
    queryKey: ['fechamentosPendentes', fechamentosIds.join('|')],
    enabled: fechamentosIds.length > 0,
    queryFn: async () => {
      const raw = await base44.entities.FechamentoSemanal.list('-semana_inicio', 200);
      const set = new Set(fechamentosIds);
      return toArray(raw).filter(f => set.has(f.id));
    },
  });

  const { data: incidentes = [] } = useQuery({
    queryKey: ['incidentesPendentes', incidentesIds.join('|')],
    enabled: incidentesIds.length > 0,
    queryFn: async () => {
      const raw = await base44.entities.Incidente.list('-created_date', 200);
      const set = new Set(incidentesIds);
      return toArray(raw).filter(i => set.has(i.id));
    },
  });

  // Outras entidades (mantém teu padrão)
  const { data: avaliacoesRaw = [] } = useQuery({ queryKey: ['avaliacoes'], queryFn: () => base44.entities.Avaliacao.list() });
  const { data: quizzesRaw = [] } = useQuery({ queryKey: ['quizzes'], queryFn: () => base44.entities.QuizzRelampago.list() });
  const { data: questoesRaw = [] } = useQuery({ queryKey: ['questoes'], queryFn: () => base44.entities.Questao.list() });

  const avaliacoes = toArray(avaliacoesRaw);
  const quizzes = toArray(quizzesRaw);
  const questoes = toArray(questoesRaw);

  const { data: supervisoresRaw = [] } = useQuery({ queryKey: ['supervisores'], queryFn: () => base44.entities.Supervisor.list(), staleTime: 5 * 60 * 1000 });
  const { data: usuariosRaw = [] } = useQuery({ queryKey: ['usuarios'], queryFn: () => base44.entities.User.list(), staleTime: 5 * 60 * 1000 });
  const { data: analistasRaw = [] } = useQuery({ queryKey: ['analistas'], queryFn: () => base44.entities.Analista.list(), staleTime: 5 * 60 * 1000 });

  const supervisores = toArray(supervisoresRaw);
  const usuarios = toArray(usuariosRaw);
  const analistas = toArray(analistasRaw);

  const getSupervisorNome = (supervisorId) => {
    const supervisor = supervisores.find(s => s.id === supervisorId);
    const usuario = usuarios.find(u => u.email === supervisor?.usuario_email);
    return usuario?.nome_customizado || usuario?.full_name || supervisor?.nome || '-';
  };

  const getAnalistaNome = (analistaId) => {
    const analista = analistas.find(a => a.id === analistaId);
    const usuario = usuarios.find(u => u.email === analista?.usuario_email);
    return usuario?.nome_customizado || usuario?.full_name || analista?.nome || '-';
  };

  const atividadesPendentes = aprovacoesPendentes.filter(a => a.tipo === 'atividade');
  const fechamentosPendentes = aprovacoesPendentes.filter(a => a.tipo === 'fechamento');
  const warroomPendentes = aprovacoesPendentes.filter(a => a.tipo === 'warroom');

  const avaliacoesPendentes = avaliacoes.filter(a => a.status === 'Pendente');
  const quizzesPendentes = quizzes.filter(q => q.status === 'Agendado');
  const questoesPendentes = questoes.filter(q => q.status === 'Pendente');

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] });
    queryClient.invalidateQueries({ queryKey: ['atividadesPendentes'] });
    queryClient.invalidateQueries({ queryKey: ['fechamentosPendentes'] });
    queryClient.invalidateQueries({ queryKey: ['incidentesPendentes'] });
    queryClient.invalidateQueries({ queryKey: ['atividades'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['ranking'] });
    queryClient.invalidateQueries({ queryKey: ['rankings'] });
    queryClient.invalidateQueries({ queryKey: ['perfilAnalista'] });
  };

  const aprovarMutation = useMutation({
    mutationFn: async (item) => {
      const user = await base44.auth.me();

      if (item.tipo === 'atividade' || item.tipo === 'fechamento' || item.tipo === 'warroom') {
        await base44.entities.AprovacaoAtividade.update(item.id, {
          status: 'aprovado',
          aprovado_por: user.email,
          data_aprovacao: new Date().toISOString(),
          motivo_rejeicao: null,
        });
      } else if (item.tipo === 'avaliacao') {
        await base44.entities.Avaliacao.update(item.id, { status: 'Concluída' });
      } else if (item.tipo === 'questao') {
        await base44.entities.Questao.update(item.id, { status: 'Aprovada' });
      } else if (item.tipo === 'quizz') {
        await base44.entities.QuizzRelampago.update(item.id, { status: 'Ativo' });
      }

      try {
        await base44.entities.Log.create({
          usuario_email: user.email,
          usuario_nome: user.full_name,
          acao: 'Atualizou',
          entidade: 'Aprovação',
          detalhes: `Aprovou registro ID: ${item.id}`,
        });
      } catch {}
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Registro aprovado com sucesso!');
      setSelectedItem(null);
      setIsViewDialogOpen(false);
    },
    onError: (error) => toast.error('Erro ao aprovar: ' + (error?.message || 'Tente novamente')),
  });

  const rejeitarMutation = useMutation({
    mutationFn: async (aprovacaoId) => {
      const user = await base44.auth.me();
      const aprovacao = aprovacoesPendentes.find(a => a.id === aprovacaoId);

      await base44.entities.AprovacaoAtividade.update(aprovacaoId, {
        status: 'rejeitado',
        motivo_rejeicao: rejectReason,
        aprovado_por: user.email,
        data_aprovacao: new Date().toISOString(),
      });

      // notifica solicitante
      if (aprovacao) {
        let registro = null;
        if (aprovacao.tipo === 'atividade') registro = atividades.find(a => a.id === aprovacao.atividade_id);
        if (aprovacao.tipo === 'fechamento') registro = fechamentos.find(f => f.id === aprovacao.atividade_id);
        if (aprovacao.tipo === 'warroom') registro = incidentes.find(i => i.id === aprovacao.atividade_id);

        const solicitanteEmail = registro?.created_by || registro?.registrado_por;
        if (solicitanteEmail) {
          try {
            await base44.entities.Notificacao.create({
              destinatario_id: solicitanteEmail,
              tipo: 'acao_corretiva',
              titulo: 'Registro Rejeitado',
              mensagem: `Seu registro foi rejeitado. Motivo: ${rejectReason}`,
              lida: false,
            });
          } catch {}
        }
      }

      try {
        await base44.entities.Log.create({
          usuario_email: user.email,
          usuario_nome: user.full_name,
          acao: 'Atualizou',
          entidade: 'Aprovação',
          detalhes: `Rejeitou registro ID: ${aprovacaoId} - Motivo: ${rejectReason}`,
        });
      } catch {}
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Registro rejeitado e solicitante notificado!');
      setSelectedItem(null);
      setIsRejectDialogOpen(false);
      setRejectReason('');
    },
    onError: (error) => toast.error('Erro ao rejeitar: ' + (error?.message || 'Tente novamente')),
  });

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
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </TabsTrigger>
          <TabsTrigger value="avaliacoes" className="relative">
            Avaliações
            {(avaliacoesPendentes.length + quizzesPendentes.length + questoesPendentes.length) > 0 && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
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
                {atividadesPendentes.map((ap) => {
                  const atividade = atividades.find(a => a.id === ap.atividade_id);
                  const supervisorNome = atividade?.supervisor_id ? getSupervisorNome(atividade.supervisor_id) : '-';

                  return (
                    <div key={ap.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700 flex items-center justify-between">
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
                            setSelectedItem({ ...ap, data: atividade });
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
                          onClick={() => aprovarMutation.mutate({ ...ap, tipo: 'atividade' })}
                          className="text-green-400 hover:text-green-300"
                          disabled={aprovarMutation.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(ap);
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
                {fechamentosPendentes.map((ap) => {
                  const fechamento = fechamentos.find(f => f.id === ap.atividade_id);

                  return (
                    <div key={ap.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700 flex items-center justify-between">
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
                            setSelectedItem({ ...ap, data: fechamento });
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
                          onClick={() => aprovarMutation.mutate({ ...ap, tipo: 'fechamento' })}
                          className="text-green-400 hover:text-green-300"
                          disabled={aprovarMutation.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(ap);
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
                {warroomPendentes.map((ap) => {
                  const incidente = incidentes.find(i => i.id === ap.atividade_id);

                  return (
                    <div key={ap.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-white font-medium">{incidente?.titulo || 'Incidente'}</p>
                        <p className="text-sm text-gray-400 mt-1">Severidade: {incidente?.severidade || '-'}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem({ ...ap, data: incidente });
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
                          onClick={() => aprovarMutation.mutate({ ...ap, tipo: 'warroom' })}
                          className="text-green-400 hover:text-green-300"
                          disabled={aprovarMutation.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(ap);
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
                      <p className="text-sm text-gray-400 mt-1">Período: {item.periodo} {item.ano}</p>
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
                      <p className="text-xs text-gray-400 mt-1">Categoria: {item.categoria} | Dificuldade: {item.dificuldade}</p>
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
                <pre className="text-xs text-gray-200 whitespace-pre-wrap break-words">
                  {JSON.stringify(selectedItem.data, null, 2)}
                </pre>
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
            <AlertDialogDescription className="text-gray-400">Forneça um motivo para a rejeição:</AlertDialogDescription>
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
                if (!rejectReason.trim()) return toast.error('Forneça um motivo para a rejeição');
                rejeitarMutation.mutate(selectedItem.id);
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