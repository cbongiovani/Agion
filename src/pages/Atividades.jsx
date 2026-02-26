import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Plus,
  Pencil,
  Trash2,
  Filter,
  Loader2,
  Eye,
  AlertTriangle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getLocalDateString, ensureCorrectDate } from '@/components/dateUtils';
import { notificarCoordenadores } from '@/components/notificationHelper';
import AtividadeInfoTooltip from '@/components/AtividadeInfoTooltip';
import MonitoriaOfflineForm from '@/components/MonitoriaOfflineForm';
import MonitoriaAssistidaForm from '@/components/MonitoriaAssistidaForm';
import { getUserModulePermissions, isModuleVisible } from '@/components/rbacHelpers';
import { MODULES } from '@/components/moduleConstants';

export default function Atividades() {
  const queryClient = useQueryClient();

  // ✅ Lock anti-double-submit (síncrono)
  const submitLockRef = useRef(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAtividade, setEditingAtividade] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedType, setSelectedType] = useState('Chamados');
  const [viewingAtividade, setViewingAtividade] = useState(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Filtros
  const [filterSupervisor, setFilterSupervisor] = useState('');
  const [filterAnalista, setFilterAnalista] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [filterIdBusca, setFilterIdBusca] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteMultipleDialogOpen, setDeleteMultipleDialogOpen] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 60 * 1000,
  });

  const { data: modulePermissions } = useQuery({
    queryKey: ['modulePermissions', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;
      return await getUserModulePermissions(currentUser.email, currentUser.role);
    },
    enabled: !!currentUser?.email,
  });

  const canCreate =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'supervisor' ||
    isModuleVisible(modulePermissions, MODULES.ATIVIDADES);

  const canEdit =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'supervisor' ||
    modulePermissions?.modules?.[MODULES.ATIVIDADES]?.edit === true;

  const canDelete =
    currentUser?.role === 'admin' ||
    modulePermissions?.modules?.[MODULES.ATIVIDADES]?.edit === true;

  const [formData, setFormData] = useState({
    tipo: 'Chamados',
    analista_id: '',
    supervisor_id: '',
    protocolo_gravacao: '',
    link_gravacao_teams: '',
    ticket_acompanhado: '',
    tipo_feedback: '',
    topicos_monitoria_offline: {},
    topicos_monitoria_assistida: {},
    nota: '',
    comentario: '',
    status: 'Aberto',
  });

  // Carregamentos base
  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Lista + merge de aprovação
  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ['atividades', currentUser?.role],
    enabled: !!currentUser,
    staleTime: 3000,
    queryFn: async () => {
      const todasAtividades = await base44.entities.Atividade.list('-created_date');

      // Dedup por id
      const mapUnique = {};
      (todasAtividades || []).forEach((ativ) => {
        const id = String(ativ?.id);
        if (!id) return;
        if (!mapUnique[id]) mapUnique[id] = ativ;
      });
      const atividadesUnicas = Object.values(mapUnique);

      // Aprovações
      const todasAprovacoes = await base44.entities.AprovacaoAtividade.list('-created_date', 1000);
      const aprovacaoPorAtividadeId = {};

      (todasAprovacoes || []).forEach((aprov) => {
        if (aprov?.tipo !== 'atividade') return;
        const aId = String(aprov?.atividade_id);
        if (!aId) return;

        // pega a mais recente
        const newTime = new Date(aprov?.created_date || aprov?.created_at || aprov?.data_aprovacao || 0).getTime();
        const old = aprovacaoPorAtividadeId[aId];
        const oldTime = new Date(old?.created_date || old?.created_at || old?.data_aprovacao || 0).getTime();
        if (!old || newTime >= oldTime) aprovacaoPorAtividadeId[aId] = aprov;
      });

      const atividadesComAprovacao = atividadesUnicas.map((ativ) => {
        const id = String(ativ.id);
        const aprov = aprovacaoPorAtividadeId[id];
        return {
          ...ativ,
          aprovacao_status: aprov?.status || 'pendente',
          aprovacao_data: aprov?.data_aprovacao,
          aprovacao_motivo_rejeicao: aprov?.motivo_rejeicao,
        };
      });

      const idsAprovados = new Set(
        Object.keys(aprovacaoPorAtividadeId).filter(
          (id) => aprovacaoPorAtividadeId[id]?.status === 'aprovado'
        )
      );

      // Admin vê tudo
      if (currentUser?.role === 'admin') return atividadesComAprovacao;

      // Supervisor: aprovados + próprios (pendentes/rejeitados)
      if (currentUser?.role === 'supervisor') {
        return atividadesComAprovacao.filter((ativ) => {
          const id = String(ativ.id);
          return (
            idsAprovados.has(id) ||
            ativ.registrado_por === currentUser.email ||
            ativ.created_by === currentUser.email
          );
        });
      }

      // Outros: apenas aprovadas
      return atividadesComAprovacao.filter((ativ) => idsAprovados.has(String(ativ.id)));
    },
  });

  const resetForm = () => {
    setFormData({
      tipo: 'Chamados',
      analista_id: '',
      supervisor_id: '',
      protocolo_gravacao: '',
      link_gravacao_teams: '',
      ticket_acompanhado: '',
      tipo_feedback: '',
      topicos_monitoria_offline: {},
      topicos_monitoria_assistida: {},
      nota: '',
      comentario: '',
      status: 'Aberto',
    });
    setEditingAtividade(null);
    setSelectedType('Chamados');
    submitLockRef.current = false;
  };

  const getSupervisorNome = (id) => {
    const supervisor = supervisores.find((s) => String(s.id) === String(id));
    const usuario = usuarios.find((u) => u.email === supervisor?.usuario_email);
    return usuario?.nome_customizado || usuario?.full_name || supervisor?.nome || '-';
  };

  const getAnalistaNome = (id) => {
    const analista = analistas.find((a) => String(a.id) === String(id));
    const usuario = usuarios.find((u) => u.email === analista?.usuario_email);
    return usuario?.nome_customizado || usuario?.full_name || analista?.nome || '-';
  };

  const handleAnalistaChange = (analistaId) => {
    const analista = analistas.find((a) => String(a.id) === String(analistaId));
    setFormData((prev) => ({
      ...prev,
      analista_id: String(analistaId),
      supervisor_id: analista?.supervisor_id ? String(analista.supervisor_id) : '',
    }));
  };

  const handleTipoChange = (tipo) => {
    setSelectedType(tipo);
    setFormData((prev) => ({ ...prev, tipo }));
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const prefixos = {
        Chamados: 'CH',
        Ligações: 'LG',
        'Monitoria Offline': 'MO',
        'Monitoria Assistida': 'MA',
        'Feedback Individual': 'FB',
      };

      // ✅ validações mínimas (evita “não aconteceu nada”)
      if (!data?.analista_id) {
        throw new Error('Selecione um Analista.');
      }
      if (!data?.supervisor_id) {
        throw new Error('Supervisor não identificado. Selecione o Analista novamente.');
      }

      // gera código
      const atividadesMesmoTipo = await base44.entities.Atividade.filter({ tipo: data.tipo });
      const codigosExistentes = (atividadesMesmoTipo || [])
        .map((a) => a.codigo_atividade)
        .filter((c) => c && c.startsWith(prefixos[data.tipo]));
      let proximoNumero = 1;
      if (codigosExistentes.length > 0) {
        const numeros = codigosExistentes.map((c) => parseInt(String(c).slice(2), 10)).filter((n) => !Number.isNaN(n));
        proximoNumero = (numeros.length ? Math.max(...numeros) : 0) + 1;
      }
      const codigoAtividade = `${prefixos[data.tipo]}${String(proximoNumero).padStart(5, '0')}`;

      const user = await base44.auth.me();

      // ✅ cria atividade
      const atividadeCriada = await base44.entities.Atividade.create({
        ...data,
        codigo_atividade: codigoAtividade,
        registrado_por: user.email,
      });

      const atividadeId = String(atividadeCriada?.id);

      // ✅ idempotência da aprovação: se já existir, não criar de novo
      try {
        const jaExiste = await base44.entities.AprovacaoAtividade.filter({
          atividade_id: atividadeId,
          tipo: 'atividade',
        });

        if (!jaExiste || jaExiste.length === 0) {
          await base44.entities.AprovacaoAtividade.create({
            atividade_id: atividadeId,
            tipo: 'atividade',
            status: 'pendente',
          });
        }
      } catch (aprovacaoError) {
        // ✅ rollback para não “sumir” a criação
        try {
          await base44.entities.Atividade.delete(atividadeId);
        } catch {}
        throw new Error(aprovacaoError?.message || 'Falha ao criar aprovação. Registro cancelado.');
      }

      // logs + notificação
      try {
        await base44.entities.Log.create({
          usuario_email: user.email,
          usuario_nome: user.full_name,
          acao: 'Criou',
          entidade: 'Atividade',
          detalhes: `Registrou atividade ${codigoAtividade} do tipo ${data.tipo}`,
        });
      } catch {}

      try {
        await notificarCoordenadores(
          'nova_atividade',
          'Nova Atividade Registrada',
          `${user.full_name} registrou uma nova atividade ${codigoAtividade} do tipo ${data.tipo} - Aguardando aprovação`,
          'Aprovacao'
        );
      } catch {}

      return atividadeCriada;
    },

    onSuccess: () => {
      // ✅ FECHA MODAL SEM ENROLO
      setIsDialogOpen(false);
      resetForm();

      // ✅ invalida as queries CERTAS (incluindo a tela de aprovação)
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      queryClient.invalidateQueries({ queryKey: ['atividades', currentUser?.role] });
      queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] });
      queryClient.invalidateQueries({ queryKey: ['minhasAtividadesPendentes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      setShowSuccessDialog(true);
    },

    onError: (error) => {
      toast.error('❌ Erro ao registrar atividade', {
        description: error?.message || 'Tente novamente',
        duration: 5000,
      });
    },

    onSettled: () => {
      // ✅ SEMPRE libera lock
      submitLockRef.current = false;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const result = await base44.entities.Atividade.update(id, data);
      const user = await base44.auth.me();
      try {
        await base44.entities.Log.create({
          usuario_email: user.email,
          usuario_nome: user.full_name,
          acao: 'Atualizou',
          entidade: 'Atividade',
          detalhes: `Atualizou atividade`,
        });
      } catch {}
      return result;
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      queryClient.invalidateQueries({ queryKey: ['atividades', currentUser?.role] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowSuccessDialog(true);
    },
    onError: (error) => {
      toast.error('❌ Erro ao atualizar atividade', {
        description: error?.message || 'Tente novamente',
        duration: 5000,
      });
    },
    onSettled: () => {
      submitLockRef.current = false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const user = await base44.auth.me();
      await base44.entities.Atividade.delete(id);
      try {
        await base44.entities.Log.create({
          usuario_email: user.email,
          usuario_nome: user.full_name,
          acao: 'Excluiu',
          entidade: 'Atividade',
          detalhes: `Excluiu atividade`,
        });
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      queryClient.invalidateQueries({ queryKey: ['atividades', currentUser?.role] });
      queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Atividade excluída com sucesso!');
      setDeleteId(null);
    },
  });

  const deleteMultipleMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      for (const id of selectedIds) {
        await base44.entities.Atividade.delete(id);
      }
      try {
        await base44.entities.Log.create({
          usuario_email: user.email,
          usuario_nome: user.full_name,
          acao: 'Excluiu',
          entidade: 'Atividade',
          detalhes: `Excluiu ${selectedIds.size} atividades em massa`,
        });
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      queryClient.invalidateQueries({ queryKey: ['atividades', currentUser?.role] });
      queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`${selectedIds.size} atividades excluídas com sucesso!`);
      setSelectedIds(new Set());
      setDeleteMultipleDialogOpen(false);
    },
  });

  const limparFiltros = () => {
    setFilterSupervisor('');
    setFilterAnalista('');
    setFilterTipo('');
    setFilterDataInicio('');
    setFilterDataFim('');
    setFilterIdBusca('');
    setCurrentPage(1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // ✅ lock anti-double-submit
    if (submitLockRef.current || createMutation.isPending || updateMutation.isPending) return;
    submitLockRef.current = true;

    const dataAtual = new Date();
    const dataFormatada = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}-${String(
      dataAtual.getDate()
    ).padStart(2, '0')}`;

    const payload = {
      ...formData,
      data: editingAtividade ? ensureCorrectDate(formData.data) : dataFormatada,
      nota: parseFloat(formData.nota) || 0,
      tipo: selectedType,
    };

    if (editingAtividade) {
      updateMutation.mutate({ id: editingAtividade.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEdit = (atividade) => {
    submitLockRef.current = false;
    setEditingAtividade(atividade);
    setFormData({
      data: atividade.data,
      tipo: atividade.tipo,
      analista_id: atividade.analista_id ? String(atividade.analista_id) : '',
      supervisor_id: atividade.supervisor_id ? String(atividade.supervisor_id) : '',
      protocolo_gravacao: atividade.protocolo_gravacao || '',
      link_gravacao_teams: atividade.link_gravacao_teams || '',
      ticket_acompanhado: atividade.ticket_acompanhado || '',
      tipo_feedback: atividade.tipo_feedback || '',
      topicos_monitoria_offline: atividade.topicos_monitoria_offline || {},
      topicos_monitoria_assistida: atividade.topicos_monitoria_assistida || {},
      nota: atividade.nota?.toString() || '',
      comentario: atividade.comentario || '',
      status: atividade.status || 'Aberto',
    });
    setSelectedType(atividade.tipo);
    setIsDialogOpen(true);
  };

  const getTipoColor = (tipo) => {
    const colors = {
      Chamados: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      Ligações: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      'Monitoria Offline': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Monitoria Assistida': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'Feedback Individual': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    };
    return colors[tipo] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getNotaBadgeColor = (nota) => {
    const n = Number(nota || 0);
    if (n >= 9) return 'bg-emerald-500 text-white';
    if (n >= 7) return 'bg-yellow-500 text-black';
    return 'bg-red-500 text-white';
  };

  const getStatusColor = (status) => {
    if (status === 'Concluído') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (status === 'Em evolução') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const atividadesFiltradas = (atividades || [])
    .filter((ativ) => {
      if (filterIdBusca && !String(ativ.codigo_atividade || '').toLowerCase().includes(filterIdBusca.toLowerCase()))
        return false;

      if (filterSupervisor && !getSupervisorNome(ativ.supervisor_id).toLowerCase().includes(filterSupervisor.toLowerCase()))
        return false;

      if (filterAnalista && !getAnalistaNome(ativ.analista_id).toLowerCase().includes(filterAnalista.toLowerCase()))
        return false;

      if (filterTipo && !String(ativ.tipo || '').toLowerCase().includes(filterTipo.toLowerCase()))
        return false;

      if (filterDataInicio && String(ativ.data || '') < filterDataInicio) return false;
      if (filterDataFim && String(ativ.data || '') > filterDataFim) return false;

      return true;
    })
    .sort((a, b) => {
      const analistaA = getAnalistaNome(a.analista_id).toLowerCase();
      const analistaB = getAnalistaNome(b.analista_id).toLowerCase();
      return analistaA.localeCompare(analistaB);
    });

  const totalRegistros = atividadesFiltradas.length;
  const totalPaginas = Math.ceil(totalRegistros / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const atividadesPaginadas = atividadesFiltradas.slice(startIndex, endIndex);

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
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Atividades</h1>
          <p className="text-gray-400 mt-1">Registre e gerencie as atividades do Suporte N1</p>
        </div>

        {canCreate && (
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                resetForm();
                submitLockRef.current = false;
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                onClick={() => {
                  submitLockRef.current = false;
                  setEditingAtividade(null);
                }}
              >
                <Plus className="w-4 h-4" />
                Nova Atividade
              </Button>
            </DialogTrigger>

            <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAtividade ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-6">
                {editingAtividade?.codigo_atividade && (
                  <div className="bg-[#ADF802]/10 border border-[#ADF802]/30 rounded-lg p-3">
                    <p className="text-sm text-[#ADF802] font-mono">
                      🔖 Código: <strong>{editingAtividade.codigo_atividade}</strong>
                    </p>
                  </div>
                )}

                {!editingAtividade && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-sm text-blue-400">
                      📅 A data será registrada automaticamente como{' '}
                      <strong>{format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}</strong>
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {editingAtividade && (
                    <div>
                      <Label>Data</Label>
                      <Input
                        type="date"
                        value={formData.data}
                        onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                        className="bg-[#1a1a1a] border-gray-700 mt-2"
                        required
                      />
                    </div>
                  )}

                  <div className={editingAtividade ? '' : 'sm:col-span-2'}>
                    <Label className="flex items-center gap-2">
                      Tipo de Atividade
                      <AtividadeInfoTooltip tipo={selectedType} modalOpen={isDialogOpen} />
                    </Label>
                    <Select value={selectedType} onValueChange={handleTipoChange}>
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242424] border-gray-700">
                        <SelectItem value="Chamados">Chamados</SelectItem>
                        <SelectItem value="Ligações">Ligações</SelectItem>
                        <SelectItem value="Monitoria Offline">Monitoria Offline</SelectItem>
                        <SelectItem value="Monitoria Assistida">Monitoria Assistida</SelectItem>
                        <SelectItem value="Feedback Individual">Feedback Individual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Analista</Label>
                    <Select value={formData.analista_id} onValueChange={handleAnalistaChange}>
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242424] border-gray-700">
                        {analistas.map((an) => (
                          <SelectItem key={an.id} value={String(an.id)}>
                            {an.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.supervisor_id && (
                    <div>
                      <Label>Supervisor Responsável</Label>
                      <div className="bg-[#1a1a1a] border border-gray-700 rounded-md p-2 mt-2">
                        <p className="text-white">{getSupervisorNome(formData.supervisor_id)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {selectedType === 'Chamados' && (
                  <div>
                    <Label>Ticket</Label>
                    <Input
                      type="text"
                      placeholder="Ex: #12345"
                      maxLength="20"
                      value={formData.ticket_acompanhado}
                      onChange={(e) => setFormData({ ...formData, ticket_acompanhado: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                    />
                  </div>
                )}

                {selectedType === 'Ligações' && (
                  <div>
                    <Label>Protocolo da Gravação</Label>
                    <Input
                      type="text"
                      value={formData.protocolo_gravacao}
                      onChange={(e) => setFormData({ ...formData, protocolo_gravacao: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                    />
                  </div>
                )}

                {selectedType === 'Monitoria Offline' && (
                  <MonitoriaOfflineForm
                    data={formData.topicos_monitoria_offline}
                    onChange={(topicos) => setFormData({ ...formData, topicos_monitoria_offline: topicos })}
                    onProtocoloChange={(protocolo) => setFormData({ ...formData, protocolo_gravacao: protocolo })}
                    onNotaChange={(nota) => setFormData({ ...formData, nota, status: 'Concluído' })}
                  />
                )}

                {selectedType === 'Monitoria Assistida' && (
                  <MonitoriaAssistidaForm
                    data={formData.topicos_monitoria_assistida}
                    onChange={(topicos) => setFormData({ ...formData, topicos_monitoria_assistida: topicos })}
                    onLinkChange={(link) => setFormData({ ...formData, link_gravacao_teams: link })}
                    onNotaChange={(nota) => setFormData({ ...formData, nota, status: 'Concluído' })}
                  />
                )}

                {selectedType === 'Feedback Individual' && (
                  <div>
                    <Label>Tipo de Feedback</Label>
                    <Select value={formData.tipo_feedback} onValueChange={(val) => setFormData({ ...formData, tipo_feedback: val })}>
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242424] border-gray-700">
                        <SelectItem value="Positivo">Positivo</SelectItem>
                        <SelectItem value="Negativo">Negativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedType !== 'Monitoria Offline' && selectedType !== 'Monitoria Assistida' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Nota (0-10)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={formData.nota}
                        onChange={(e) => setFormData({ ...formData, nota: e.target.value })}
                        className="bg-[#1a1a1a] border-gray-700 mt-2"
                        required
                      />
                    </div>

                    <div>
                      <Label>Status</Label>
                      <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                        <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#242424] border-gray-700">
                          <SelectItem value="Aberto">Aberto</SelectItem>
                          <SelectItem value="Em evolução">Em evolução</SelectItem>
                          <SelectItem value="Concluído">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div>
                  <Label>Comentário</Label>
                  <Textarea
                    value={formData.comentario}
                    onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2 h-24"
                    placeholder="Detalhes adicionais..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setIsDialogOpen(false);
                    }}
                    className="border-gray-700"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    Cancelar
                  </Button>

                  <Button
                    type="submit"
                    disabled={submitLockRef.current || createMutation.isPending || updateMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {editingAtividade ? 'Atualizando...' : 'Registrando...'}
                      </>
                    ) : editingAtividade ? (
                      'Atualizar'
                    ) : (
                      'Registrar'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-[#0d0d0d] rounded-2xl border border-gray-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Filtros</h2>
        </div>

        <div className="mb-4">
          <Label className="text-xs text-gray-400">Buscar por Código (CH, LG, MO, MA, FB)</Label>
          <Input
            type="text"
            placeholder="Ex: CH00001, LG00002, MO00003..."
            value={filterIdBusca}
            onChange={(e) => setFilterIdBusca(e.target.value.toUpperCase())}
            className="bg-[#1a1a1a] border-gray-700 mt-1 font-mono"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label className="text-xs text-gray-400">Supervisor</Label>
            <Input
              type="text"
              placeholder="Digitar supervisor..."
              value={filterSupervisor}
              onChange={(e) => setFilterSupervisor(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-400">Analista</Label>
            <Input
              type="text"
              placeholder="Digitar analista..."
              value={filterAnalista}
              onChange={(e) => setFilterAnalista(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-400">Tipo</Label>
            <Input
              type="text"
              placeholder="Digitar tipo..."
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-400">Data Início</Label>
            <Input
              type="date"
              value={filterDataInicio}
              onChange={(e) => setFilterDataInicio(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-400">Data Fim</Label>
            <Input
              type="date"
              value={filterDataFim}
              onChange={(e) => setFilterDataFim(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-1"
            />
          </div>
        </div>

        {(filterIdBusca || filterSupervisor || filterAnalista || filterTipo || filterDataInicio || filterDataFim) && (
          <div className="mt-4 flex justify-end">
            <Button onClick={limparFiltros} variant="outline" size="sm" className="border-gray-700 gap-2">
              <X className="w-4 h-4" />
              Limpar Filtros
            </Button>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-[#0d0d0d] rounded-2xl border border-gray-800 overflow-hidden">
        {atividadesFiltradas.length > 0 && (
          <div className="bg-[#0d0d0d] border-b border-gray-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-400">
              Mostrando <span className="text-white font-semibold">{startIndex + 1}-{Math.min(endIndex, totalRegistros)}</span> de{' '}
              <span className="text-white font-semibold">{totalRegistros}</span> registros
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-400">Registros por página:</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(parseInt(val, 10));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="bg-[#1a1a1a] border-gray-700 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#242424] border-gray-700">
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="border-gray-700 h-8"
                >
                  ←
                </Button>
                <span className="text-sm text-gray-400 min-w-[60px] text-center">
                  Página {currentPage} de {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPaginas, currentPage + 1))}
                  disabled={currentPage === totalPaginas}
                  className="border-gray-700 h-8"
                >
                  →
                </Button>
              </div>
            </div>
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className="bg-blue-500/10 border-b border-blue-500/30 px-6 py-3 flex items-center justify-between">
            <span className="text-sm text-blue-400">{selectedIds.size} registro(s) selecionado(s)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} className="border-gray-700 h-8">
                Desselecionar Tudo
              </Button>
              <Button size="sm" onClick={() => setDeleteMultipleDialogOpen(true)} className="bg-red-600 hover:bg-red-700 h-8 gap-2">
                <Trash2 className="w-4 h-4" />
                Deletar Selecionados
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#1a1a1a] border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === atividadesPaginadas.length && atividadesPaginadas.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(atividadesPaginadas.map((a) => a.id)));
                      else setSelectedIds(new Set());
                    }}
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Supervisor Resp.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Analista</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Registrado Por</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">Nota</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">Aprovação</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {atividadesPaginadas.map((atividade) => (
                <tr key={atividade.id} className="hover:bg-[#1a1a1a] transition-colors">
                  <td className="px-4 py-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(atividade.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedIds);
                        if (e.target.checked) newSet.add(atividade.id);
                        else newSet.delete(atividade.id);
                        setSelectedIds(newSet);
                      }}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-1 bg-[#ADF802]/10 text-[#ADF802] text-xs font-mono font-bold rounded border border-[#ADF802]/30">
                      {atividade.codigo_atividade || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">{getLocalDateString(atividade.data)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium border whitespace-nowrap ${getTipoColor(atividade.tipo)}`}>
                        {atividade.tipo}
                      </span>
                      <AtividadeInfoTooltip tipo={atividade.tipo} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{getSupervisorNome(atividade.supervisor_id)}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{getAnalistaNome(atividade.analista_id)}</td>
                  <td className="px-4 py-3 text-sm text-gray-400 truncate max-w-[150px]">
                    {atividade.registrado_por || atividade.created_by}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getNotaBadgeColor(atividade.nota)}`}>{atividade.nota}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(atividade.status)}`}>{atividade.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border whitespace-nowrap ${
                        atividade.aprovacao_status === 'aprovado'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : atividade.aprovacao_status === 'rejeitado'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }`}
                    >
                      {atividade.aprovacao_status === 'aprovado'
                        ? '✓ Aprovado'
                        : atividade.aprovacao_status === 'rejeitado'
                        ? '✗ Rejeitado'
                        : '⏳ Pendente'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingAtividade(atividade)}
                        className="text-blue-400 hover:text-blue-300 h-8 w-8"
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(atividade)}
                          className="text-gray-400 hover:text-white h-8 w-8"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(atividade.id)}
                          className="text-gray-400 hover:text-red-400 h-8 w-8"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {atividadesFiltradas.length === 0 && (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {atividades.length === 0 ? 'Nenhuma atividade registrada' : 'Nenhuma atividade encontrada com os filtros aplicados'}
            </p>
          </div>
        )}
      </div>

      {/* Dialog de Exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir esta atividade? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Exclusão em Massa */}
      <AlertDialog open={deleteMultipleDialogOpen} onOpenChange={setDeleteMultipleDialogOpen}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão em massa</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir {selectedIds.size} atividade(s)? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMultipleMutation.mutate()}
              disabled={deleteMultipleMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMultipleMutation.isPending ? 'Deletando...' : 'Deletar Tudo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Sucesso */}
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent className="bg-gradient-to-br from-emerald-900/30 to-emerald-950/50 border-2 border-emerald-500/50 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-emerald-400 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              Atividade Registrada com Sucesso!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-300 space-y-3 pt-4">
              <p className="flex items-start gap-2">
                <span className="text-emerald-400 text-xl">📋</span>
                <span>Seu registro foi <strong className="text-white">enviado para aprovação</strong> do coordenador.</span>
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogAction
              onClick={() => {
                setShowSuccessDialog(false);
                queryClient.invalidateQueries({ queryKey: ['atividades'] });
                queryClient.invalidateQueries({ queryKey: ['atividades', currentUser?.role] });
                queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] });
                queryClient.invalidateQueries({ queryKey: ['minhasAtividadesPendentes'] });
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 text-base"
            >
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}