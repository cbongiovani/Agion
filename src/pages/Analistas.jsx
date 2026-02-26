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
    queryFn: async () => {
      const todasAtividades = await base44.entities.Atividade.list();
      const todasAprovacoes = await base44.entities.AprovacaoAtividade.list();
      
      const aprovacaoPorId = {};
      todasAprovacoes.forEach((aprov) => {
        if (aprov.tipo === 'atividade') {
          aprovacaoPorId[aprov.atividade_id] = aprov;
        }
      });
      
      // Retornar apenas atividades aprovadas
      return todasAtividades.filter(ativ => 
        aprovacaoPorId[ativ.id]?.status === 'aprovado'
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.Analista.create(data);
      const user = await base44.auth.me();
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Criou',
        entidade: 'Analista',
        detalhes: `Criou analista "${data.nome}"`,
      });
      return result;
    },
    onMutate: async (newAnalista) => {
      await queryClient.cancelQueries({ queryKey: ['analistas'] });
      const previousAnalistas = queryClient.getQueryData(['analistas']);
      queryClient.setQueryData(['analistas'], (old = []) => [
        ...old,
        { ...newAnalista, id: `temp-${Date.now()}` }
      ]);
      return { previousAnalistas };
    },
    onError: (err, newAnalista, context) => {
      queryClient.setQueryData(['analistas'], context.previousAnalistas);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analistas'] });
      toast.success('Analista criado com sucesso!');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const result = await base44.entities.Analista.update(id, data);

      // Se houver um email vinculado e o nome foi alterado, atualizar o usuário
      if (data.usuario_email) {
        const users = await base44.entities.User.filter({ email: data.usuario_email });
        if (users.length > 0) {
          await base44.entities.User.update(users[0].id, { full_name: data.nome });
        }
      }

      const user = await base44.auth.me();
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'Analista',
        detalhes: `Atualizou analista "${data.nome}"`,
      });
      return result;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['analistas'] });
      const previousAnalistas = queryClient.getQueryData(['analistas']);
      queryClient.setQueryData(['analistas'], (old = []) =>
        old.map((analista) => (analista.id === id ? { ...analista, ...data } : analista))
      );
      return { previousAnalistas };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['analistas'], context.previousAnalistas);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analistas'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Analista atualizado com sucesso!');
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const user = await base44.auth.me();
      await base44.entities.Analista.delete(id);
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Excluiu',
        entidade: 'Analista',
        detalhes: `Excluiu um analista`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analistas'] });
      toast.success('Analista excluído com sucesso!');
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setFormData({ nome: '', supervisor_id: '', usuario_email: '' });
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
    setFormData({ 
      nome: analista.nome, 
      supervisor_id: analista.supervisor_id,
      usuario_email: analista.usuario_email || ''
    });
    setIsDialogOpen(true);
  };

  const getSupervisorNome = (id) => {
    const sup = supervisores.find(s => s.id === id);
    return sup?.nome || '-';
  };

  const getMediaAnalista = (analistaId) => {
    const atividadesAn = atividades.filter((a) => a.analista_id === analistaId);
    if (atividadesAn.length === 0) return null;
    return atividadesAn.reduce((sum, a) => sum + (a.nota || 0), 0) / atividadesAn.length;
  };

  const getTotalAtividades = (analistaId) => {
    return atividades.filter((a) => a.analista_id === analistaId).length;
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
          <p className="text-gray-400 mt-1">Visualização dos analistas do Suporte N1</p>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-[#242424] rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-800 bg-[#1a1a1a]">
                <th className="px-6 py-4 font-medium">Analista</th>
                <th className="px-6 py-4 font-medium">E-mail Vinculado</th>
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
                      {analista.usuario_email || '-'}
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
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-emerald-400 min-w-[44px] min-h-[44px]">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="lg:hidden space-y-4">
        {analistas.map((analista) => {
          const media = getMediaAnalista(analista.id);
          return (
            <div key={analista.id} className="bg-[#242424] rounded-2xl border border-gray-800 p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-400 font-bold text-lg">
                      {analista.nome.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{analista.nome}</h3>
                    <p className="text-xs text-gray-500">{analista.usuario_email || 'Sem e-mail vinculado'}</p>
                    <p className="text-sm text-gray-400">{getSupervisorNome(analista.supervisor_id)}</p>
                  </div>
                </div>
                {media !== null && <PerformanceBadge media={media} />}
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#1a1a1a] rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Atividades</p>
                  <p className="text-lg font-semibold text-white">{getTotalAtividades(analista.id)}</p>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Média</p>
                  <p className="text-lg font-semibold text-white">
                    {media !== null ? media.toFixed(1) : '-'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Link to={createPageUrl(`PerfilAnalista?id=${analista.id}`)} className="flex-1">
                  <Button variant="outline" className="w-full border-gray-700 gap-2 min-h-[44px]">
                    <Eye className="w-4 h-4" />
                    Ver Perfil
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
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