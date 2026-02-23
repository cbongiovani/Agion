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
import { Plus, Pencil, Trash2, ClipboardList, Loader2, Filter, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import NotaBadge from '@/components/ui/NotaBadge';
import AtividadeInfoTooltip from '@/components/AtividadeInfoTooltip';

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
    supervisor_id: '',
    analista_id: '',
    tipo: '',
    nota: '',
    comentario: '',
    status: 'Aberto',
  });

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

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Atividade.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade criada com sucesso!');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Atividade.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade atualizada com sucesso!');
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Atividade.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade excluída com sucesso!');
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setFormData({
      data: format(new Date(), 'yyyy-MM-dd'),
      supervisor_id: '',
      analista_id: '',
      tipo: '',
      nota: '',
      comentario: '',
      status: 'Aberto',
    });
    setEditingAtividade(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nota = parseFloat(formData.nota);
    if (nota < 0 || nota > 10) {
      toast.error('A nota deve estar entre 0 e 10');
      return;
    }
    const payload = { ...formData, nota };
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
      supervisor_id: atividade.supervisor_id,
      analista_id: atividade.analista_id,
      tipo: atividade.tipo,
      nota: atividade.nota?.toString() || '',
      comentario: atividade.comentario || '',
      status: atividade.status || 'Aberto',
    });
    setIsDialogOpen(true);
  };

  const getSupervisorNome = (id) => supervisores.find(s => s.id === id)?.nome || '-';
  const getAnalistaNome = (id) => analistas.find(a => a.id === id)?.nome || '-';

  const filteredAnalistas = filters.supervisor_id
    ? analistas.filter(a => a.supervisor_id === filters.supervisor_id)
    : analistas;

  const formFilteredAnalistas = formData.supervisor_id
    ? analistas.filter(a => a.supervisor_id === formData.supervisor_id)
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
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Plus className="w-4 h-4" />
              Nova Atividade
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-lg">
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
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Supervisor</Label>
                  <Select
                    value={formData.supervisor_id}
                    onValueChange={(value) => setFormData({ ...formData, supervisor_id: value, analista_id: '' })}
                  >
                    <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#242424] border-gray-700">
                      {supervisores.map((sup) => (
                        <SelectItem key={sup.id} value={sup.id}>{sup.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Analista</Label>
                  <Select
                    value={formData.analista_id}
                    onValueChange={(value) => setFormData({ ...formData, analista_id: value })}
                  >
                    <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#242424] border-gray-700">
                      {formFilteredAnalistas.map((an) => (
                        <SelectItem key={an.id} value={an.id}>{an.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
            className="bg-[#1a1a1a] border-gray-700"
            placeholder="Data início"
          />
          <Input
            type="date"
            value={filters.dataFim}
            onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
            className="bg-[#1a1a1a] border-gray-700"
            placeholder="Data fim"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-[#242424] rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-800 bg-[#1a1a1a]">
                <th className="px-6 py-4 font-medium">Data</th>
                <th className="px-6 py-4 font-medium">Tipo</th>
                <th className="px-6 py-4 font-medium">Supervisor</th>
                <th className="px-6 py-4 font-medium">Analista</th>
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
                  <td className="px-6 py-4">
                    <NotaBadge nota={atividade.nota} />
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
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
                        onClick={() => openEdit(atividade)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(atividade.id)}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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