import React, { useEffect, useMemo, useState } from 'react';
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
import { Search, Settings, Loader2, Lock, Pencil, Shield, UserX, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import PermissionGrid from '@/components/PermissionGrid';
import RoleEditor from '@/components/RoleEditor';

export default function GestaoUsuarios() {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');

  const [showRoleEditor, setShowRoleEditor] = useState(false);

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [toggleConfirm, setToggleConfirm] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [userData, setUserData] = useState({});

  // Sync Resource Catalog (auto)
  useEffect(() => {
    const syncResources = async () => {
      try {
        await base44.asServiceRole.functions.invoke('ensureResourceCatalog', {});
      } catch (error) {
        console.error('Erro ao sincronizar recursos:', error);
      } finally {
        queryClient.invalidateQueries({ queryKey: ['resources'] });
      }
    };
    syncResources();
  }, [queryClient]);

  // Auth
  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Users / Roles / Resources
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list(),
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['resources'],
    queryFn: () => base44.entities.ResourceCatalog.list(),
  });

  // Overrides for selected user (only when permission modal open)
  const { data: userOverrides = [] } = useQuery({
    queryKey: ['userOverrides', selectedUser?.email],
    queryFn: () =>
      selectedUser
        ? base44.entities.UserPermissionOverride.filter({ user_email: selectedUser.email })
        : Promise.resolve([]),
    enabled: !!selectedUser && permOpen,
  });

  // Access check
  if (loadingUser) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#ADF802]" />
      </div>
    );
  }

  // 👉 Se quiser somente coordenador, troca aqui para: currentUser?.role !== 'admin'
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'supervisor') {
    return (
      <div className="text-center py-12">
        <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-white text-lg">Acesso restrito a Administradores</p>
      </div>
    );
  }

  const roleLabel = (roleKey) =>
    roles.find((r) => r.key === roleKey)?.label || roleKey || '-';

  const displayName = (u) =>
    u?.nome_customizado || u?.full_name || u?.email || '-';

  const statusValue = (u) => (u?.status || 'active');

  // Filtered list
  const filteredUsers = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    return users
      .filter((u) => {
        const matchSearch =
          !s ||
          displayName(u).toLowerCase().includes(s) ||
          (u.email || '').toLowerCase().includes(s);

        const matchRole = filterRole === 'all' || u.role === filterRole;

        const matchStatus =
          filterStatus === 'all' || statusValue(u) === filterStatus;

        return matchSearch && matchRole && matchStatus;
      })
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [users, searchTerm, filterRole, filterStatus]);

  // Mutations
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      const actor = await base44.auth.me();
      const oldData = users.find((u) => u.id === userId);

      await base44.entities.User.update(userId, data);

      await base44.entities.Log.create({
        usuario_email: actor.email,
        usuario_nome: actor.full_name,
        acao: 'Atualizou',
        entidade: 'User',
        detalhes: JSON.stringify({ antes: oldData, depois: data }),
      });

      queryClient.invalidateQueries({ queryKey: ['users'] });
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

  // Handlers
  const openEditUser = (u) => {
    setSelectedUser(u);
    setUserData({
      nome_customizado: u?.nome_customizado || '',
      full_name: u?.full_name || '',
      role: u?.role || '',
      status: statusValue(u),
      telefone: u?.telefone || '',
    });
    setEditUserOpen(true);
  };

  const openPermissions = (u) => {
    setSelectedUser(u);
    setPermOpen(true);
  };

  const confirmToggle = (u) => {
    const nextStatus = statusValue(u) === 'active' ? 'inactive' : 'active';
    setToggleConfirm({ userId: u.id, email: u.email, nextStatus, name: displayName(u) });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestão de Usuários</h1>
          <p className="text-gray-400 mt-1">
            Lista completa de usuários + edição de dados + permissões + desativação
          </p>
        </div>

        <Button
          onClick={() => setShowRoleEditor(true)}
          className="bg-[#ADF802] hover:bg-[#9DE002] text-black gap-2"
        >
          <Settings className="w-4 h-4" />
          Funções & Permissões
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-[#0a1628] rounded-xl border border-[#1e3a5f] p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Buscar por nome/email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-[#0f1f35] border-[#1e3a5f]"
            />
          </div>

          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="bg-[#0f1f35] border-[#1e3a5f]">
              <SelectValue placeholder="Todas as funções" />
            </SelectTrigger>
            <SelectContent className="bg-[#0a1628] border-[#1e3a5f]">
              <SelectItem value="all">Todas as funções</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="bg-[#0f1f35] border-[#1e3a5f]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#0a1628] border-[#1e3a5f]">
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0a1628] rounded-xl border border-[#1e3a5f] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e3a5f] flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Total: <span className="text-white font-medium">{filteredUsers.length}</span>
          </div>
        </div>

        {loadingUsers ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#ADF802]" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6 text-center text-gray-400">Nenhum usuário encontrado</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0f1f35] text-gray-300">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Nome completo</th>
                  <th className="text-left font-semibold px-4 py-3">E-mail</th>
                  <th className="text-left font-semibold px-4 py-3">Função</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-right font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const status = statusValue(u);
                  return (
                    <tr key={u.id} className="border-t border-[#1e3a5f]/40 hover:bg-[#0f1f35]/40">
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{displayName(u)}</div>
                        {/* opcional: mostrar full_name vs nome_customizado */}
                        {u?.nome_customizado && u?.full_name && u.nome_customizado !== u.full_name && (
                          <div className="text-xs text-gray-500">Legal: {u.full_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                          {roleLabel(u.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {status === 'active' ? (
                          <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            className="border-[#1e3a5f] text-white"
                            onClick={() => openEditUser(u)}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar dados
                          </Button>

                          <Button
                            variant="outline"
                            className="border-[#1e3a5f] text-white"
                            onClick={() => openPermissions(u)}
                          >
                            <Shield className="w-4 h-4 mr-2" />
                            Permissões
                          </Button>

                          <Button
                            variant="outline"
                            className={
                              status === 'active'
                                ? 'border-red-500/50 text-red-300'
                                : 'border-green-500/50 text-green-300'
                            }
                            onClick={() => confirmToggle(u)}
                          >
                            {status === 'active' ? (
                              <>
                                <UserX className="w-4 h-4 mr-2" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4 mr-2" />
                                Reativar
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Edit User Data */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>

          {!selectedUser ? (
            <p className="text-gray-400">Nenhum usuário selecionado.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-400">Nome de exibição</Label>
                <Input
                  value={userData.nome_customizado || ''}
                  onChange={(e) => setUserData({ ...userData, nome_customizado: e.target.value })}
                  className="bg-[#0f1f35] border-[#1e3a5f] mt-1"
                  placeholder="Ex.: Carlos Bongiovani"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-400">Nome completo (cadastro)</Label>
                <Input
                  value={userData.full_name || ''}
                  onChange={(e) => setUserData({ ...userData, full_name: e.target.value })}
                  className="bg-[#0f1f35] border-[#1e3a5f] mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-400">E-mail (signup)</Label>
                <Input
                  value={selectedUser.email}
                  disabled
                  className="bg-[#0f1f35] border-[#1e3a5f] mt-1 opacity-60"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-400">Telefone</Label>
                <Input
                  value={userData.telefone || ''}
                  onChange={(e) => setUserData({ ...userData, telefone: e.target.value })}
                  className="bg-[#0f1f35] border-[#1e3a5f] mt-1"
                  placeholder="(xx) xxxxx-xxxx"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-400">Função</Label>
                <Select
                  value={userData.role || selectedUser.role}
                  onValueChange={(value) => setUserData({ ...userData, role: value })}
                >
                  <SelectTrigger className="bg-[#0f1f35] border-[#1e3a5f] mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a1628] border-[#1e3a5f]">
                    {roles.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  className="border-[#1e3a5f]"
                  onClick={() => setEditUserOpen(false)}
                >
                  Cancelar
                </Button>

                <Button
                  onClick={() =>
                    updateUserMutation.mutate({
                      userId: selectedUser.id,
                      data: {
                        // manda só campos editáveis
                        nome_customizado: userData.nome_customizado,
                        full_name: userData.full_name,
                        telefone: userData.telefone,
                        role: userData.role,
                      },
                    })
                  }
                  disabled={updateUserMutation.isPending}
                  className="bg-[#ADF802] hover:bg-[#9DE002] text-black"
                >
                  {updateUserMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Permissions */}
      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissões — {selectedUser ? displayName(selectedUser) : ''}</DialogTitle>
          </DialogHeader>

          {!selectedUser ? (
            <p className="text-gray-400">Nenhum usuário selecionado.</p>
          ) : (
            <PermissionGrid
              user={selectedUser}
              resources={resources}
              userOverrides={userOverrides}
              roles={roles}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Role Editor */}
      {showRoleEditor && (
        <RoleEditor
          isOpen={showRoleEditor}
          onClose={() => setShowRoleEditor(false)}
          resources={resources}
          roles={roles}
        />
      )}

      {/* Confirm deactivate/reactivate */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={() => setToggleConfirm(null)}>
        <AlertDialogContent className="bg-[#0a1628] border-[#1e3a5f]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {toggleConfirm?.nextStatus === 'inactive' ? 'Desativar usuário' : 'Reativar usuário'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Você deseja {toggleConfirm?.nextStatus === 'inactive' ? 'desativar' : 'reativar'}{' '}
              <strong className="text-white">{toggleConfirm?.name}</strong> ({toggleConfirm?.email})?
              <br />
              <br />
              Isso mantém auditoria/compliance e impede acesso quando inativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#1e3a5f]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toggleUserStatusMutation.mutate({
                  userId: toggleConfirm.userId,
                  nextStatus: toggleConfirm.nextStatus,
                });
              }}
              className={toggleConfirm?.nextStatus === 'inactive' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
              disabled={toggleUserStatusMutation.isPending}
            >
              {toggleUserStatusMutation.isPending ? 'Processando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}