import { useMemo, useRef, useState } from 'react';
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

// ===== Utils: request_id obrigatório (schema Base44) =====
const makeRequestId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;
};

// =========================
// CONSTANTES / NORMALIZAÇÃO
// =========================
const TIPO_OPTIONS = [
  { value: 'chamados', label: 'Chamados', prefix: 'CH' },
  { value: 'ligacoes', label: 'Ligações', prefix: 'LG' },
  { value: 'monitoria_offline', label: 'Monitoria Offline', prefix: 'MO' },
  { value: 'monitoria_assistida', label: 'Monitoria Assistida', prefix: 'MA' },
  { value: 'feedback', label: 'Feedback Individual', prefix: 'FB' },
];

const STATUS_OPTIONS = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_evolucao', label: 'Em evolução' },
  { value: 'concluido', label: 'Concluído' },
];

const PREFIXOS = TIPO_OPTIONS.reduce((acc, t) => {
  acc[t.value] = t.prefix;
  return acc;
}, {});

const tipoLabel = (tipo) => (TIPO_OPTIONS.find((t) => t.value === tipo)?.label || tipo);
const statusLabel = (st) => (STATUS_OPTIONS.find((s) => s.value === st)?.label || st);

const normalizeTipo = (v) => {
  if (!v) return 'chamados';
  // já está no enum
  if (TIPO_OPTIONS.some((t) => t.value === v)) return v;

  const map = {
    Chamados: 'chamados',
    'Ligações': 'ligacoes',
    Ligacoes: 'ligacoes',
    'Monitoria Offline': 'monitoria_offline',
    'Monitoria Assistida': 'monitoria_assistida',
    'Feedback Individual': 'feedback',
  };
  return map[v] || 'chamados';
};

const normalizeStatus = (v) => {
  if (!v) return 'aberto';
  if (STATUS_OPTIONS.some((s) => s.value === v)) return v;

  const map = {
    Aberto: 'aberto',
    'Em evolução': 'em_evolucao',
    Concluído: 'concluido',
    Concluido: 'concluido',
  };
  return map[v] || 'aberto';
};

// remove undefined / null / "" e objetos vazios
const cleanPayload = (obj) => {
  const isPlainObject = (x) =>
    x && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Date);

  const walk = (value) => {
    if (Array.isArray(value)) {
      const arr = value.map(walk).filter((v) => v !== undefined);
      return arr.length ? arr : undefined;
    }

    if (isPlainObject(value)) {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        const vv = walk(v);
        if (vv === undefined) continue;
        out[k] = vv;
      }
      return Object.keys(out).length ? out : undefined;
    }

    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return value;
  };

  const cleaned = walk(obj);
  return cleaned || {};
};

const buildAtividadePayload = ({ formData, selectedType, editingAtividade }) => {
  const dataAtual = new Date();
  const dataFormatada = `${dataAtual.getFullYear()}-${String(
    dataAtual.getMonth() + 1
  ).padStart(2, '0')}-${String(dataAtual.getDate()).padStart(2, '0')}`;

  const tipo = normalizeTipo(selectedType || formData.tipo);

  const base = {
    tipo,
    data: editingAtividade ? ensureCorrectDate(formData.data) : dataFormatada,
    analista_id: formData.analista_id || undefined,
    supervisor_id: formData.supervisor_id || undefined,
    nota: Number.isFinite(Number(formData.nota)) ? Number(formData.nota) : 0,
    status: normalizeStatus(formData.status) || undefined,
    comentario: formData.comentario || undefined,
  };

  if (tipo === 'chamados') {
    base.ticket_acompanhado = formData.ticket_acompanhado || undefined;
  }

  if (tipo === 'ligacoes') {
    base.protocolo_gravacao = formData.protocolo_gravacao || undefined;
  }

  if (tipo === 'monitoria_offline') {
    base.protocolo_gravacao = formData.protocolo_gravacao || undefined;
    base.topicos_monitoria_offline =
      formData.topicos_monitoria_offline &&
      Object.keys(formData.topicos_monitoria_offline).length > 0
        ? formData.topicos_monitoria_offline
        : undefined;
    base.status = 'concluido';
  }

  if (tipo === 'monitoria_assistida') {
    base.link_gravacao_teams = formData.link_gravacao_teams || undefined;
    base.topicos_monitoria_assistida =
      formData.topicos_monitoria_assistida &&
      Object.keys(formData.topicos_monitoria_assistida).length > 0
        ? formData.topicos_monitoria_assistida
        : undefined;
    base.status = 'concluido';
  }

  if (tipo === 'feedback') {
    base.tipo_feedback = formData.tipo_feedback || undefined;
  }

  return cleanPayload(base);
};

