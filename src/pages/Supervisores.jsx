import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Pencil, Trash2, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Supervisores() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({ nome: '', equipe: '' });

  const { data: supervisores = [], isLoading } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Supervisor.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisores'] });
      toast.success('Supervisor criado com sucesso!');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supervisor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisores'] });
      toast.success('Supervisor atualizado com sucesso!');
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Supervisor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisores'] });
      toast.success('Supervisor excluído com sucesso!');
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setFormData({ nome: '', equipe: '' });
    setEditingSupervisor(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSupervisor) {
      updateMutation.mutate({ id: editingSupervisor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (supervisor) => {
    setEditingSupervisor(supervisor);
    setFormData({ nome: supervisor.nome, equipe: supervisor.equipe });
    setIsDialogOpen(true);
  };

  const getAnalistasCount = (supervisorId) => {
    return analistas.filter(a => a.supervisor_id === supervisorId).length;
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
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Supervisores</h1>
          <p className="text-gray-400 mt-1">Gerencie os supervisores do Suporte N1</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Plus className="w-4 h-4" />
              Novo Supervisor
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#242424] border-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>{editingSupervisor ? 'Editar Supervisor' : 'Novo Supervisor'}</DialogTitle>
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
                <Label htmlFor="equipe">Equipe</Label>
                <Input
                  id="equipe"
                  value={formData.equipe}
                  onChange={(e) => setFormData({ ...formData, equipe: e.target.value })}
                  className="bg-[#1a1a1a] border-gray-700 mt-2"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="border-gray-700">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                  {editingSupervisor ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {supervisores.map((supervisor) => (
          <div
            key={supervisor.id}
            className="bg-[#242424] rounded-2xl border border-gray-800 p-6 hover:border-emerald-500/30 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-emerald-400 font-bold text-lg">
                    {supervisor.nome.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-white">{supervisor.nome}</h3>
                  <p className="text-sm text-gray-400">{supervisor.equipe}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(supervisor)}
                  className="text-gray-400 hover:text-white"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(supervisor.id)}
                  className="text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-2 text-sm text-gray-400">
              <Users className="w-4 h-4" />
              <span>{getAnalistasCount(supervisor.id)} analistas</span>
            </div>
          </div>
        ))}
      </div>

      {supervisores.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum supervisor cadastrado</p>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir este supervisor? Esta ação não pode ser desfeita.
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