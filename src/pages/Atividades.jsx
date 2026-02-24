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
import { Plus, Pencil, Trash2, ClipboardList, Loader2, Filter, X, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import NotaBadge from '@/components/ui/NotaBadge';
import AtividadeInfoTooltip from '@/components/AtividadeInfoTooltip';
import MonitoriaOfflineForm from '@/components/MonitoriaOfflineForm';
import MonitoriaAssistidaForm from '@/components/MonitoriaAssistidaForm';
import { Checkbox } from '@/components/ui/checkbox';

const TIPOS = ['Chamados', 'Ligações', 'Monitoria Offline', 'Monitoria Assistida', 'Feedback Individual'];
const STATUS = ['Aberto', 'Em evolução', 'Concluído'];

export default function Atividades() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAtividade, setEditingAtividade] = useState(null);
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

   const canEdit = currentUser?.role === 'admin';
   const canDelete = currentUser?.role === 'admin';
   const canCreate = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';

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
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Criou',
        entidade: 'Atividade',
        detalhes: `Criou atividade do tipo "${data.tipo}" para o analista`,
      });
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
      resetForm();
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
    setIsDialogOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
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

  const openEdit = (atividade) => {
    setEditingAtividade(atividade);
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

  const getSupervisorNome = (id) => supervisores.find(s => s.id === id)?.nome || '-';
  const getAnalistaNome = (id) => analistas.find(a => a.id === id)?.nome || '-';
  const getUsuarioNome = (email) => {
    const usuario = usuarios.find(u => u.email === email);
    return usuario?.full_name || email || '-';
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
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Plus className="w-4 h-4" />
                Nova Atividade
              </Button>
            </DialogTrigger>
          <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAtividade ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2 [color-scheme:dark]"
                    required
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
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
                <Label>Analista</Label>
                <Select
                  value={formData.analista_id}
                  onValueChange={handleAnalistaChange}
                >
                  <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
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
                />
              )}
              {formData.tipo === 'Monitoria Assistida' && (
                <MonitoriaAssistidaForm
                  topicos={formData.topicos_monitoria_assistida}
                  onChange={(topicos) => setFormData({ ...formData, topicos_monitoria_assistida: topicos })}
                  linkGravacao={formData.link_gravacao_teams}
                  onLinkChange={(value) => setFormData({ ...formData, link_gravacao_teams: value })}
                />
              )}
              {formData.tipo === 'Chamados' && (
                <div>
                  <Label>Ticket Acompanhado</Label>
                  <Input
                    type="text"
                    maxLength={10}
                    value={formData.ticket_acompanhado}
                    onChange={(e) => setFormData({ ...formData, ticket_acompanhado: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
                    placeholder="Digite o ticket (10 caracteres)"
                  />
                </div>
              )}
              {formData.tipo === 'Ligações' && (
                <div>
                  <Label>Protocolo</Label>
                  <Input
                    type="text"
                    value={formData.protocolo_gravacao}
                    onChange={(e) => setFormData({ ...formData, protocolo_gravacao: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
                    placeholder="Digite o protocolo"
                  />
                </div>
              )}
              {formData.tipo === 'Feedback Individual' && (
                <div>
                  <Label>Tipo de Feedback</Label>
                  <div className="flex items-center gap-6 mt-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="positivo"
                        checked={formData.tipo_feedback === 'Positivo'}
                        onCheckedChange={(checked) => checked && setFormData({ ...formData, tipo_feedback: 'Positivo' })}
                      />
                      <label htmlFor="positivo" className="text-sm text-white cursor-pointer">
                        Positivo
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="negativo"
                        checked={formData.tipo_feedback === 'Negativo'}
                        onCheckedChange={(checked) => checked && setFormData({ ...formData, tipo_feedback: 'Negativo' })}
                      />
                      <label htmlFor="negativo" className="text-sm text-white cursor-pointer">
                        Negativo
                      </label>
                    </div>
                  </div>
                </div>
              )}
              {!['Monitoria Offline', 'Monitoria Assistida'].includes(formData.tipo) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nota (0-10)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
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
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
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
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
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
                <Label>Comentário</Label>
                <Textarea
                  value={formData.comentario}
                  onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                  className="bg-[#1a1a1a] border-gray-700 mt-2 h-24"
                  placeholder="Observações sobre a atividade..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="border-gray-700">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                  {editingAtividade ? 'Atualizar' : 'Criar'}
                </Button>
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
                <th className="px-6 py-4 font-medium text-right">Ações</th>
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
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
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
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
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
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
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

            <div className="flex gap-2">
               <Button
                 variant="outline"
                 size="icon"
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