export default function Atividades() {
  const queryClient = useQueryClient();
  const submitLockRef = useRef(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAtividade, setEditingAtividade] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedType, setSelectedType] = useState('chamados');
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
    data: '',
    tipo: 'chamados',
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
    status: 'aberto',
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ['atividades', currentUser?.role],
    staleTime: 2000,
    queryFn: async () => {
      const todasAtividades = await base44.entities.Atividade.list('-created_date');

      const mapUnique = {};
      todasAtividades.forEach((ativ) => {
        if (!mapUnique[ativ.id]) mapUnique[ativ.id] = ativ;
      });
      const atividadesUnicas = Object.values(mapUnique);

      const todasAprovacoes = await base44.entities.AprovacaoAtividade.list();
      const aprovacaoPorId = {};
      todasAprovacoes.forEach((aprov) => {
        if (aprov.tipo === 'atividade' && !aprovacaoPorId[aprov.atividade_id]) {
          aprovacaoPorId[aprov.atividade_id] = aprov;
        }
      });

      const atividadesComAprovacao = atividadesUnicas.map((ativ) => ({
        ...ativ,
        tipo: normalizeTipo(ativ.tipo),
        status: normalizeStatus(ativ.status),
        aprovacao_status: aprovacaoPorId[ativ.id]?.status || 'pendente',
        aprovacao_data: aprovacaoPorId[ativ.id]?.data_aprovacao,
        aprovacao_motivo_rejeicao: aprovacaoPorId[ativ.id]?.motivo_rejeicao,
      }));

      const idsAprovados = Object.keys(aprovacaoPorId).filter(
        (id) => aprovacaoPorId[id].status === 'aprovado'
      );

      if (currentUser?.role === 'admin') return atividadesComAprovacao;

      if (currentUser?.role === 'supervisor') {
        return atividadesComAprovacao.filter(
          (ativ) =>
            idsAprovados.includes(ativ.id) ||
            ativ.registrado_por === currentUser.email ||
            ativ.created_by === currentUser.email
        );
      }

      return atividadesComAprovacao.filter((ativ) => idsAprovados.includes(ativ.id));
    },
    enabled: !!currentUser,
  });

  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  // Evita 403 derrubando console/tela: se não tiver permissão, devolve []
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios', currentUser?.email],
    queryFn: async () => {
      try {
        return await base44.entities.User.list();
      } catch (e) {
        console.warn('Sem permissão para listar Users (ok):', e?.message || e);
        return [];
      }
    },
    enabled: !!currentUser, // se der 403, cai no catch e retorna []
  });

  const resetForm = () => {
    setFormData({
      data: '',
      tipo: 'chamados',
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
      status: 'aberto',
    });
    setEditingAtividade(null);
    setSelectedType('chamados');
    submitLockRef.current = false;
  };

  const getSupervisorNome = (id) => {
    const supervisor = supervisores.find((s) => s.id === id);
    const usuario = usuarios.find((u) => u.email === supervisor?.usuario_email);
    return (
      usuario?.nome_customizado ||
      usuario?.full_name ||
      supervisor?.nome ||
      supervisor?.usuario_email ||
      '-'
    );
  };

  const getAnalistaNome = (id) => {
    const analista = analistas.find((a) => a.id === id);
    const usuario = usuarios.find((u) => u.email === analista?.usuario_email);
    return (
      usuario?.nome_customizado ||
      usuario?.full_name ||
      analista?.nome ||
      analista?.usuario_email ||
      '-'
    );
  };

  const handleAnalistaChange = (analistaId) => {
    const analista = analistas.find((a) => a.id === analistaId);
    setFormData((prev) => ({
      ...prev,
      analista_id: analistaId,
      supervisor_id: analista?.supervisor_id || '',
    }));
  };

  const handleTipoChange = (tipoEnum) => {
    const t = normalizeTipo(tipoEnum);
    setSelectedType(t);
    // zera campos específicos ao trocar tipo (evita lixo de outros tipos)
    setFormData((prev) => ({
      ...prev,
      tipo: t,
      protocolo_gravacao: '',
      link_gravacao_teams: '',
      ticket_acompanhado: '',
      tipo_feedback: '',
      topicos_monitoria_offline: {},
      topicos_monitoria_assistida: {},
      nota: '',
      status: 'aberto',
    }));
  };

  const getTipoColor = (tipo) => {
    const colors = {
      chamados: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      ligacoes: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      monitoria_offline: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      monitoria_assistida: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      feedback: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    };
    return colors[tipo] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getNotaBadgeColor = (nota) => {
    const n = Number(nota) || 0;
    if (n >= 9) return 'bg-emerald-500 text-white';
    if (n >= 7) return 'bg-yellow-500 text-black';
    return 'bg-red-500 text-white';
  };

  const getStatusColor = (status) => {
    if (status === 'concluido')
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (status === 'em_evolucao')
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const { data: atividadesSafe = [] } = useQuery({
    queryKey: ['atividadesSafe', atividades],
    queryFn: async () => atividades,
    enabled: true,
  });

  const atividadesFiltradas = useMemo(() => {
    return (atividadesSafe || [])
      .filter((ativ) => {
        if (
          filterIdBusca &&
          !ativ.codigo_atividade?.toLowerCase().includes(filterIdBusca.toLowerCase())
        )
          return false;

        if (
          filterSupervisor &&
          !getSupervisorNome(ativ.supervisor_id)
            .toLowerCase()
            .includes(filterSupervisor.toLowerCase())
        )
          return false;

        if (
          filterAnalista &&
          !getAnalistaNome(ativ.analista_id)
            .toLowerCase()
            .includes(filterAnalista.toLowerCase())
        )
          return false;

        if (filterTipo) {
          const label = tipoLabel(normalizeTipo(ativ.tipo)).toLowerCase();
          const raw = (ativ.tipo || '').toLowerCase();
          const needle = filterTipo.toLowerCase();
          if (!label.includes(needle) && !raw.includes(needle)) return false;
        }

        if (filterDataInicio && ativ.data < filterDataInicio) return false;
        if (filterDataFim && ativ.data > filterDataFim) return false;
        return true;
      })
      .sort((a, b) => {
        const analistaA = getAnalistaNome(a.analista_id).toLowerCase();
        const analistaB = getAnalistaNome(b.analista_id).toLowerCase();
        return analistaA.localeCompare(analistaB);
      });
  }, [
    atividadesSafe,
    filterIdBusca,
    filterSupervisor,
    filterAnalista,
    filterTipo,
    filterDataInicio,
    filterDataFim,
    supervisores,
    analistas,
    usuarios,
  ]);

  const totalRegistros = atividadesFiltradas.length;
  const totalPaginas = Math.ceil(totalRegistros / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const atividadesPaginadas = atividadesFiltradas.slice(startIndex, endIndex);

  const limparFiltros = () => {
    setFilterSupervisor('');
    setFilterAnalista('');
    setFilterTipo('');
    setFilterDataInicio('');
    setFilterDataFim('');
    setFilterIdBusca('');
    setCurrentPage(1);
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const tipo = normalizeTipo(data.tipo);

      const atividadesMesmoTipo = await base44.entities.Atividade.filter({ tipo });
      const codigosExistentes = atividadesMesmoTipo
        .map((a) => a.codigo_atividade)
        .filter((c) => c && c.startsWith(PREFIXOS[tipo]));

      let proximoNumero = 1;
      if (codigosExistentes.length > 0) {
        const numeros = codigosExistentes.map((c) => parseInt(c.slice(2), 10));
        proximoNumero = Math.max(...numeros) + 1;
      }

      const codigoAtividade = `${PREFIXOS[tipo]}${String(proximoNumero).padStart(5, '0')}`;
      const user = await base44.auth.me();

      const result = await base44.entities.Atividade.create({
        ...data,
        tipo,
        codigo_atividade: codigoAtividade,
        registrado_por: user.email,
      });

      await base44.entities.AprovacaoAtividade.create({
        atividade_id: result.id,
        tipo: 'atividade',
        status: 'pendente',
      });

      try {
        await base44.entities.Log.create({
          usuario_email: user.email,
          usuario_nome: user.full_name,
          acao: 'Criou',
          entidade: 'Atividade',
          detalhes: `Registrou atividade ${codigoAtividade} do tipo ${tipo}`,
        });
      } catch (e) {
        console.warn('Erro ao criar log:', e);
      }

      try {
        await notificarCoordenadores(
          'nova_atividade',
          'Nova Atividade Registrada',
          `${user.full_name} registrou uma nova atividade ${codigoAtividade} do tipo ${tipo} - Aguardando aprovação`,
          'Aprovacao'
        );
      } catch (e) {
        console.warn('Erro ao notificar:', e);
      }

      return result;
    },
    onSuccess: () => {
      submitLockRef.current = false;

      setTimeout(() => {
        setIsDialogOpen(false);
        resetForm();
      }, 50);

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['atividades', currentUser?.role] });
        queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['ranking'] });
        queryClient.invalidateQueries({ queryKey: ['rankings'] });
        queryClient.invalidateQueries({ queryKey: ['perfilAnalista'] });
        queryClient.invalidateQueries({ queryKey: ['supervisores'] });
        setShowSuccessDialog(true);
      }, 400);
    },
    onError: (error) => {
      submitLockRef.current = false;
      toast.error('❌ Erro ao registrar atividade', {
        description: error?.message || 'Tente novamente',
        duration: 5000,
      });
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
      } catch (e) {
        console.warn('Erro ao criar log:', e);
      }
      return result;
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      resetForm();
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['atividades', currentUser?.role] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['ranking'] });
        queryClient.invalidateQueries({ queryKey: ['perfilAnalista'] });
        setShowSuccessDialog(true);
      }, 200);
    },
    onError: (error) => {
      toast.error('❌ Erro ao atualizar atividade', {
        description: error?.message || 'Tente novamente',
        duration: 5000,
      });
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
      } catch (e) {
        console.warn('Erro ao criar log:', e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades', currentUser?.role] });
      queryClient.invalidateQueries({ queryKey: ['aprovacoes'] });
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
      } catch (e) {
        console.warn('Erro ao criar log:', e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades', currentUser?.role] });
      queryClient.invalidateQueries({ queryKey: ['aprovacoes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`${selectedIds.size} atividades excluídas com sucesso!`);
      setSelectedIds(new Set());
      setDeleteMultipleDialogOpen(false);
    },
  });

  const openEdit = (atividade) => {
    submitLockRef.current = false;
    const tipo = normalizeTipo(atividade.tipo);
    setEditingAtividade(atividade);

    setFormData({
      data: atividade.data,
      tipo,
      analista_id: atividade.analista_id || '',
      supervisor_id: atividade.supervisor_id || '',
      protocolo_gravacao: atividade.protocolo_gravacao || '',
      link_gravacao_teams: atividade.link_gravacao_teams || '',
      ticket_acompanhado: atividade.ticket_acompanhado || '',
      tipo_feedback: atividade.tipo_feedback || '',
      topicos_monitoria_offline: atividade.topicos_monitoria_offline || {},
      topicos_monitoria_assistida: atividade.topicos_monitoria_assistida || {},
      nota: atividade.nota?.toString?.() || '',
      comentario: atividade.comentario || '',
      status: normalizeStatus(atividade.status) || 'aberto',
    });

    setSelectedType(tipo);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitLockRef.current || createMutation.isPending || updateMutation.isPending) return;
    submitLockRef.current = true;

    const payload = buildAtividadePayload({
      formData,
      selectedType,
      editingAtividade,
    });

    if (editingAtividade) {
  updateMutation.mutate({ id: editingAtividade.id, data: payload });
} else {
  const request_id = makeRequestId();
  const payloadComRequest = { ...payload, request_id };

  console.log('PAYLOAD CREATE (com request_id):', payloadComRequest);

  createMutation.mutate(payloadComRequest);
}
  };

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
              if (!open) {
                resetForm();
                submitLockRef.current = false;
              }
              setIsDialogOpen(open);
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                disabled={createMutation.isPending || updateMutation.isPending}
                onClick={() => {
                  submitLockRef.current = false;
                  setEditingAtividade(null);
                  setSelectedType('chamados');
                  setFormData((prev) => ({ ...prev, tipo: 'chamados' }));
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
                {editingAtividade && editingAtividade.codigo_atividade && (
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
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242424] border-gray-700">
                        {TIPO_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
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
                          <SelectItem key={an.id} value={an.id}>
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

                {/* Campo específico por tipo */}
                {selectedType === 'chamados' && (
                  <div>
                    <Label>Ticket</Label>
                    <Input
                      type="text"
                      placeholder="Ex: #12345"
                      maxLength={10}
                      value={formData.ticket_acompanhado}
                      onChange={(e) =>
                        setFormData({ ...formData, ticket_acompanhado: e.target.value })
                      }
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                    />
                  </div>
                )}

                {selectedType === 'ligacoes' && (
                  <div>
                    <Label>Protocolo da Gravação</Label>
                    <Input
                      type="text"
                      value={formData.protocolo_gravacao}
                      onChange={(e) =>
                        setFormData({ ...formData, protocolo_gravacao: e.target.value })
                      }
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                      required
                    />
                  </div>
                )}

                {selectedType === 'monitoria_offline' && (
                  <MonitoriaOfflineForm
                    data={formData.topicos_monitoria_offline}
                    onChange={(topicos) =>
                      setFormData({ ...formData, topicos_monitoria_offline: topicos })
                    }
                    onProtocoloChange={(protocolo) =>
                      setFormData({ ...formData, protocolo_gravacao: protocolo })
                    }
                    onNotaChange={(nota) =>
                      setFormData({ ...formData, nota, status: 'concluido' })
                    }
                  />
                )}

                {selectedType === 'monitoria_assistida' && (
                  <MonitoriaAssistidaForm
                    data={formData.topicos_monitoria_assistida}
                    onChange={(topicos) =>
                      setFormData({ ...formData, topicos_monitoria_assistida: topicos })
                    }
                    onLinkChange={(link) =>
                      setFormData({ ...formData, link_gravacao_teams: link })
                    }
                    onNotaChange={(nota) =>
                      setFormData({ ...formData, nota, status: 'concluido' })
                    }
                  />
                )}

                {selectedType === 'feedback' && (
                  <div>
                    <Label>Tipo de Feedback</Label>
                    <Select
                      value={formData.tipo_feedback}
                      onValueChange={(val) => setFormData({ ...formData, tipo_feedback: val })}
                    >
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242424] border-gray-700">
                        <SelectItem value="Positivo">Positivo</SelectItem>
                        <SelectItem value="Negativo">Negativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedType !== 'monitoria_offline' && selectedType !== 'monitoria_assistida' && (
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
                      <Select
                        value={formData.status}
                        onValueChange={(val) => setFormData({ ...formData, status: val })}
                      >
                        <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>

                        <SelectContent className="bg-[#242424] border-gray-700">
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
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
                    disabled={
                      submitLockRef.current || createMutation.isPending || updateMutation.isPending
                    }
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

        {(filterIdBusca ||
          filterSupervisor ||
          filterAnalista ||
          filterTipo ||
          filterDataInicio ||
          filterDataFim) && (
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
                <Label className="text-xs text-gray-400">Por página:</Label>
                <Select
                  value={pageSize.toString()}
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
                <span className="text-sm text-gray-400 min-w-[80px] text-center">
                  Página {currentPage} de {totalPaginas || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPaginas || 1, currentPage + 1))}
                  disabled={currentPage === (totalPaginas || 1)}
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedIds(new Set())}
                className="border-gray-700 h-8"
              >
                Desselecionar Tudo
              </Button>
              <Button
                size="sm"
                onClick={() => setDeleteMultipleDialogOpen(true)}
                className="bg-red-600 hover:bg-red-700 h-8 gap-2"
              >
                <Trash2 className="w-4 h-4" /> Deletar Selecionados
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
                    checked={
                      selectedIds.size === atividadesPaginadas.length &&
                      atividadesPaginadas.length > 0
                    }
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
                  <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                    {getLocalDateString(atividade.data)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium border whitespace-nowrap ${getTipoColor(
                          atividade.tipo
                        )}`}
                      >
                        {tipoLabel(atividade.tipo)}
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
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getNotaBadgeColor(atividade.nota)}`}>
                      {atividade.nota}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(atividade.status)}`}>
                      {statusLabel(atividade.status)}
                    </span>
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
              {atividades.length === 0
                ? 'Nenhuma atividade registrada'
                : 'Nenhuma atividade encontrada com os filtros aplicados'}
            </p>
          </div>
        )}
      </div>

      {/* Dialog de Visualização */}
      <Dialog open={!!viewingAtividade} onOpenChange={() => setViewingAtividade(null)}>
        <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Atividade</DialogTitle>
          </DialogHeader>

          {viewingAtividade && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Data</p>
                  <p className="text-white font-medium">{getLocalDateString(viewingAtividade.data)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Tipo</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getTipoColor(viewingAtividade.tipo)}`}>
                    {tipoLabel(viewingAtividade.tipo)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Supervisor</p>
                  <p className="text-white">{getSupervisorNome(viewingAtividade.supervisor_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Analista</p>
                  <p className="text-white">{getAnalistaNome(viewingAtividade.analista_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Nota</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${getNotaBadgeColor(viewingAtividade.nota)}`}>
                    {viewingAtividade.nota}/10
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(viewingAtividade.status)}`}>
                    {statusLabel(viewingAtividade.status)}
                  </span>
                </div>
              </div>

              {viewingAtividade.protocolo_gravacao && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Protocolo da Gravação</p>
                  <p className="text-white">{viewingAtividade.protocolo_gravacao}</p>
                </div>
              )}

              {viewingAtividade.link_gravacao_teams && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Link Teams</p>
                  <a
                    href={viewingAtividade.link_gravacao_teams}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline text-sm"
                  >
                    {viewingAtividade.link_gravacao_teams}
                  </a>
                </div>
              )}

              {viewingAtividade.ticket_acompanhado && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Ticket</p>
                  <p className="text-white">{viewingAtividade.ticket_acompanhado}</p>
                </div>
              )}

              {viewingAtividade.tipo_feedback && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Tipo de Feedback</p>
                  <p className="text-white">{viewingAtividade.tipo_feedback}</p>
                </div>
              )}

              {viewingAtividade.comentario && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Comentário</p>
                  <p className="text-gray-300 text-sm">{viewingAtividade.comentario}</p>
                </div>
              )}

              {viewingAtividade.tipo === 'monitoria_offline' &&
                viewingAtividade.topicos_monitoria_offline && (
                  <MonitoriaOfflineForm
                    data={{
                      ...viewingAtividade.topicos_monitoria_offline,
                      protocolo: viewingAtividade.protocolo_gravacao,
                    }}
                    onChange={() => {}}
                    readOnly={true}
                  />
                )}

              {viewingAtividade.tipo === 'monitoria_assistida' &&
                viewingAtividade.topicos_monitoria_assistida && (
                  <MonitoriaAssistidaForm
                    data={{
                      ...viewingAtividade.topicos_monitoria_assistida,
                      linkGravacao: viewingAtividade.link_gravacao_teams,
                    }}
                    onChange={() => {}}
                    readOnly={true}
                  />
                )}

              <div className="flex justify-end pt-4 border-t border-gray-800">
                <Button onClick={() => setViewingAtividade(null)} className="bg-emerald-600 hover:bg-emerald-700">
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <p className="flex items-start gap-2">
                <span className="text-blue-400 text-xl">🔔</span>
                <span>Você será <strong className="text-white">notificado</strong> assim que a atividade for avaliada.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-purple-400 text-xl">👤</span>
                <span>Acompanhe o status no seu <strong className="text-white">Perfil</strong>.</span>
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogAction
              onClick={() => {
                setShowSuccessDialog(false);
                queryClient.invalidateQueries({ queryKey: ['atividades'] });
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