import React, { useState, useEffect } from 'react';
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
import { Plus, Search, Settings, Loader2, Trash2, Lock, LogOut, Eye, EyeOff, RefreshCw, History } from 'lucide-react';
import { toast } from 'sonner';
import PermissionGrid from '@/components/PermissionGrid';
import RoleEditor from '@/components/RoleEditor';

export default function GestaoUsuarios() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [showRoleEditor, setShowRoleEditor] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [userData, setUserData] = useState({});

  // Sincronizar recursos ao carregar
  useEffect(() => {
    const syncResources = async () => {
      try {
        await base44.functions.invoke('ensureResourceCatalog', {});
        queryClient.invalidateQueries({ queryKey: ['resources'] });
      } catch (error) {
        console.error('Erro ao sincronizar recursos:', error);
      }
    };
    syncResources();
  }, [queryClient]);

  // Validação de acesso
  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Listar usuários
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  // Listar recursos
  const { data: resources = [] } = useQuery({
    queryKey: ['resources'],
    queryFn: () => base44.entities.ResourceCatalog.list(),
  });

  // Listar roles
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list(),
  });

  // Carregar overrides do usuário selecionado
  const { data: userOverrides = [] } = useQuery({
    queryKey: ['userOverrides', selectedUser?.email],
    queryFn: () =>
      selectedUser
        ? base44.entities.UserPermissionOverride.filter({ user_email: selectedUser.email })
        : Promise.resolve([]),
    enabled: !!selectedUser,
  });

  // Carregar logs de auditoria
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs', selectedUser?.email],
    queryFn: () =>
      selectedUser
        ? base44.entities.Log.filter({ usuario_email: selectedUser.email })
        : Promise.resolve([]),
    enabled: !!selectedUser && showAuditLog,
  });

  // Mutation: Atualizar usuário
  const updateUserMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      const oldData = selectedUser;
      
      await base44.entities.User.update(selectedUser.id, data);
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'User',
        detalhes: JSON.stringify({ antes: oldData, depois: data }),
      });
      
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedUser({ ...selectedUser, ...data });
      toast.success('Usuário atualizado!');
    },
    onError: (error) => toast.error('Erro: ' + error.message),
  });

  // Mutation: Deletar usuário
  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      const user = await base44.auth.me();
      const targetUser = users.find(u => u.id === userId);
      
      await base44.entities.User.delete(userId);
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Removeu',
        entidade: 'User',
        detalhes: `Deletou usuário ${targetUser?.email}`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (selectedUser?.id === userId) setSelectedUser(null);
      toast.success('Usuário deletado!');
    },
    onError: (error) => toast.error('Erro: ' + error.message),
  });

  // Mutation: Resetar permissões
  const resetPermissionsMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      
      for (const override of userOverrides) {
        await base44.entities.UserPermissionOverride.delete(override.id);
      }
      
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Removeu',
        entidade: 'UserPermissionOverride',
        detalhes: `Resetou ${userOverrides.length} overrides do usuário ${selectedUser.email}`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['userOverrides'] });
      toast.success('Permissões resetadas!');
    },
    onError: (error) => toast.error('Erro: ' + error.message),
  });

  // Verificar acesso
  if (loadingUser) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#ADF802]" />
      </div>
    );
  }

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'supervisor') {
    return (
      <div className="text-center py-12">
        <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-white text-lg">Acesso restrito a Administradores</p>
      </div>
    );
  }

  // Filtrar usuários
  const filteredUsers = users.filter((u) => {
    const matchSearch = u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus = filterStatus === 'all' || (u.status || 'active') === filterStatus;
    const hasOverrides = userOverrides.length > 0;
    return matchSearch && matchRole && matchStatus;
  });

  const userModules = resources.reduce((acc, r) => {
    if (!acc[r.module]) acc[r.module] = [];
    acc[r.module].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestão de Usuários</h1>
          <p className="text-gray-400 mt-1">RBAC dinâmico e auditoria completa</p>
        </div>
        <Button
          onClick={() => setShowRoleEditor(true)}
          className="bg-[#ADF802] hover:bg-[#9DE002] text-black gap-2"
        >
          <Settings className="w-4 h-4" />
          Funções & Permissões
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6 h-[600px]">
        {/* Coluna A: Lista de Usuários */}
        <div className="bg-[#0a1628] rounded-xl border border-[#1e3a5f] flex flex-col">
          <div className="p-4 border-b border-[#1e3a5f] space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Buscar por nome/email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-[#0f1f35] border-[#1e3a5f]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="bg-[#0f1f35] border-[#1e3a5f] h-8">
                  <SelectValue />
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
                <SelectTrigger className="bg-[#0f1f35] border-[#1e3a5f] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a1628] border-[#1e3a5f]">
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingUsers ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-[#ADF802]" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-gray-400">Nenhum usuário encontrado</div>
            ) : (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full p-3 border-b border-[#1e3a5f]/30 text-left transition-colors ${
                    selectedUser?.id === user.id
                      ? 'bg-[#1e3a5f] border-l-4 border-l-[#ADF802]'
                      : 'hover:bg-[#0f1f35]'
                  }`}
                >
                  <div className="font-medium text-white text-sm">{user.full_name || user.email}</div>
                  <div className="text-xs text-gray-400 mt-1">{user.email}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                      {roles.find(r => r.key === user.role)?.label || user.role}
                    </span>
                    {(user.status || 'active') === 'inactive' && (
                      <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                        Inativo
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Coluna B: Perfil do Usuário */}
        {selectedUser ? (
          <div className="bg-[#0a1628] rounded-xl border border-[#1e3a5f] p-4 flex flex-col space-y-4">
            <h2 className="text-lg font-bold text-white">Perfil do Usuário</h2>

            <div className="space-y-3 flex-1 overflow-y-auto">
              <div>
                <Label className="text-xs text-gray-400">Nome Completo</Label>
                <Input
                  value={userData.full_name || selectedUser.full_name || ''}
                  onChange={(e) => setUserData({ ...userData, full_name: e.target.value })}
                  className="bg-[#0f1f35] border-[#1e3a5f] mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-400">E-mail</Label>
                <Input
                  value={selectedUser.email}
                  disabled
                  className="bg-[#0f1f35] border-[#1e3a5f] mt-1 opacity-60"
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

              <div>
                <Label className="text-xs text-gray-400">Status</Label>
                <Select
                  value={userData.status || selectedUser.status || 'active'}
                  onValueChange={(value) => setUserData({ ...userData, status: value })}
                >
                  <SelectTrigger className="bg-[#0f1f35] border-[#1e3a5f] mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a1628] border-[#1e3a5f]">
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-xs text-gray-500 bg-[#0f1f35] p-2 rounded">
                <p>Criado em: {new Date(selectedUser.created_date).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            <div className="space-y-2 border-t border-[#1e3a5f] pt-4">
              <Button
                onClick={() => updateUserMutation.mutate(userData)}
                disabled={updateUserMutation.isPending || Object.keys(userData).length === 0}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>

              <Button
                onClick={() => setShowAuditLog(true)}
                variant="outline"
                className="w-full border-[#1e3a5f]"
              >
                <History className="w-4 h-4 mr-2" />
                Ver Auditoria
              </Button>

              {userOverrides.length > 0 && (
                <Button
                  onClick={() => resetPermissionsMutation.mutate()}
                  variant="outline"
                  className="w-full border-orange-500/50 text-orange-400"
                  disabled={resetPermissionsMutation.isPending}
                >
                  {resetPermissionsMutation.isPending ? 'Resetando...' : 'Resetar Permissões'}
                </Button>
              )}

              <Button
                onClick={() => setDeleteConfirm(selectedUser.id)}
                variant="outline"
                className="w-full border-red-500/50 text-red-400"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Deletar Usuário
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-[#0a1628] rounded-xl border border-[#1e3a5f] flex items-center justify-center">
            <p className="text-gray-400">Selecione um usuário para editar</p>
          </div>
        )}

        {/* Coluna C: Permissões */}
        {selectedUser ? (
          <PermissionGrid
            user={selectedUser}
            resources={resources}
            userOverrides={userOverrides}
            roles={roles}
          />
        ) : (
          <div className="bg-[#0a1628] rounded-xl border border-[#1e3a5f] flex items-center justify-center">
            <p className="text-gray-400">Selecione um usuário para gerenciar permissões</p>
          </div>
        )}
      </div>

      {/* Role Editor Modal */}
      {showRoleEditor && (
        <RoleEditor
          isOpen={showRoleEditor}
          onClose={() => setShowRoleEditor(false)}
          resources={resources}
          roles={roles}
        />
      )}

      {/* Audit Log Modal */}
      <Dialog open={showAuditLog} onOpenChange={setShowAuditLog}>
        <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auditoria - {selectedUser?.full_name || selectedUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Nenhuma ação registrada</p>
            ) : (
              auditLogs.map((log, idx) => (
                <div key={idx} className="bg-[#0f1f35] p-3 rounded border border-[#1e3a5f]/30 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#ADF802]">{log.acao}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(log.created_date).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    Entidade: {log.entidade} | {log.detalhes}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-[#0a1628] border-[#1e3a5f]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Deletar Usuário</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja deletar <strong>{selectedUser?.full_name || selectedUser?.email}</strong>?
              <br />
              <br />
              Esta ação é <strong>irreversível</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#1e3a5f]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteUserMutation.mutate(deleteConfirm);
                setDeleteConfirm(null);
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? 'Deletando...' : 'Sim, Deletar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}