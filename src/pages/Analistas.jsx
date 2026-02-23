import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Pencil, Trash2, UserCircle, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import PerformanceBadge from '@/components/ui/PerformanceBadge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Analistas() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnalista, setEditingAnalista] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({ nome: '', supervisor_id: '' });

  const { data: analistas = [], isLoading } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ['atividades'],
    queryFn: () => base44.entities.Atividade.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Analista.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analistas'] });
      toast.success('Analista criado com sucesso!');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Analista.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analistas'] });
      toast.success('Analista atualizado com sucesso!');
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Analista.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analistas'] });
      toast.success('Analista excluído com sucesso!');
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setFormData({ nome: '', supervisor_id: '' });
    setEditingAnalista(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingAnalista) {
      updateMutation.mutate({ id: editingAnalista.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (analista) => {
    setEditingAnalista(analista);
    setFormData({ nome: analista.nome, supervisor_id: analista.supervisor_id });
    setIsDialogOpen(true);
  };

  const getSupervisorNome = (id) => {
    const sup = supervisores.find(s => s.id === id);
    return sup?.nome || '-';
  };

  const getMediaAnalista = (analistaId) => {
    const atividadesAn = atividades.filter(a => a.analista_id === analistaId);
    if (atividadesAn.length === 0) return null;
    return atividadesAn.reduce((sum, a) => sum + (a.nota || 0), 0) / atividadesAn.length;
  };

  const getTotalAtividades = (analistaId) => {
    return atividades.filter(a => a.analista_id === analistaId).length;
  };

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
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Analistas</h1>
          <p className="text-gray-400 mt-1">Gerencie os analistas do Suporte N1</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Plus className="w-4 h-4" />
              Novo Analista
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#242424] border-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>{editingAnalista ? 'Editar Analista' : 'Novo Analista'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="bg-[#1a1a1a] border-gray-700 mt-2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="supervisor">Supervisor</Label>
                <Select
                  value={formData.supervisor_id}
                  onValueChange={(value) => setFormData({ ...formData, supervisor_id: value })}
                >
                  <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                    <SelectValue placeholder="Selecione um supervisor" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#242424] border-gray-700">
                    {supervisores.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="border-gray-700">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                  {editingAnalista ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-[#242424] rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-800 bg-[#1a1a1a]">
                <th className="px-6 py-4 font-medium">Analista</th>
                <th className="px-6 py-4 font-medium">Supervisor</th>
                <th className="px-6 py-4 font-medium">Atividades</th>
                <th className="px-6 py-4 font-medium">Média</th>
                <th className="px-6 py-4 font-medium">Classificação</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {analistas.map((analista) => {
                const media = getMediaAnalista(analista.id);
                return (
                  <tr key={analista.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                          <span className="text-blue-400 font-bold">
                            {analista.nome.charAt(0)}
                          </span>
                        </div>
                        <span className="text-white font-medium">{analista.nome}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {getSupervisorNome(analista.supervisor_id)}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {getTotalAtividades(analista.id)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white font-semibold">
                        {media !== null ? media.toFixed(1) : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {media !== null ? <PerformanceBadge media={media} /> : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <Link to={createPageUrl(`PerfilAnalista?id=${analista.id}`)}>
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-emerald-400">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(analista)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(analista.id)}
                          className="text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {analistas.length === 0 && (
        <div className="text-center py-12">
          <UserCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum analista cadastrado</p>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir este analista? Esta ação não pode ser desfeita.
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