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
import { Plus, Pencil, Settings, Loader2, Mail, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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

export default function GestaoUsuarios() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [editingUser, setEditingUser] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', role: 'user' });
  const [formData, setFormData] = useState({ full_name: '', role: '' });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário atualizado com sucesso!');
      resetForm();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: ({ email, role }) => base44.users.inviteUser(email, role),
    onSuccess: () => {
      toast.success('Convite enviado com sucesso!');
      setInviteData({ email: '', role: 'user' });
      setIsInviteDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Erro ao enviar convite: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário deletado com sucesso!');
      setDeleteUserOpen(false);
      setUserToDelete(null);
    },
    onError: (error) => {
      toast.error('Erro ao deletar usuário: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({ full_name: '', role: '' });
    setEditingUser(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editingUser) return;
    updateMutation.mutate({ id: editingUser.id, data: formData });
  };

  const handleInvite = (e) => {
    e.preventDefault();
    inviteMutation.mutate(inviteData);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setFormData({ 
      full_name: user.full_name || '',
      role: user.role || 'user'
    });
    setIsDialogOpen(true);
  };

  const getRoleBadge = (role) => {
    const colors = {
      admin: 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30',
      supervisor: 'bg-[#ADF802]/20 text-[#ADF802] border-[#ADF802]/30',
      user: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return colors[role] || colors.user;
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Coordenador',
      supervisor: 'Supervisor',
      user: 'Usuário',
    };
    return labels[role] || role;
  };

  const handleDeleteAccount = async () => {
    try {
      const user = await base44.auth.me();
      await base44.entities.User.delete(user.id);
      base44.auth.logout();
    } catch (error) {
      toast.error('Erro ao deletar conta: ' + error.message);
    }
  };

  const handleDeleteUser = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
    }
  };

  const openDeleteDialog = (user) => {
    setUserToDelete(user);
    setDeleteUserOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#e74c3c]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Gestão de Usuários</h1>
          <p className="text-gray-400 mt-1">Gerencie acesso e permissões do sistema</p>
        </div>
        
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#e74c3c] hover:bg-[#c0392b] gap-2">
              <Plus className="w-4 h-4" />
              Convidar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white">
            <DialogHeader>
              <DialogTitle>Convidar Novo Usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                  className="bg-[#0f1f35] border-[#1e3a5f] mt-2"
                  placeholder="usuario@grupoavenida.com.br"
                  required
                />
              </div>
              <div>
                <Label htmlFor="role">Função</Label>
                <Select
                  value={inviteData.role}
                  onValueChange={(value) => setInviteData({ ...inviteData, role: value })}
                >
                  <SelectTrigger className="bg-[#0f1f35] border-[#1e3a5f] mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a1628] border-[#1e3a5f]">
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Coordenador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsInviteDialogOpen(false)} 
                  className="border-[#1e3a5f]"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-[#e74c3c] hover:bg-[#c0392b]"
                  disabled={inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? 'Enviando...' : 'Enviar Convite'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-[#1e3a5f] bg-[#0f1f35]">
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">E-mail</th>
                <th className="px-6 py-4 font-medium">Função</th>
                <th className="px-6 py-4 font-medium">Data de Criação</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[#1e3a5f]/50 hover:bg-[#1e3a5f]/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#e74c3c]/20 flex items-center justify-center">
                        <span className="text-[#e74c3c] font-bold">
                          {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-white font-medium">{user.full_name || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadge(user.role)}`}>
                      <Shield className="w-3 h-3" />
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {new Date(user.created_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(user)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(user)}
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

      {users.length === 0 && (
        <div className="text-center py-12">
          <Settings className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum usuário cadastrado</p>
        </div>
      )}

      {/* Gerenciar Conta */}
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Gerenciar Conta
        </h2>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Zona de Perigo
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                Ações irreversíveis que afetam permanentemente sua conta.
              </p>
            </div>
            <Button
              onClick={() => setDeleteAccountOpen(true)}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300 min-h-[44px]"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Deletar Minha Conta
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
        <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="full_name">Nome Completo</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="bg-[#0f1f35] border-[#1e3a5f] mt-2"
              />
            </div>
            <div>
              <Label htmlFor="edit_role">Função</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="bg-[#0f1f35] border-[#1e3a5f] mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a1628] border-[#1e3a5f]">
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="admin">Coordenador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={resetForm} className="border-[#1e3a5f]">
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#e74c3c] hover:bg-[#c0392b]">
                Atualizar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent className="bg-[#0a1628] border-[#1e3a5f]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Deletar Conta Permanentemente</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Esta ação é <strong className="text-red-400">irreversível</strong>. Todos os seus dados, configurações e histórico serão permanentemente removidos do sistema. 
              Você será desconectado imediatamente após a exclusão.
              <br /><br />
              Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#1e3a5f]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              Sim, Deletar Minha Conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
        <AlertDialogContent className="bg-[#0a1628] border-[#1e3a5f]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Deletar Usuário</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja deletar o usuário <strong className="text-white">{userToDelete?.full_name || userToDelete?.email}</strong>?
              <br /><br />
              Esta ação é <strong className="text-red-400">irreversível</strong> e todos os dados do usuário serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#1e3a5f]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deletando...' : 'Sim, Deletar Usuário'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}