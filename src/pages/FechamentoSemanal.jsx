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
import { Plus, Pencil, Trash2, Calendar, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function FechamentoSemanal() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFechamento, setEditingFechamento] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

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

  const canCreate = currentUser?.role === 'admin' || permissoesUsuario?.permissoes_fechamento?.criar || false;
  const canEdit = currentUser?.role === 'admin' || permissoesUsuario?.permissoes_fechamento?.editar || false;
  const canDelete = currentUser?.role === 'admin' || permissoesUsuario?.permissoes_fechamento?.deletar || false;
  
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  
  const [formData, setFormData] = useState({
    semana_inicio: format(weekStart, 'yyyy-MM-dd'),
    semana_fim: format(weekEnd, 'yyyy-MM-dd'),
    analista_id: '',
    supervisor_id: '',
    total_ligacoes_next_ip: '',
    total_chamados_verdana: '',
    total_monitorias: '',
    total_1_1: '',
    backlog_final: '',
    observacoes: '',
    destaques: '',
    pontos_criticos: '',
    plano_acao: '',
  });

  const { data: fechamentos = [], isLoading } = useQuery({
    queryKey: ['fechamentos'],
    queryFn: () => base44.entities.FechamentoSemanal.list('-created_date'),
  });

  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.FechamentoSemanal.create(data);
      const user = await base44.auth.me();
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Criou',
        entidade: 'FechamentoSemanal',
        detalhes: `Registrou fechamento semanal para supervisor`,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fechamentos'] });
      toast.success('Fechamento registrado com sucesso!');
      clearDraft();
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const result = await base44.entities.FechamentoSemanal.update(id, data);
      const user = await base44.auth.me();
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'FechamentoSemanal',
        detalhes: `Atualizou fechamento semanal`,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fechamentos'] });
      toast.success('Fechamento atualizado com sucesso!');
      clearDraft();
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const user = await base44.auth.me();
      await base44.entities.FechamentoSemanal.delete(id);
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Excluiu',
        entidade: 'FechamentoSemanal',
        detalhes: `Excluiu fechamento semanal`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fechamentos'] });
      toast.success('Fechamento excluído com sucesso!');
      setDeleteId(null);
    },
  });

  const saveDraft = () => {
    const currentUserRole = localStorage.getItem('currentUserRole');
    if (currentUserRole === 'admin' || currentUserRole === 'supervisor') {
      localStorage.setItem('draft_fechamento', JSON.stringify({
        formData,
        editingFechamento,
        timestamp: Date.now()
      }));
    }
  };

  const loadDraft = async () => {
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin' || user?.role === 'supervisor') {
        const draft = localStorage.getItem('draft_fechamento');
        if (draft) {
          const { formData: savedFormData, editingFechamento: savedEditing, timestamp } = JSON.parse(draft);
          const hoursDiff = (Date.now() - timestamp) / (1000 * 60 * 60);
          if (hoursDiff < 24) {
            toast.success('Rascunho restaurado!', {
              action: {
                label: 'Descartar',
                onClick: () => {
                  localStorage.removeItem('draft_fechamento');
                  resetForm();
                }
              }
            });
            setFormData(savedFormData);
            setEditingFechamento(savedEditing);
          } else {
            localStorage.removeItem('draft_fechamento');
          }
        }
      }
    } catch (err) {}
  };

  const clearDraft = () => {
    localStorage.removeItem('draft_fechamento');
  };

  const resetForm = () => {
    setFormData({
      semana_inicio: format(weekStart, 'yyyy-MM-dd'),
      semana_fim: format(weekEnd, 'yyyy-MM-dd'),
      analista_id: '',
      supervisor_id: '',
      total_ligacoes_next_ip: '',
      total_chamados_verdana: '',
      total_monitorias: '',
      total_1_1: '',
      backlog_final: '',
      observacoes: '',
      destaques: '',
      pontos_criticos: '',
      plano_acao: '',
    });
    setEditingFechamento(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Verificar duplicação
    const duplicado = fechamentos.find(f => 
      f.supervisor_id === formData.supervisor_id &&
      f.semana_inicio === formData.semana_inicio &&
      (!editingFechamento || f.id !== editingFechamento.id)
    );
    
    if (duplicado) {
      toast.error('Já existe um fechamento para este supervisor nesta semana!');
      return;
    }

    const payload = {
      ...formData,
      analista_id: formData.analista_id || null,
      total_ligacoes_next_ip: parseInt(formData.total_ligacoes_next_ip) || 0,
      total_chamados_verdana: parseInt(formData.total_chamados_verdana) || 0,
      total_monitorias: parseInt(formData.total_monitorias) || 0,
      total_1_1: parseInt(formData.total_1_1) || 0,
      backlog_final: parseInt(formData.backlog_final) || 0,
    };

    if (editingFechamento) {
      updateMutation.mutate({ id: editingFechamento.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEdit = (fechamento) => {
    setEditingFechamento(fechamento);
    setFormData({
      semana_inicio: fechamento.semana_inicio,
      semana_fim: fechamento.semana_fim,
      analista_id: fechamento.analista_id || '',
      supervisor_id: fechamento.supervisor_id,
      total_ligacoes_next_ip: fechamento.total_ligacoes_next_ip?.toString() || '',
      total_chamados_verdana: fechamento.total_chamados_verdana?.toString() || '',
      total_monitorias: fechamento.total_monitorias?.toString() || '',
      total_1_1: fechamento.total_1_1?.toString() || '',
      backlog_final: fechamento.backlog_final?.toString() || '',
      observacoes: fechamento.observacoes || '',
      destaques: fechamento.destaques || '',
      pontos_criticos: fechamento.pontos_criticos || '',
      plano_acao: fechamento.plano_acao || '',
    });
    setIsDialogOpen(true);
  };

  const getSupervisorNome = (id) => supervisores.find(s => s.id === id)?.nome || '-';
  const getAnalistaNome = (id) => analistas.find(a => a.id === id)?.nome || '-';

  const handleAnalistaChange = (analistaId) => {
    const analista = analistas.find(a => a.id === analistaId);
    setFormData({
      ...formData,
      analista_id: analistaId,
      supervisor_id: analista?.supervisor_id || ''
    });
  };

  // Supervisores sem fechamento na semana atual
  const supervisoresSemFechamento = supervisores.filter(sup => {
    return !fechamentos.some(f => 
      f.supervisor_id === sup.id && 
      f.semana_inicio === format(weekStart, 'yyyy-MM-dd')
    );
  });

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
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Fechamento Semanal</h1>
          <p className="text-gray-400 mt-1">Consolidação semanal por supervisor</p>
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
                Novo Fechamento
              </Button>
            </DialogTrigger>
          <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFechamento ? 'Editar Fechamento' : 'Novo Fechamento Semanal'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Semana Início</Label>
                  <Input
                    type="date"
                    value={formData.semana_inicio}
                    onChange={(e) => setFormData({ ...formData, semana_inicio: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
                    required
                  />
                </div>
                <div>
                  <Label>Semana Fim</Label>
                  <Input
                    type="date"
                    value={formData.semana_fim}
                    onChange={(e) => setFormData({ ...formData, semana_fim: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
                    required
                  />
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
              </div>

              <div className="border-t border-gray-800 pt-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Totais Obrigatórios</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <Label>Ligações Next IP</Label>
                    <Input
                      type="number"
                      value={formData.total_ligacoes_next_ip}
                      onChange={(e) => setFormData({ ...formData, total_ligacoes_next_ip: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label>Chamados Verdana</Label>
                    <Input
                      type="number"
                      value={formData.total_chamados_verdana}
                      onChange={(e) => setFormData({ ...formData, total_chamados_verdana: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label>Monitorias</Label>
                    <Input
                      type="number"
                      value={formData.total_monitorias}
                      onChange={(e) => setFormData({ ...formData, total_monitorias: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label>Feedbacks Individuais</Label>
                    <Input
                      type="number"
                      value={formData.total_1_1}
                      onChange={(e) => setFormData({ ...formData, total_1_1: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Campos Adicionais</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Backlog Final</Label>
                    <Input
                      type="number"
                      value={formData.backlog_final}
                      onChange={(e) => setFormData({ ...formData, backlog_final: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                    />
                  </div>
                  <div>
                    <Label>Destaques</Label>
                    <Textarea
                      value={formData.destaques}
                      onChange={(e) => setFormData({ ...formData, destaques: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2 h-20"
                      placeholder="Principais destaques da semana..."
                    />
                  </div>
                  <div>
                    <Label>Pontos Críticos</Label>
                    <Textarea
                      value={formData.pontos_criticos}
                      onChange={(e) => setFormData({ ...formData, pontos_criticos: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2 h-20"
                      placeholder="Pontos que requerem atenção..."
                    />
                  </div>
                  <div>
                    <Label>Plano de Ação</Label>
                    <Textarea
                      value={formData.plano_acao}
                      onChange={(e) => setFormData({ ...formData, plano_acao: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2 h-20"
                      placeholder="Ações planejadas para a próxima semana..."
                    />
                  </div>
                  <div>
                    <Label>Observações Gerais</Label>
                    <Textarea
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2 h-20"
                      placeholder="Outras observações relevantes..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <Button type="button" variant="outline" onClick={resetForm} className="border-gray-700">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                  {editingFechamento ? 'Atualizar' : 'Registrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Alerta de supervisores sem fechamento */}
      {supervisoresSemFechamento.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium">Fechamentos pendentes esta semana</p>
            <p className="text-sm text-gray-400 mt-1">
              Supervisores sem fechamento: {supervisoresSemFechamento.map(s => s.nome).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Lista de fechamentos */}
      <div className="space-y-4">
        {fechamentos.map((fechamento) => (
          <div
            key={fechamento.id}
            className="bg-[#242424] rounded-2xl border border-gray-800 p-6 hover:border-emerald-500/30 transition-all"
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    {getSupervisorNome(fechamento.supervisor_id)}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {format(addDays(new Date(fechamento.semana_inicio), 1), "dd/MM/yyyy", { locale: ptBR })} - {format(addDays(new Date(fechamento.semana_fim), 1), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  {fechamento.analista_id && (
                    <p className="text-xs text-emerald-400 mt-1">
                      Analista: {getAnalistaNome(fechamento.analista_id)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center px-4 py-2 bg-[#1a1a1a] rounded-lg">
                  <p className="text-2xl font-bold text-emerald-400">{fechamento.total_ligacoes_next_ip}</p>
                  <p className="text-xs text-gray-400">Ligações</p>
                </div>
                <div className="text-center px-4 py-2 bg-[#1a1a1a] rounded-lg">
                  <p className="text-2xl font-bold text-blue-400">{fechamento.total_chamados_verdana}</p>
                  <p className="text-xs text-gray-400">Chamados</p>
                </div>
                <div className="text-center px-4 py-2 bg-[#1a1a1a] rounded-lg">
                  <p className="text-2xl font-bold text-amber-400">{fechamento.total_monitorias}</p>
                  <p className="text-xs text-gray-400">Monitorias</p>
                </div>
                <div className="text-center px-4 py-2 bg-[#1a1a1a] rounded-lg">
                  <p className="text-2xl font-bold text-purple-400">{fechamento.total_1_1}</p>
                  <p className="text-xs text-gray-400">Feedbacks</p>
                </div>
              </div>

              <div className="flex gap-2">
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(fechamento)}
                    className="text-gray-400 hover:text-white"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(fechamento.id)}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {(fechamento.destaques || fechamento.pontos_criticos || fechamento.plano_acao) && (
              <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {fechamento.destaques && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Destaques</p>
                    <p className="text-sm text-gray-300">{fechamento.destaques}</p>
                  </div>
                )}
                {fechamento.pontos_criticos && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Pontos Críticos</p>
                    <p className="text-sm text-gray-300">{fechamento.pontos_criticos}</p>
                  </div>
                )}
                {fechamento.plano_acao && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Plano de Ação</p>
                    <p className="text-sm text-gray-300">{fechamento.plano_acao}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {fechamentos.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum fechamento registrado</p>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir este fechamento? Esta ação não pode ser desfeita.
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