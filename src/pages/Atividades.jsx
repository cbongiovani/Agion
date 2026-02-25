import React, { useState } from 'react';
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
import { Plus, Pencil, Trash2, ClipboardList, Loader2, Filter, X, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import NotaBadge from '@/components/ui/NotaBadge';
import AtividadeInfoTooltip from '@/components/AtividadeInfoTooltip';
import MonitoriaOfflineForm from '@/components/MonitoriaOfflineForm';
import MonitoriaAssistidaForm from '@/components/MonitoriaAssistidaForm';
import { Checkbox } from '@/components/ui/checkbox';
import { notificarCoordenadores, alertarAtividade } from '@/components/notificationHelper';

const TIPOS = ['Chamados', 'Ligações', 'Monitoria Offline', 'Monitoria Assistida', 'Feedback Individual'];
const STATUS = ['Aberto', 'Em evolução', 'Concluído'];

export default function Atividades() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [editingAtividade, setEditingAtividade] = useState(null);
   const [viewOnlyMode, setViewOnlyMode] = useState(false);
   const [deleteId, setDeleteId] = useState(null);
  const [filters, setFilters] = useState({
    supervisor_id: '',
    analista_id: '',
    tipo: '',
    dataInicio: '',
    dataFim: '',
  });
  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    analista_id: '',
    supervisor_id: '',
    tipo: '',
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

  const { data: currentUser } = useQuery({
     queryKey: ['currentUser'],
     queryFn: () => base44.auth.me(),
   });

   const { data: permissoesUsuario } = useQuery({
     queryKey: ['permissoesUsuario', currentUser?.email],
     queryFn: async () => {
       if (!currentUser?.email) return null;
       const perms = await base44.entities.PermissaoUsuario.filter({ usuario_email: currentUser.email });
       return perms.length > 0 ? perms[0] : null;
     },
     enabled: !!currentUser?.email,
   });

   const canView = currentUser?.role === 'admin' || permissoesUsuario?.permissoes_atividades?.visualizar || false;
   const canEdit = currentUser?.role === 'admin' || permissoesUsuario?.permissoes_atividades?.editar || false;
   const canDelete = currentUser?.role === 'admin' || permissoesUsuario?.permissoes_atividades?.deletar || false;
   const canCreate = currentUser?.role === 'admin' || permissoesUsuario?.permissoes_atividades?.criar || false;

  const { data: atividades = [], isLoading } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.Atividade.create(data);
      const user = await base44.auth.me();
      
      // Criar log
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Criou',
        entidade: 'Atividade',
        detalhes: `Criou atividade do tipo "${data.tipo}" para o analista`,
      });
      
      // Notificar coordenadores
      const analista = analistas.find(a => a.id === data.analista_id);
      const analistaNome = analista?.nome || 'analista';
      
      console.log('Notificando coordenadores sobre nova atividade:', {
        tipo: data.tipo,
        analista: analistaNome,
        registradoPor: user.full_name
      });
      
      try {
        await notificarCoordenadores(
          'nova_atividade',
          '📋 Nova Atividade Registrada',
          `${user.full_name} registrou atividade do tipo ${data.tipo} para ${analistaNome}`,
          'Atividades'
        );
        console.log('Coordenadores notificados com sucesso');
      } catch (error) {
        console.error('Erro ao notificar coordenadores:', error);
      }
      
      return result;
    },
    onMutate: async (newAtividade) => {
      await queryClient.cancelQueries({ queryKey: ['atividades'] });
      const previousAtividades = queryClient.getQueryData(['atividades']);
      queryClient.setQueryData(['atividades'], (old = []) => [
        { ...newAtividade, id: `temp-${Date.now()}` },
        ...old
      ]);
      return { previousAtividades };
    },
    onError: (err, newAtividade, context) => {
      queryClient.setQueryData(['atividades'], context.previousAtividades);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade criada com sucesso!');
      clearDraft();
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const result = await base44.entities.Atividade.update(id, data);
      const user = await base44.auth.me();
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'Atividade',
        detalhes: `Atualizou atividade do tipo "${data.tipo}"`,
      });
      return result;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['atividades'] });
      const previousAtividades = queryClient.getQueryData(['atividades']);
      queryClient.setQueryData(['atividades'], (old = []) =>
        old.map((atividade) => (atividade.id === id ? { ...atividade, ...data } : atividade))
      );
      return { previousAtividades };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['atividades'], context.previousAtividades);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade atualizada com sucesso!');
      clearDraft();
      resetForm();
    },
  });

  const alertarAtividadeMutation = useMutation({
    mutationFn: async ({ atividade, marcar }) => {
      const analista = analistas.find(a => a.id === atividade.analista_id);
      const analistaNome = analista?.nome || 'analista';
      
      console.log('Alerta mutation:', {
        marcar,
        atividadeId: atividade.id,
        analistaNome,
        supervisorId: atividade.supervisor_id
      });
      
      if (marcar) {
        try {
          console.log('Enviando alerta para supervisor...');
          await alertarAtividade(atividade.id, analistaNome, atividade.supervisor_id);
          console.log('Alerta enviado com sucesso');
        } catch (error) {
          console.error('Erro ao alertar supervisor:', error);
          throw error;
        }
      }
      
      await base44.entities.Atividade.update(atividade.id, { alerta_coordenador: marcar });
    },
    onSuccess: (_, { marcar }) => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      toast.success(marcar ? 'Alerta enviado ao supervisor!' : 'Alerta removido');
    },
    onError: (error) => {
      console.error('Erro na mutation de alerta:', error);
      toast.error('Erro ao processar alerta. Verifique o console.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const user = await base44.auth.me();
      await base44.entities.Atividade.delete(id);
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Excluiu',
        entidade: 'Atividade',
        detalhes: `Excluiu uma atividade`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade excluída com sucesso!');
      setDeleteId(null);
    },
  });

  const saveDraft = () => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'supervisor') {
      localStorage.setItem('draft_atividade', JSON.stringify({
        formData,
        editingAtividade,
        timestamp: Date.now()
      }));
    }
  };

  const loadDraft = () => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'supervisor') {
      const draft = localStorage.getItem('draft_atividade');
      if (draft) {
        const { formData: savedFormData, editingAtividade: savedEditing, timestamp } = JSON.parse(draft);
        const hoursDiff = (Date.now() - timestamp) / (1000 * 60 * 60);
        if (hoursDiff < 24) {
          toast.success('Rascunho restaurado!', {
            action: {
              label: 'Descartar',
              onClick: () => {
                localStorage.removeItem('draft_atividade');
                resetForm();
              }
            }
          });
          setFormData(savedFormData);
          setEditingAtividade(savedEditing);
        } else {
          localStorage.removeItem('draft_atividade');
        }
      }
    }
  };

  const clearDraft = () => {
    localStorage.removeItem('draft_atividade');
  };

  const resetForm = () => {
    setFormData({
      data: format(new Date(), 'yyyy-MM-dd'),
      analista_id: '',
      supervisor_id: '',
      tipo: '',
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
    setViewOnlyMode(false);
    setIsDialogOpen(false);
  };

  const validarFormulario = () => {
    const camposFaltando = [];
    
    // Validações obrigatórias
    if (!formData.data) camposFaltando.push('Data');
    if (!formData.tipo) camposFaltando.push('Tipo');
    if (!formData.analista_id) camposFaltando.push('Analista');
    
    // Validações específicas por tipo
    if (formData.tipo === 'Monitoria Offline') {
      const topicoKeys = ['saudacao_padrao', 'validacao_loja', 'dominio_problema', 'comunicacao_direta', 'dominio_conclusao', 'tratou_respeito', 'teve_equilibrio', 'ruido_ambiente', 'retorno_loja', 'encerramento_padrao'];
      const topicosFaltando = topicoKeys.filter(key => !formData.topicos_monitoria_offline[key]);
      if (topicosFaltando.length > 0) camposFaltando.push('Tópicos de Monitoria Offline (todos devem ser preenchidos)');
    } else if (formData.tipo === 'Monitoria Assistida') {
      if (!formData.link_gravacao_teams) camposFaltando.push('Link da Gravação Teams');
    } else if (formData.tipo === 'Chamados') {
      if (!formData.ticket_acompanhado) camposFaltando.push('Ticket Acompanhado');
    } else if (formData.tipo === 'Ligações') {
      if (!formData.protocolo_gravacao) camposFaltando.push('Protocolo');
    } else if (formData.tipo === 'Feedback Individual') {
      if (!formData.tipo_feedback) camposFaltando.push('Tipo de Feedback');
      if (!formData.nota) camposFaltando.push('Nota');
    } else {
      if (!formData.nota) camposFaltando.push('Nota');
    }
    
    if (camposFaltando.length > 0) {
      toast.error(`Campos obrigatórios faltando:\n${camposFaltando.map(c => `• ${c}`).join('\n')}`);
      return false;
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validarFormulario()) return;
    
    let nota = parseFloat(formData.nota);
    
    // Calcular nota automaticamente para Monitoria Offline (com pesos)
    if (formData.tipo === 'Monitoria Offline') {
      const topicoKeys = [
        'saudacao_padrao',
        'validacao_loja',
        'dominio_problema',
        'comunicacao_direta',
        'dominio_conclusao',
        'tratou_respeito',
        'teve_equilibrio',
        'ruido_ambiente',
        'retorno_loja',
        'encerramento_padrao'
      ];
      
      // Validar se todos os tópicos foram preenchidos
      const topicosFaltando = topicoKeys.filter(key => !formData.topicos_monitoria_offline[key]);
      if (topicosFaltando.length > 0) {
        toast.error('Por favor, preencha todos os tópicos de avaliação antes de criar a atividade.');
        return;
      }
      
      const pesos = {
        saudacao_padrao: 0.5,
        validacao_loja: 1.0,
        dominio_problema: 1.5,
        comunicacao_direta: 1.0,
        dominio_conclusao: 1.5,
        tratou_respeito: 1.0,
        teve_equilibrio: 1.0,
        ruido_ambiente: 1.0,
        retorno_loja: 1.0,
        encerramento_padrao: 0.5
      };
      
      let totalPonderado = 0;
      let pesoTotal = 0;
      
      Object.entries(formData.topicos_monitoria_offline).forEach(([key, valor]) => {
        if (valor && pesos[key]) {
          totalPonderado += valor * pesos[key];
          pesoTotal += pesos[key];
        }
      });
      
      if (pesoTotal > 0) {
        nota = Math.min((totalPonderado / pesoTotal) * 2, 10);
        nota = parseFloat(nota.toFixed(2));
      }
    }
    
    // Calcular nota automaticamente para Monitoria Assistida
    if (formData.tipo === 'Monitoria Assistida' && Object.keys(formData.topicos_monitoria_assistida).length > 0) {
      const acertos = Object.values(formData.topicos_monitoria_assistida).filter(v => v === true).length;
      nota = parseFloat(acertos.toFixed(1));
    }
    
    if (nota < 0 || nota > 10) {
      toast.error('A nota deve estar entre 0 e 10');
      return;
    }
    
    const payload = { 
      ...formData, 
      nota,
      registrado_por: currentUser?.email
    };
    
    if (editingAtividade) {
      updateMutation.mutate({ id: editingAtividade.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEdit = (atividade, viewOnly = false) => {
    setEditingAtividade(atividade);
    setViewOnlyMode(viewOnly);
    setFormData({
      data: atividade.data,
      analista_id: atividade.analista_id,
      supervisor_id: atividade.supervisor_id,
      tipo: atividade.tipo,
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
    setIsDialogOpen(true);
  };

  const getAtividadeColor = (tipo) => {
    const colors = {
      'Monitoria Offline': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Monitoria Assistida': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'Chamados': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      'Ligações': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      'Feedback Individual': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    };
    return colors[tipo] || 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const getSupervisorNome = (id) => supervisores.find(s => s.id === id)?.nome || '-';
   const getAnalistaNome = (id) => {
     const analista = analistas.find(a => a.id === id);
     const usuario = usuarios.find(u => u.email === analista?.usuario_email);
     return usuario?.nome_customizado || usuario?.full_name || analista?.nome || '-';
    };
    const getUsuarioNome = (email) => {
      const usuario = usuarios.find(u => u.email === email);
      return usuario?.nome_customizado || usuario?.full_name || email || '-';
    };

  const handleAnalistaChange = (analistaId) => {
    const analista = analistas.find(a => a.id === analistaId);
    setFormData({
      ...formData,
      analista_id: analistaId,
      supervisor_id: analista?.supervisor_id || ''
    });
  };

  const filteredAnalistas = filters.supervisor_id
    ? analistas.filter(a => a.supervisor_id === filters.supervisor_id)
    : analistas;

  const filteredAtividades = atividades.filter(a => {
    if (filters.supervisor_id && a.supervisor_id !== filters.supervisor_id) return false;
    if (filters.analista_id && a.analista_id !== filters.analista_id) return false;
    if (filters.tipo && a.tipo !== filters.tipo) return false;
    if (filters.dataInicio && a.data < filters.dataInicio) return false;
    if (filters.dataFim && a.data > filters.dataFim) return false;
    return true;
  });

  const clearFilters = () => {
    setFilters({
      supervisor_id: '',
      analista_id: '',
      tipo: '',
      dataInicio: '',
      dataFim: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

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
          <Dialog open={isDialogOpen} onOpenChange={(open) => { 
            if (!open) { 
              saveDraft(); 
              resetForm(); 
            } else {
              loadDraft();
            }
            setIsDialogOpen(open); 
          }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Plus className="w-4 h-4" />
                Nova Atividade
              </Button>
            </DialogTrigger>
          <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAtividade ? (viewOnlyMode ? 'Visualizar Atividade' : 'Editar Atividade') : 'Nova Atividade'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={viewOnlyMode ? (e) => { e.preventDefault(); resetForm(); } : handleSubmit} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <Label>Data</Label>
                   <Input
                     type="date"
                     value={formData.data}
                     onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                     className="bg-[#1a1a1a] border-gray-700 mt-2 [color-scheme:dark]"
                     disabled={viewOnlyMode}
                     required
                   />
                 </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                    disabled={viewOnlyMode}
                  >
                    <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2" disabled={viewOnlyMode}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#242424] border-gray-700">
                      {TIPOS.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-gray-300">Analista</Label>
                <Select
                  value={formData.analista_id}
                  onValueChange={handleAnalistaChange}
                  disabled={viewOnlyMode}
                >
                  <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2" disabled={viewOnlyMode}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#242424] border-gray-700">
                    {analistas.map((an) => (
                      <SelectItem key={an.id} value={an.id}>{an.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.supervisor_id && (
                  <p className="text-xs text-gray-400 mt-1">
                    Supervisor: {getSupervisorNome(formData.supervisor_id)}
                  </p>
                )}
              </div>
              {formData.tipo === 'Monitoria Offline' && (
                <MonitoriaOfflineForm
                  topicos={formData.topicos_monitoria_offline}
                  onChange={(topicos) => setFormData({ ...formData, topicos_monitoria_offline: topicos })}
                  protocolo={formData.protocolo_gravacao}
                  onProtocoloChange={(value) => setFormData({ ...formData, protocolo_gravacao: value })}
                  disabled={viewOnlyMode}
                />
              )}
              {formData.tipo === 'Monitoria Assistida' && (
                <MonitoriaAssistidaForm
                  topicos={formData.topicos_monitoria_assistida}
                  onChange={(topicos) => setFormData({ ...formData, topicos_monitoria_assistida: topicos })}
                  linkGravacao={formData.link_gravacao_teams}
                  onLinkChange={(value) => setFormData({ ...formData, link_gravacao_teams: value })}
                  disabled={viewOnlyMode}
                />
              )}
              {formData.tipo === 'Chamados' && (
                <div>
                  <Label className="text-gray-300">Ticket Acompanhado</Label>
                  <Input
                    type="text"
                    maxLength={10}
                    value={formData.ticket_acompanhado}
                    onChange={(e) => setFormData({ ...formData, ticket_acompanhado: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
                    placeholder="Digite o ticket (10 caracteres)"
                    disabled={viewOnlyMode}
                  />
                </div>
              )}
              {formData.tipo === 'Ligações' && (
                <div>
                  <Label className="text-gray-300">Protocolo</Label>
                  <Input
                    type="text"
                    value={formData.protocolo_gravacao}
                    onChange={(e) => setFormData({ ...formData, protocolo_gravacao: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
                    placeholder="Digite o protocolo"
                    disabled={viewOnlyMode}
                  />
                </div>
              )}
              {formData.tipo === 'Feedback Individual' && (
                <div>
                  <Label className="text-gray-300">Tipo de Feedback</Label>
                  <div className="flex items-center gap-6 mt-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="positivo"
                        checked={formData.tipo_feedback === 'Positivo'}
                        onCheckedChange={(checked) => checked && setFormData({ ...formData, tipo_feedback: 'Positivo' })}
                        disabled={viewOnlyMode}
                      />
                      <label htmlFor="positivo" className={`text-sm cursor-pointer ${viewOnlyMode ? 'text-gray-400' : 'text-white'}`}>
                        Positivo
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="negativo"
                        checked={formData.tipo_feedback === 'Negativo'}
                        onCheckedChange={(checked) => checked && setFormData({ ...formData, tipo_feedback: 'Negativo' })}
                        disabled={viewOnlyMode}
                      />
                      <label htmlFor="negativo" className={`text-sm cursor-pointer ${viewOnlyMode ? 'text-gray-400' : 'text-white'}`}>
                        Negativo
                      </label>
                    </div>
                  </div>
                </div>
              )}
              {!['Monitoria Offline', 'Monitoria Assistida'].includes(formData.tipo) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Nota (0-10)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={formData.nota}
                      onChange={(e) => setFormData({ ...formData, nota: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                      disabled={viewOnlyMode}
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                      disabled={viewOnlyMode}
                    >
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2" disabled={viewOnlyMode}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242424] border-gray-700">
                        {STATUS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {['Monitoria Offline', 'Monitoria Assistida'].includes(formData.tipo) && (
                <div>
                  <Label className="text-gray-300">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                    disabled={viewOnlyMode}
                  >
                    <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2" disabled={viewOnlyMode}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#242424] border-gray-700">
                      {STATUS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-gray-300">Comentário</Label>
                <Textarea
                  value={formData.comentario}
                  onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                  className="bg-[#1a1a1a] border-gray-700 mt-2 h-24"
                  placeholder="Observações sobre a atividade..."
                  disabled={viewOnlyMode}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="border-gray-700">
                  {viewOnlyMode ? 'Fechar' : 'Cancelar'}
                </Button>
                {!viewOnlyMode && (
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                    {editingAtividade ? 'Atualizar' : 'Criar'}
                  </Button>
                )}
              </div>
            </form>
            </DialogContent>
            </Dialog>
            )}
            </div>

      {/* Filtros */}
      <div className="bg-[#242424] rounded-2xl border border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Filtros</span>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-400 hover:text-white ml-auto gap-1">
              <X className="w-3 h-3" />
              Limpar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Select value={filters.supervisor_id} onValueChange={(value) => setFilters({ ...filters, supervisor_id: value, analista_id: '' })}>
            <SelectTrigger className="bg-[#1a1a1a] border-gray-700">
              <SelectValue placeholder="Supervisor" />
            </SelectTrigger>
            <SelectContent className="bg-[#242424] border-gray-700">
              <SelectItem value={null}>Todos</SelectItem>
              {supervisores.map((sup) => (
                <SelectItem key={sup.id} value={sup.id}>{sup.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.analista_id} onValueChange={(value) => setFilters({ ...filters, analista_id: value })}>
            <SelectTrigger className="bg-[#1a1a1a] border-gray-700">
              <SelectValue placeholder="Analista" />
            </SelectTrigger>
            <SelectContent className="bg-[#242424] border-gray-700">
              <SelectItem value={null}>Todos</SelectItem>
              {filteredAnalistas.map((an) => (
                <SelectItem key={an.id} value={an.id}>{an.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.tipo} onValueChange={(value) => setFilters({ ...filters, tipo: value })}>
            <SelectTrigger className="bg-[#1a1a1a] border-gray-700">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent className="bg-[#242424] border-gray-700">
              <SelectItem value={null}>Todos</SelectItem>
              {TIPOS.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filters.dataInicio}
            onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
            className="bg-[#1a1a1a] border-gray-700 [color-scheme:dark]"
            placeholder="Data início"
          />
          <Input
            type="date"
            value={filters.dataFim}
            onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
            className="bg-[#1a1a1a] border-gray-700 [color-scheme:dark]"
            placeholder="Data fim"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-[#242424] rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-800 bg-[#1a1a1a]">
                <th className="px-6 py-4 font-medium">Data</th>
                <th className="px-6 py-4 font-medium">Tipo</th>
                <th className="px-6 py-4 font-medium">Supervisor Resp.</th>
                <th className="px-6 py-4 font-medium">Analista</th>
                <th className="px-6 py-4 font-medium">Registrado Por</th>
                <th className="px-6 py-4 font-medium">Nota</th>
                 <th className="px-6 py-4 font-medium">Status</th>
                 <th className="px-6 py-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredAtividades.map((atividade) => (
                <tr key={atividade.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-6 py-4 text-white">
                    {format(new Date(atividade.data), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getAtividadeColor(atividade.tipo)}`}>
                        {atividade.tipo}
                      </span>
                      <AtividadeInfoTooltip tipo={atividade.tipo} />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {getSupervisorNome(atividade.supervisor_id)}
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {getAnalistaNome(atividade.analista_id)}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {getUsuarioNome(atividade.registrado_por)}
                  </td>
                  <td className="px-6 py-4">
                    <NotaBadge nota={atividade.nota} />
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${
                      atividade.status === 'Concluído' 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : atividade.status === 'Em evolução'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}>
                      {atividade.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-1">
                      {currentUser?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => alertarAtividadeMutation.mutate({ 
                            atividade, 
                            marcar: !atividade.alerta_coordenador 
                          })}
                          className={`min-w-[44px] min-h-[44px] ${
                            atividade.alerta_coordenador 
                              ? 'text-[#e74c3c] hover:text-[#c0392b]' 
                              : 'text-gray-400 hover:text-[#e74c3c]'
                          }`}
                          title={atividade.alerta_coordenador ? 'Remover alerta' : 'Alertar supervisor'}
                        >
                          <AlertTriangle 
                            className="w-4 h-4" 
                            fill={atividade.alerta_coordenador ? '#e74c3c' : 'none'} 
                          />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(atividade, true)}
                        className="text-gray-400 hover:text-emerald-400 min-w-[44px] min-h-[44px]"
                        title="Visualizar detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(atividade)}
                          className="text-gray-400 hover:text-white min-w-[44px] min-h-[44px]"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(atividade.id)}
                          className="text-gray-400 hover:text-red-400 min-w-[44px] min-h-[44px]"
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
      </div>

      {/* Mobile Card List */}
      <div className="lg:hidden space-y-4">
        {filteredAtividades.map((atividade) => (
          <div key={atividade.id} className="bg-[#242424] rounded-2xl border border-gray-800 p-4">
            <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getAtividadeColor(atividade.tipo)}`}>
                {atividade.tipo}
              </span>
              <AtividadeInfoTooltip tipo={atividade.tipo} />
            </div>
              <NotaBadge nota={atividade.nota} />
            </div>
            
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Data</span>
                <span className="text-sm text-white">{format(new Date(atividade.data), 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Supervisor Resp.</span>
                <span className="text-sm text-gray-300">{getSupervisorNome(atividade.supervisor_id)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Analista</span>
                <span className="text-sm text-gray-300">{getAnalistaNome(atividade.analista_id)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Registrado Por</span>
                <span className="text-sm text-gray-300">{getUsuarioNome(atividade.registrado_por)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${
                  atividade.status === 'Concluído' 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : atividade.status === 'Em evolução'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                }`}>
                  {atividade.status}
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-2">
               {currentUser?.role === 'admin' && (
                 <Button
                   variant="outline"
                   size="icon"
                   onClick={() => alertarAtividadeMutation.mutate({ 
                     atividade, 
                     marcar: !atividade.alerta_coordenador 
                   })}
                   className={`border-gray-700 min-w-[44px] min-h-[44px] ${
                     atividade.alerta_coordenador 
                       ? 'text-[#e74c3c] hover:text-[#c0392b] bg-[#1a1a1a]' 
                       : 'text-gray-400 hover:text-[#e74c3c]'
                   }`}
                   title={atividade.alerta_coordenador ? 'Remover alerta' : 'Alertar supervisor'}
                 >
                   <AlertTriangle 
                     className="w-4 h-4" 
                     fill={atividade.alerta_coordenador ? '#e74c3c' : 'none'} 
                   />
                 </Button>
               )}
               <Button
                 variant="outline"
                 size="icon"
                 onClick={() => openEdit(atividade, true)}
                 className="text-gray-400 hover:text-emerald-400 border-gray-700 min-w-[44px] min-h-[44px]"
                 title="Visualizar detalhes"
               >
                 <Eye className="w-4 h-4" />
               </Button>
               {canEdit && (
                 <Button
                   variant="outline"
                   size="icon"
                   onClick={() => openEdit(atividade)}
                   className="text-gray-400 hover:text-white border-gray-700 min-w-[44px] min-h-[44px]"
                 >
                   <Pencil className="w-4 h-4" />
                 </Button>
               )}
               {canDelete && (
                 <Button
                   variant="outline"
                   size="icon"
                   onClick={() => setDeleteId(atividade.id)}
                   className="text-red-400 hover:text-red-300 border-gray-700 min-w-[44px] min-h-[44px]"
                 >
                   <Trash2 className="w-4 h-4" />
                 </Button>
               )}
             </div>
          </div>
        ))}
      </div>

      {filteredAtividades.length === 0 && (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhuma atividade encontrada</p>
        </div>
      )}

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