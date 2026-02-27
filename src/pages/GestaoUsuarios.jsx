import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pencil, Shield, UserX, Search, Loader2, Lock, Eye, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { MODULES, MODULE_LABELS, ROLE_PRESETS } from '@/components/moduleConstants';
import { getUserModulePermissions, resetToRolePreset } from '@/components/rbacHelpers';

export default function GestaoUsuarios() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [toggleConfirm, setToggleConfirm] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [userData, setUserData] = useState({});
  const [modulePerms, setModulePerms] = useState({});

  // Auth
  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Users
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  // Roles
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list(),
  });

  // User Module Permissions (quando abrir modal de permissões)
  const { data: userModulePerms } = useQuery({
    queryKey: ['userModulePermission', selectedUser?.email],
    queryFn: () =>
      selectedUser
        ? getUserModulePermissions(selectedUser.email, selectedUser.role)
        : Promise.resolve(null),
    enabled: !!selectedUser && permOpen,
  });

  useEffect(() => {
    if (userModulePerms) {
      setModulePerms(userModulePerms.modules || {});
    }
  }, [userModulePerms]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    return users
      .filter((u) => {
        const name = u.nome_customizado || u.full_name || u.email || '';
        const matchSearch = !s || name.toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s);
        const matchRole = filterRole === 'all' || u.role === filterRole;
        const matchStatus = filterStatus === 'all' || (u.status || 'active') === filterStatus;
        return matchSearch && matchRole && matchStatus;
      })
      .sort((a, b) => (a.nome_customizado || a.full_name || '').localeCompare(b.nome_customizado || b.full_name || ''));
  }, [users, searchTerm, filterRole, filterStatus]);

  // Mutations
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      const actor = await base44.auth.me();
      const oldData = users.find((u) => u.id === userId);
      await base44.entities.User.update(userId, data);

      // Se a função mudou, reseta automaticamente as permissões de módulo para o preset da nova função
      if (data.role && data.role !== oldData?.role) {
        await resetToRolePreset(oldData.email, data.role, actor.email);
        queryClient.invalidateQueries({ queryKey: ['userModulePermission', oldData.email] });
        queryClient.invalidateQueries({ queryKey: ['modulePermissions', oldData.email] });
      }

      await base44.entities.Log.create({
        usuario_email: actor.email,
        usuario_nome: actor.full_name,
        acao: 'Atualizou',
        entidade: 'User',
        detalhes: JSON.stringify({ antes: oldData, depois: data }),
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
    onSuccess: () => {
      toast.success('Usuário atualizado!');
      setEditUserOpen(false);
      setUserData({});
      setSelectedUser(null);
    },
    onError: (error) => toast.error('Erro: ' + error.message),
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, nextStatus }) => {
      const actor = await base44.auth.me();
      const target = users.find((u) => u.id === userId);
      await base44.entities.User.update(userId, { status: nextStatus });
      await base44.entities.Log.create({
        usuario_email: actor.email,
        usuario_nome: actor.full_name,
        acao: 'Atualizou',
        entidade: 'User',
        detalhes: `Alterou status de ${target?.email} para ${nextStatus}`,
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onSuccess: () => {
      toast.success('Status atualizado!');
      setToggleConfirm(null);
    },
    onError: (error) => toast.error('Erro: ' + error.message),
  });

  const updateModulePermsMutation = useMutation({
    mutationFn: async () => {
      const actor = await base44.auth.me();
      const existing = await base44.entities.UserModulePermission.filter({
        user_email: selectedUser.email,
      });

      if (existing.length > 0) {
        await base44.entities.UserModulePermission.update(existing[0].id, {
          modules: modulePerms,
          updated_by: actor.email,
        });
      } else {
        await base44.entities.UserModulePermission.create({
          user_email: selectedUser.email,
          modules: modulePerms,
          updated_by: actor.email,
        });
      }

      await base44.entities.Log.create({
        usuario_email: actor.email,
        usuario_nome: actor.full_name,
        acao: 'Atualizou',
        entidade: 'UserModulePermission',
        detalhes: `Alterou permissões de módulos para ${selectedUser.email}`,
      });

      queryClient.invalidateQueries({ queryKey: ['userModulePermission', selectedUser.email] });
    },
    onSuccess: () => {
      toast.success('Permissões de módulos salvas!');
      setPermOpen(false);
    },
    onError: (error) => toast.error('Erro: ' + error.message),
  });

  const resetToPresetMutation = useMutation({
    mutationFn: async () => {
      const actor = await base44.auth.me();
      const preset = await resetToRolePreset(selectedUser.email, selectedUser.role, actor.email);
      setModulePerms(preset);
      await base44.entities.Log.create({
        usuario_email: actor.email,
        usuario_nome: actor.full_name,
        acao: 'Atualizou',
        entidade: 'UserModulePermission',
        detalhes: `Resetou permissões de ${selectedUser.email} para preset de ${selectedUser.role}`,
      });
      queryClient.invalidateQueries({ queryKey: ['userModulePermission', selectedUser.email] });
    },
    onSuccess: () => {
      toast.success('Permissões resetadas para o preset da função!');
    },
    onError: (error) => toast.error('Erro: ' + error.message),
  });

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-white text-lg">Acesso restrito a Administradores</p>
      </div>
    );
  }

  const displayName = (u) => u?.nome_customizado || u?.full_name || u?.email || '-';
  const roleLabel = (roleKey) => roles.find((r) => r.key === roleKey)?.label || roleKey || '-';

  const openEditUser = (u) => {
    setSelectedUser(u);
    setUserData({
      nome_customizado: u?.nome_customizado || '',
      full_name: u?.full_name || '',
      role: u?.role || 'analyst',
    });
    setEditUserOpen(true);
  };

  const openPermissions = (u) => {
    setSelectedUser(u);
    setPermOpen(true);
  };

  const confirmToggle = (u) => {
    const nextStatus = (u.status || 'active') === 'active' ? 'inactive' : 'active';
    setToggleConfirm({ userId: u.id, email: u.email, nextStatus, name: displayName(u) });
  };

  const toggleModuleVisibility = (moduleKey, visible) => {
    setModulePerms((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        visible,
        ...(visible ? {} : { read: false, create: false, edit: false }),
      },
    }));
  };

  const toggleModuleAction = (moduleKey, action, value) => {
    setModulePerms((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [action]: value,
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Gestão de Usuários</h1>
        <p className="text-gray-400 mt-1">Gerencie usuários, funções, permissões e acesso a módulos</p>
      </div>

      {/* Filters */}
      <div className="bg-[#0d0d0d] rounded-xl border border-gray-800 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Buscar por nome/email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-[#1a1a1a] border-gray-700"
            />
          </div>

          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="bg-[#1a1a1a] border-gray-700">
              <SelectValue placeholder="Todas as funções" />
            </SelectTrigger>
            <SelectContent className="bg-[#242424] border-gray-700">
              <SelectItem value="all">Todas as funções</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="bg-[#1a1a1a] border-gray-700">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#242424] border-gray-700">
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0d0d0d] rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Total: <span className="text-white font-medium">{filteredUsers.length}</span>
          </div>
        </div>

        {loadingUsers ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6 text-center text-gray-400">Nenhum usuário encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#1a1a1a] border-b border-gray-800">
                <tr>
                  <th className="text-left font-semibold px-6 py-3 text-gray-400">Nome</th>
                  <th className="text-left font-semibold px-6 py-3 text-gray-400">E-mail</th>
                  <th className="text-left font-semibold px-6 py-3 text-gray-400">Função</th>
                  <th className="text-left font-semibold px-6 py-3 text-gray-400">Status</th>
                  <th className="text-right font-semibold px-6 py-3 text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{displayName(u)}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(u.status || 'active') === 'active' ? (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Ativo</span>
                      ) : (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">Inativo</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => openEditUser(u)}
                                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#1a1a1a] transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Editar dados</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => openPermissions(u)}
                                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#1a1a1a] transition-colors"
                              >
                                <Shield className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Permissões de módulos</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => confirmToggle(u)}
                                className={`p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors ${
                                  (u.status || 'active') === 'active'
                                    ? 'text-red-400 hover:text-red-300'
                                    : 'text-green-400 hover:text-green-300'
                                }`}
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {(u.status || 'active') === 'active' ? 'Desativar' : 'Reativar'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Edit User */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-400">Nome de exibição</Label>
                <Input
                  value={userData.nome_customizado || ''}
                  onChange={(e) => setUserData({ ...userData, nome_customizado: e.target.value })}
                  className="bg-[#1a1a1a] border-gray-700 mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-400">E-mail</Label>
                <Input value={selectedUser.email} disabled className="bg-[#1a1a1a] border-gray-700 mt-1 opacity-50" />
              </div>

              <div>
                <Label className="text-xs text-gray-400">Função</Label>
                <Select
                  value={userData.role || selectedUser.role}
                  onValueChange={(value) => setUserData({ ...userData, role: value })}
                >
                  <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#242424] border-gray-700">
                    {roles.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {userData.role && userData.role !== selectedUser.role && (
                  <p className="text-xs text-yellow-400 mt-1">
                    ⚠️ Ao salvar, as permissões de módulos serão redefinidas para o padrão da nova função.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" className="border-gray-700" onClick={() => setEditUserOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() =>
                    updateUserMutation.mutate({
                      userId: selectedUser.id,
                      data: { nome_customizado: userData.nome_customizado, role: userData.role },
                    })
                  }
                  disabled={updateUserMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Module Permissions */}
      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissões de Módulos — {selectedUser ? displayName(selectedUser) : ''}</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="flex gap-2">
                <Button
                  onClick={() => resetToPresetMutation.mutate()}
                  disabled={resetToPresetMutation.isPending}
                  variant="outline"
                  className="border-gray-700 gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Resetar para preset de {roleLabel(selectedUser.role)}
                </Button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {Object.keys(MODULES).map((moduleKeyUpper) => {
                  const moduleKey = MODULES[moduleKeyUpper];
                  const perms = modulePerms[moduleKey] || {
                    visible: false,
                    read: false,
                    create: false,
                    edit: false,
                  };

                  return (
                    <div key={moduleKey} className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={perms.visible}
                              onCheckedChange={(checked) => toggleModuleVisibility(moduleKey, checked)}
                              className="mt-1"
                            />
                            <div>
                              <label className="text-sm font-medium text-white cursor-pointer">
                                {MODULE_LABELS[moduleKey]}
                              </label>
                              <p className="text-xs text-gray-500 mt-0.5">Visível no menu</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {perms.visible && (
                        <div className="mt-3 ml-8 space-y-2 border-t border-gray-700 pt-3">
                          {['read', 'create', 'edit'].map((action) => (
                            <div key={action} className="flex items-center gap-2">
                              <Checkbox
                                checked={perms[action] || false}
                                onCheckedChange={(checked) => toggleModuleAction(moduleKey, action, checked)}
                              />
                              <label className="text-xs text-gray-300 cursor-pointer capitalize">{action}</label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
                <Button variant="outline" className="border-gray-700" onClick={() => setPermOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => updateModulePermsMutation.mutate()}
                  disabled={updateModulePermsMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Salvar Permissões
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm toggle status */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={() => setToggleConfirm(null)}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {toggleConfirm?.nextStatus === 'inactive' ? 'Desativar usuário' : 'Reativar usuário'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Você deseja {toggleConfirm?.nextStatus === 'inactive' ? 'desativar' : 'reativar'}{' '}
              <strong className="text-white">{toggleConfirm?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                toggleUserStatusMutation.mutate({
                  userId: toggleConfirm.userId,
                  nextStatus: toggleConfirm.nextStatus,
                })
              }
              className={toggleConfirm?.nextStatus === 'inactive' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
              disabled={toggleUserStatusMutation.isPending}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}