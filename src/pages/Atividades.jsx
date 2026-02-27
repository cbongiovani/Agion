// src/pages/Atividades.jsx
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  Eye,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

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

import { notificarCoordenadores } from '@/components/notificationHelper';
import AtividadeInfoTooltip from '@/components/AtividadeInfoTooltip';
import MonitoriaOfflineForm from '@/components/MonitoriaOfflineForm';
import MonitoriaAssistidaForm from '@/components/MonitoriaAssistidaForm';

import { getUserModulePermissions, isModuleVisible } from '@/components/rbacHelpers';
import { MODULES } from '@/components/moduleConstants';

function idStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function stripEmpty(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === '' || v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function extractUsefulError(err) {
  // Base44/axios-like patterns variam — isso tenta mostrar algo útil sem quebrar.
  const status = err?.status || err?.response?.status;
  const msg =
    err?.message ||
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    'Falha inesperada.';
  const details =
    err?.response?.data?.details ||
    err?.response?.data?.errors ||
    err?.data?.errors;

  return {
    status,
    message: msg,
    details: typeof details === 'string' ? details : details ? JSON.stringify(details) : '',
  };
}
const ALL = "__all__";
export default function Atividades() {
  const queryClient = useQueryClient();

  // ===== UI state =====
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAtividade, setEditingAtividade] = useState(null);
  const [viewingAtividade, setViewingAtividade] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [filterSupervisor, setFilterSupervisor] = useState('');
  const [filterAnalista, setFilterAnalista] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [filterIdBusca, setFilterIdBusca] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedType, setSelectedType] = useState('Chamados');
  const [formData, setFormData] = useState({
    data: '', // só editável em edição
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

  const resetForm = () => {
    setFormData({
      data: '',
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
    setSelectedType('Chamados');
    setEditingAtividade(null);
  };

  // ===== Queries =====
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
    staleTime: 60 * 1000,
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

  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 10 * 60 * 1000,
  });

  // Aprovacoes: pega todas e mantém a mais recente por atividade_id (normalizando pra string)
  const { data: aprovacaoMap = new Map() } = useQuery({
    queryKey: ['aprovacoesAtividadeMap'],
    queryFn: async () => {
      const all = await base44.entities.AprovacaoAtividade.list('-created_date', 800);
      const m = new Map();
      for (const a of all || []) {
        if (a?.tipo !== 'atividade') continue;
        const key = idStr(a?.atividade_id);
        if (!key) continue;
        if (!m.has(key)) m.set(key, a); // já vem ordenado desc => 1º é o mais recente
      }
      return m;
    },
    enabled: !!currentUser,
    staleTime: 10 * 1000,
  });

  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ['atividades', currentUser?.role, currentUser?.email, Array.from(aprovacaoMap.keys()).length],
    queryFn: async () => {
      const todas = await base44.entities.Atividade.list('-created_date', 800);

      // dedup por id
      const unique = new Map();
      for (const a of todas || []) {
        if (a?.id && !unique.has(a.id)) unique.set(a.id, a);
      }
      const base = Array.from(unique.values());

      // anexa aprovacao (NORMALIZA id pra string)
      const withApproval = base.map((ativ) => {
        const aprov = aprovacaoMap.get(idStr(ativ?.id));
        return {
          ...ativ,
          aprovacao_status: aprov?.status || 'pendente',
          aprovacao_data: aprov?.data_aprovacao,
          aprovacao_motivo_rejeicao: aprov?.motivo_rejeicao,
        };
      });

      // Admin vê tudo
      if (currentUser?.role === 'admin') return withApproval;

      // Supervisor: aprovadas de todos + as dele (mesmo pendente/rejeitado)
      if (currentUser?.role === 'supervisor') {
        return withApproval.filter((ativ) => {
          const aprov = aprovacaoMap.get(idStr(ativ?.id));
          const isApproved = aprov?.status === 'aprovado';
          const isMine =
            ativ?.registrado_por === currentUser.email ||
            ativ?.created_by === currentUser.email;
          return isApproved || isMine;
        });
      }

      // outros: só aprovadas
      return withApproval.filter((ativ) => {
        const aprov = aprovacaoMap.get(idStr(ativ?.id));
        return aprov?.status === 'aprovado';
      });
    },
    enabled: !!currentUser,
    staleTime: 5 * 1000,
  });

  // ===== Name helpers =====
  const getSupervisorNome = (id) => {
    const sid = idStr(id);
    const supervisor = supervisores.find((s) => idStr(s.id) === sid);
    const usuario = usuarios.find((u) => u.email === supervisor?.usuario_email);
    return usuario?.nome_customizado || usuario?.full_name || supervisor?.nome || '-';
  };

  const getAnalistaNome = (id) => {
    const aid = idStr(id);
    const analista = analistas.find((a) => idStr(a.id) === aid);
    const usuario = usuarios.find((u) => u.email === analista?.usuario_email);
    return usuario?.nome_customizado || usuario?.full_name || analista?.nome || '-';
  };

  // ===== UI behavior =====
  useEffect(() => {
    if (!isDialogOpen) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogOpen]);

  const limparFiltros = () => {
    setFilterSupervisor('');
    setFilterAnalista('');
    setFilterTipo('');
    setFilterDataInicio('');
    setFilterDataFim('');
    setFilterIdBusca('');
    setCurrentPage(1);
  };

  const handleAnalistaChange = (analistaId) => {
    const analista = analistas.find((a) => idStr(a.id) === idStr(analistaId));
    setFormData((prev) => ({
      ...prev,
      analista_id: idStr(analistaId),
      supervisor_id: analista?.supervisor_id ? idStr(analista.supervisor_id) : '',
    }));
  };

  const handleTipoChange = (tipo) => {
    setSelectedType(tipo);
    setFormData((prev) => ({
      ...prev,
      tipo,
      // mantém campos gerais; componentes específicos cuidam do resto
      topicos_monitoria_offline: prev.topicos_monitoria_offline || {},
      topicos_monitoria_assistida: prev.topicos_monitoria_assistida || {},
    }));
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

  const getStatusColor = (status) => {
    if (status === 'Concluído') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (status === 'Em evolução') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  // ===== Core fix: garante aprovação (sempre usando ID string) =====
  const ensureApprovalForActivity = async (atividadeId) => {
  const id = String(atividadeId);

  const existentes = await base44.entities.AprovacaoAtividade.filter({
    tipo: 'atividade',
    atividade_id: id,
  });

  if (Array.isArray(existentes) && existentes.length > 0) return existentes[0];

  return await base44.entities.AprovacaoAtividade.create({
    tipo: 'atividade',
    atividade_id: id,
    status: 'pendente',
  });
};

  // ===== Mutations =====
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const prefixos = {
        Chamados: 'CH',
        Ligações: 'LG',
        'Monitoria Offline': 'MO',
        'Monitoria Assistida': 'MA',
        'Feedback Individual': 'FB',
      };

      const user = await base44.auth.me();

      // gera código por tipo (simples e compatível com seu padrão atual)
      const atividadesMesmoTipo = await base44.entities.Atividade.filter({ tipo: data.tipo });
      const codigosExistentes = (atividadesMesmoTipo || [])
        .map((a) => a.codigo_atividade)
        .filter((c) => c && String(c).startsWith(prefixos[data.tipo]));

      let proximoNumero = 1;
      if (codigosExistentes.length) {
        const numeros = codigosExistentes
          .map((c) => parseInt(String(c).slice(2), 10))
          .filter((n) => !isNaN(n));
        proximoNumero = (numeros.length ? Math.max(...numeros) : 0) + 1;
      }

      const codigo_atividade = `${prefixos[data.tipo]}${String(proximoNumero).padStart(5, '0')}`;

      const created = await base44.entities.Atividade.create({
        ...data,
        codigo_atividade,
        registrado_por: user.email,
      });

      await ensureApprovalForActivity(created.id);

      // Notifica coordenadores (best effort)
      try {
        await notificarCoordenadores(
          'nova_atividade',
          'Nova Atividade Registrada',
          `${user.full_name} registrou a atividade ${codigo_atividade} (${data.tipo}) - aguardando aprovação.`,
          'Aprovacao'
        );
      } catch {}

      return created;
    },
    onSuccess: () => {
      toast.success('✅ Atividade registrada', { description: 'Enviada para aprovação.' });

      setIsDialogOpen(false);
      resetForm();

      // atualiza lista e aprovações
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacoesAtividadeMap'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      const e = extractUsefulError(err);
      toast.error('❌ Erro ao registrar atividade', {
        description: `${e.status ? `HTTP ${e.status} — ` : ''}${e.message}${e.details ? `\n${e.details}` : ''}`,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.Atividade.update(id, data);
    },
    onSuccess: () => {
      toast.success('✅ Atividade atualizada');
      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
    },
    onError: (err) => {
      const e = extractUsefulError(err);
      toast.error('❌ Erro ao atualizar', {
        description: `${e.status ? `HTTP ${e.status} — ` : ''}${e.message}${e.details ? `\n${e.details}` : ''}`,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.Atividade.delete(id);
      // (opcional) poderia tentar deletar aprovação relacionada, se você quiser.
      return true;
    },
    onSuccess: () => {
      toast.success('🗑️ Atividade removida');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
    },
    onError: (err) => {
      const e = extractUsefulError(err);
      toast.error('❌ Erro ao remover', {
        description: `${e.status ? `HTTP ${e.status} — ` : ''}${e.message}${e.details ? `\n${e.details}` : ''}`,
      });
    },
  });

  // ===== Submit =====
  const handleSubmit = async (e) => {
    e.preventDefault();

    // validações mínimas
    if (!formData.tipo) {
      toast.error('Informe o tipo de atividade.');
      return;
    }
    if (!formData.analista_id) {
      toast.error('Selecione um analista.');
      return;
    }
    if (!formData.supervisor_id) {
      toast.error('Analista sem supervisor vinculado', {
        description: 'Vincule o supervisor no cadastro do analista e tente novamente.',
      });
      return;
    }

    // data automática no create; edit usa data do campo
    const payload = stripEmpty({
      ...formData,
      analista_id: idStr(formData.analista_id),
      supervisor_id: idStr(formData.supervisor_id),
    });

    // regra: se for edição e data vazia, não envia
    if (!editingAtividade) {
      delete payload.data;
    } else {
      // em edição, exige data
      if (!payload.data) {
        toast.error('Informe a data (edição).');
        return;
      }
    }

    if (editingAtividade?.id) {
      await updateMutation.mutateAsync({ id: editingAtividade.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  // ===== Data processing: filtros + paginação =====
  const filteredAtividades = useMemo(() => {
    let list = Array.isArray(atividades) ? [...atividades] : [];

    if (filterSupervisor) list = list.filter((a) => idStr(a.supervisor_id) === idStr(filterSupervisor));
    if (filterAnalista) list = list.filter((a) => idStr(a.analista_id) === idStr(filterAnalista));
    if (filterTipo) list = list.filter((a) => (a.tipo || '') === filterTipo);

    if (filterIdBusca) {
      const q = filterIdBusca.trim().toLowerCase();
      list = list.filter((a) => String(a.codigo_atividade || '').toLowerCase().includes(q) || String(a.id || '').includes(q));
    }

    // filtros por data (usa campo data quando existe; senão created_date)
    if (filterDataInicio || filterDataFim) {
      const di = filterDataInicio ? new Date(filterDataInicio) : null;
      const df = filterDataFim ? new Date(filterDataFim) : null;

      list = list.filter((a) => {
        const raw = a.data || a.created_date;
        if (!raw) return true;

        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return true;

        if (di && d < di) return false;
        if (df) {
          const end = new Date(df);
          end.setHours(23, 59, 59, 999);
          if (d > end) return false;
        }
        return true;
      });
    }

    return list;
  }, [atividades, filterSupervisor, filterAnalista, filterTipo, filterDataInicio, filterDataFim, filterIdBusca]);

  const totalPages = Math.max(1, Math.ceil(filteredAtividades.length / pageSize));
  const page = Math.min(currentPage, totalPages);

  const paginatedAtividades = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAtividades.slice(start, start + pageSize);
  }, [filteredAtividades, page, pageSize]);

  // ===== Actions =====
  const startEdit = (ativ) => {
    setEditingAtividade(ativ);
    setSelectedType(ativ?.tipo || 'Chamados');
    setFormData({
      data: ativ?.data ? String(ativ.data).slice(0, 10) : '',
      tipo: ativ?.tipo || 'Chamados',
      analista_id: idStr(ativ?.analista_id),
      supervisor_id: idStr(ativ?.supervisor_id),
      protocolo_gravacao: ativ?.protocolo_gravacao || '',
      link_gravacao_teams: ativ?.link_gravacao_teams || '',
      ticket_acompanhado: ativ?.ticket_acompanhado || '',
      tipo_feedback: ativ?.tipo_feedback || '',
      topicos_monitoria_offline: ativ?.topicos_monitoria_offline || {},
      topicos_monitoria_assistida: ativ?.topicos_monitoria_assistida || {},
      nota: ativ?.nota ?? '',
      comentario: ativ?.comentario ?? '',
      status: ativ?.status || 'Aberto',
    });
    setIsDialogOpen(true);
  };

  const openView = (ativ) => setViewingAtividade(ativ);

  const confirmDelete = (id) => setDeleteId(id);

  // ===== Render =====
  return (
    <div className="p-6 text-gray-100">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Atividades</h1>
          <p className="text-gray-400 mt-1">Registre e gerencie as atividades do Suporte N1</p>
        </div>

        {canCreate && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Atividade
              </Button>
            </DialogTrigger>

            <DialogContent className="bg-[#121212] border-gray-800 text-gray-100 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{editingAtividade ? 'Editar Atividade' : 'Nova Atividade'}</span>
                  {editingAtividade?.codigo_atividade ? (
                    <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                      Código: {editingAtividade.codigo_atividade}
                    </span>
                  ) : null}
                </DialogTitle>
              </DialogHeader>

              {!editingAtividade && (
                <div className="text-sm text-gray-400">
                  A data será registrada automaticamente como{' '}
                  <span className="text-gray-200">
                    {format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                {editingAtividade && (
                  <div>
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={formData.data}
                      onChange={(e) => setFormData((p) => ({ ...p, data: e.target.value }))}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Atividade</Label>
                    <Select value={selectedType} onValueChange={handleTipoChange}>
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Chamados">Chamados</SelectItem>
                        <SelectItem value="Ligações">Ligações</SelectItem>
                        <SelectItem value="Monitoria Offline">Monitoria Offline</SelectItem>
                        <SelectItem value="Monitoria Assistida">Monitoria Assistida</SelectItem>
                        <SelectItem value="Feedback Individual">Feedback Individual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Analista</Label>
                    <Select value={idStr(formData.analista_id)} onValueChange={handleAnalistaChange}>
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                        <SelectValue placeholder="Selecione o analista..." />
                      </SelectTrigger>
                      <SelectContent>
                        {analistas.map((an) => (
                          <SelectItem key={an.id} value={idStr(an.id)}>
                            {an.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-[#161616] border border-gray-800 rounded p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Supervisor Responsável</Label>
                    <AtividadeInfoTooltip />
                  </div>
                  <div className="mt-2 text-sm">
                    {formData.supervisor_id ? (
                      <span className="text-gray-100">{getSupervisorNome(formData.supervisor_id)}</span>
                    ) : (
                      <span className="text-yellow-400">Selecione um analista para preencher</span>
                    )}
                  </div>
                </div>

                {/* Campos por tipo */}
                {selectedType === 'Chamados' && (
                  <div>
                    <Label>Ticket</Label>
                    <Input
                      value={formData.ticket_acompanhado}
                      onChange={(e) => setFormData((p) => ({ ...p, ticket_acompanhado: e.target.value }))}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                      placeholder="Ex.: INC000123"
                    />
                  </div>
                )}

                {selectedType === 'Ligações' && (
                  <div>
                    <Label>Protocolo da Gravação</Label>
                    <Input
                      value={formData.protocolo_gravacao}
                      onChange={(e) => setFormData((p) => ({ ...p, protocolo_gravacao: e.target.value }))}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                      placeholder="Ex.: 2026-02-26-XYZ"
                    />
                  </div>
                )}

                {selectedType === 'Monitoria Offline' && (
                  <MonitoriaOfflineForm
                    onTopicosChange={(topicos) =>
                      setFormData((p) => ({ ...p, topicos_monitoria_offline: topicos }))
                    }
                    onProtocoloChange={(protocolo) =>
                      setFormData((p) => ({ ...p, protocolo_gravacao: protocolo }))
                    }
                    onNotaChange={(nota) =>
                      setFormData((p) => ({ ...p, nota, status: 'Concluído' }))
                    }
                  />
                )}

                {selectedType === 'Monitoria Assistida' && (
                  <MonitoriaAssistidaForm
                    onTopicosChange={(topicos) =>
                      setFormData((p) => ({ ...p, topicos_monitoria_assistida: topicos }))
                    }
                    onLinkChange={(link) => setFormData((p) => ({ ...p, link_gravacao_teams: link }))}
                    onNotaChange={(nota) =>
                      setFormData((p) => ({ ...p, nota, status: 'Concluído' }))
                    }
                  />
                )}

                {selectedType === 'Feedback Individual' && (
                  <div>
                    <Label>Tipo de Feedback</Label>
                    <Select
                      value={formData.tipo_feedback || ''}
                      onValueChange={(val) => setFormData((p) => ({ ...p, tipo_feedback: val }))}
                    >
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Positivo">Positivo</SelectItem>
                        <SelectItem value="Negativo">Negativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedType !== 'Monitoria Offline' && selectedType !== 'Monitoria Assistida' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nota (0-10)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        value={formData.nota}
                        onChange={(e) => setFormData((p) => ({ ...p, nota: e.target.value }))}
                        className="bg-[#1a1a1a] border-gray-700 mt-2"
                        required
                      />
                    </div>

                    <div>
                      <Label>Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(val) => setFormData((p) => ({ ...p, status: val }))}
                      >
                        <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
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
                    onChange={(e) => setFormData((p) => ({ ...p, comentario: e.target.value }))}
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
                    placeholder="Descreva o registro..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="bg-[#1a1a1a] border border-gray-700"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>

                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {editingAtividade ? 'Salvar' : 'Registrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-[#121212] border border-gray-800 rounded p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-300" />
          <h2 className="font-semibold">Filtros</h2>
          <div className="flex-1" />
          <Button
            variant="secondary"
            className="bg-[#1a1a1a] border border-gray-700 gap-2"
            onClick={limparFiltros}
          >
            <X className="w-4 h-4" />
            Limpar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <Label>ID / Código</Label>
            <Input
              value={filterIdBusca}
              onChange={(e) => setFilterIdBusca(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-2"
              placeholder="CH00001 / 123"
            />
          </div>

          <div>
            <Label>Supervisor</Label>
            <Select
  value={filterSupervisor || ALL}
  onValueChange={(v) => setFilterSupervisor(v === ALL ? '' : v)}
>
              <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {supervisores.map((s) => (
                  <SelectItem key={s.id} value={idStr(s.id)}>
                    {getSupervisorNome(s.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Analista</Label>
            <Select
  value={filterAnalista || ALL}
  onValueChange={(v) => setFilterAnalista(v === ALL ? '' : v)}
>
              <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {analistas.map((a) => (
                  <SelectItem key={a.id} value={idStr(a.id)}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo</Label>
            <Select
  value={filterTipo || ALL}
  onValueChange={(v) => setFilterTipo(v === ALL ? '' : v)}
>
              <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="Chamados">Chamados</SelectItem>
                <SelectItem value="Ligações">Ligações</SelectItem>
                <SelectItem value="Monitoria Offline">Monitoria Offline</SelectItem>
                <SelectItem value="Monitoria Assistida">Monitoria Assistida</SelectItem>
                <SelectItem value="Feedback Individual">Feedback Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Início</Label>
            <Input
              type="date"
              value={filterDataInicio}
              onChange={(e) => setFilterDataInicio(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-2"
            />
          </div>

          <div>
            <Label>Fim</Label>
            <Input
              type="date"
              value={filterDataFim}
              onChange={(e) => setFilterDataFim(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-2"
            />
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-[#121212] border border-gray-800 rounded overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="text-sm text-gray-300">
            Total filtrado: <span className="text-gray-100 font-semibold">{filteredAtividades.length}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-300">Por página</div>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="bg-[#1a1a1a] border-gray-700 w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 flex items-center gap-2 text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando...
          </div>
        ) : paginatedAtividades.length === 0 ? (
          <div className="p-6 text-gray-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Nenhuma atividade encontrada com os filtros atuais.
          </div>
        ) : (
          <div className="w-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0f0f0f] text-gray-300">
                <tr>
                  <th className="text-left p-3">Código</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Analista</th>
                  <th className="text-left p-3">Supervisor</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Aprovação</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAtividades.map((a) => (
                  <tr key={a.id} className="border-t border-gray-800 hover:bg-[#141414]">
                    <td className="p-3 text-gray-100 font-medium">
                      {a.codigo_atividade || a.id}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded border ${getTipoColor(a.tipo)}`}>
                        {a.tipo || '-'}
                      </span>
                    </td>
                    <td className="p-3 text-gray-200">{getAnalistaNome(a.analista_id)}</td>
                    <td className="p-3 text-gray-200">{getSupervisorNome(a.supervisor_id)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded border ${getStatusColor(a.status)}`}>
                        {a.status || 'Aberto'}
                      </span>
                    </td>
                    <td className="p-3 text-gray-200">
                      <span className="text-xs">
                        {a.aprovacao_status || 'pendente'}
                        {a.aprovacao_status === 'rejeitado' && a.aprovacao_motivo_rejeicao ? (
                          <span className="block text-red-400 mt-1">
                            Motivo: {a.aprovacao_motivo_rejeicao}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          className="bg-[#1a1a1a] border border-gray-700"
                          onClick={() => openView(a)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {canEdit && (
                          <Button
                            variant="secondary"
                            className="bg-[#1a1a1a] border border-gray-700"
                            onClick={() => startEdit(a)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}

                        {canDelete && (
                          <Button
                            variant="destructive"
                            className="gap-2"
                            onClick={() => confirmDelete(a.id)}
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
        )}

        {/* Paginação */}
        <div className="flex items-center justify-between p-4 border-t border-gray-800">
          <div className="text-xs text-gray-400">
            Página <span className="text-gray-100">{page}</span> de{' '}
            <span className="text-gray-100">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="bg-[#1a1a1a] border border-gray-700"
              disabled={page <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              className="bg-[#1a1a1a] border border-gray-700"
              disabled={page >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      {/* Visualização */}
      <Dialog open={!!viewingAtividade} onOpenChange={(open) => !open && setViewingAtividade(null)}>
        <DialogContent className="bg-[#121212] border-gray-800 text-gray-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Atividade</DialogTitle>
          </DialogHeader>

          {viewingAtividade ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="text-gray-300">Código</div>
                <div className="text-gray-100 font-semibold">
                  {viewingAtividade.codigo_atividade || viewingAtividade.id}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-gray-300">Tipo</div>
                <div className="text-gray-100">{viewingAtividade.tipo || '-'}</div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-gray-300">Analista</div>
                <div className="text-gray-100">{getAnalistaNome(viewingAtividade.analista_id)}</div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-gray-300">Supervisor</div>
                <div className="text-gray-100">{getSupervisorNome(viewingAtividade.supervisor_id)}</div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-gray-300">Status</div>
                <div className="text-gray-100">{viewingAtividade.status || '-'}</div>
              </div>

              <div className="flex items-start justify-between gap-6">
                <div className="text-gray-300">Comentário</div>
                <div className="text-gray-100 text-right whitespace-pre-wrap">
                  {viewingAtividade.comentario || '-'}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#121212] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atividade?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1a1a] border border-gray-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Removendo...
                </span>
              ) : (
                'Remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}