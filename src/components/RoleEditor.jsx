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
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RoleEditor({ isOpen, onClose, resources, roles }) {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(roles[0]?.key || '');
  const [newRoleName, setNewRoleName] = useState('');
  const [saving, setSaving] = useState({});

  const resourcesByModule = resources.reduce((acc, r) => {
    if (!acc[r.module]) acc[r.module] = [];
    acc[r.module].push(r);
    return acc;
  }, {});

  // Carregar permissões da role
  const { data: rolePermissions = [] } = useQuery({
    queryKey: ['rolePermissionsEditor', selectedRole],
    queryFn: () =>
      selectedRole ? base44.entities.RolePermission.filter({ role_key: selectedRole }) : Promise.resolve([]),
    enabled: !!selectedRole && isOpen,
  });

  const getPermission = (resourceKey, action) => {
    const perm = rolePermissions.find(
      (rp) => rp.resource_key === resourceKey && rp.action === action
    );
    return perm ? perm.allowed : false;
  };

  const updateRolePermissionMutation = useMutation({
    mutationFn: async ({ resourceKey, action, allowed }) => {
      const user = await base44.auth.me();
      const existing = rolePermissions.find(
        (rp) => rp.resource_key === resourceKey && rp.action === action
      );

      if (existing) {
        await base44.entities.RolePermission.update(existing.id, { allowed });
      } else {
        await base44.entities.RolePermission.create({
          role_key: selectedRole,
          resource_key: resourceKey,
          action,
          allowed,
        });
      }

      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'RolePermission',
        detalhes: `Role ${selectedRole}: ${resourceKey}/${action} = ${allowed ? 'SIM' : 'NÃO'}`,
      });

      queryClient.invalidateQueries({ queryKey: ['rolePermissionsEditor'] });
    },
    onError: (error) => toast.error('Erro: ' + error.message),
  });

  const handlePermissionChange = async (resourceKey, action, allowed) => {
    setSaving((prev) => ({ ...prev, [`${resourceKey}_${action}`]: true }));
    try {
      await updateRolePermissionMutation.mutateAsync({
        resourceKey,
        action,
        allowed,
      });
    } finally {
      setSaving((prev) => ({ ...prev, [`${resourceKey}_${action}`]: false }));
    }
  };

  const createRoleMutation = useMutation({
    mutationFn: async () => {
      if (!newRoleName.trim()) {
        toast.error('Nome da função obrigatório');
        return;
      }

      const user = await base44.auth.me();
      const newRole = await base44.entities.Role.create({
        key: newRoleName.toLowerCase().replace(/\s/g, '_'),
        label: newRoleName,
        badge_color: 'blue',
        is_system: false,
        display_order: roles.length + 1,
      });

      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Criou',
        entidade: 'Role',
        detalhes: `Função: ${newRoleName}`,
      });

      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setNewRoleName('');
      setSelectedRole(newRole.key);
      toast.success('Função criada!');
    },
    onError: (error) => toast.error('Erro: ' + error.message),
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Funções e Permissões</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6">
          {/* Coluna 1: Lista de Funções */}
          <div className="space-y-3">
            <h3 className="font-semibold text-[#ADF802]">Funções do Sistema</h3>

            <div className="space-y-2">
              {roles.map((role) => (
                <button
                  key={role.key}
                  onClick={() => setSelectedRole(role.key)}
                  className={`w-full text-left p-2 rounded text-sm ${
                    selectedRole === role.key
                      ? 'bg-[#1e3a5f] border-l-4 border-l-[#ADF802]'
                      : 'bg-[#0f1f35] hover:bg-[#1e3a5f]'
                  }`}
                >
                  {role.label}
                  {role.is_system && (
                    <span className="text-xs text-gray-500 ml-2">(Sistema)</span>
                  )}
                </button>
              ))}
            </div>

            {/* Criar função */}
            <div className="border-t border-[#1e3a5f] pt-3">
              <Input
                placeholder="Nova função"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="bg-[#0f1f35] border-[#1e3a5f] text-sm"
              />
              <Button
                onClick={() => createRoleMutation.mutate()}
                disabled={createRoleMutation.isPending}
                className="w-full mt-2 bg-green-600 hover:bg-green-700 h-8 text-sm"
              >
                <Plus className="w-3 h-3 mr-1" />
                {createRoleMutation.isPending ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </div>

          {/* Coluna 2-3: Permissões */}
          {selectedRole && (
            <div className="col-span-2 space-y-3">
              <h3 className="font-semibold text-[#ADF802]">
                Permissões - {roles.find(r => r.key === selectedRole)?.label}
              </h3>

              <div className="space-y-3 bg-[#0f1f35] rounded-lg p-3 border border-[#1e3a5f]/30">
                {Object.entries(resourcesByModule).map(([module, moduleResources]) => (
                  <div key={module}>
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">{module}</h4>

                    <div className="space-y-1.5 pl-2">
                      {moduleResources.map((resource) => (
                        <div key={resource.key}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-300">{resource.label}</span>
                          </div>

                          <div className="flex gap-1 flex-wrap">
                            {['view', ...resource.actions.filter(a => a !== 'view')].map((action) => (
                              <button
                                key={action}
                                onClick={() =>
                                  handlePermissionChange(
                                    resource.key,
                                    action,
                                    !getPermission(resource.key, action)
                                  )
                                }
                                disabled={saving[`${resource.key}_${action}`]}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                  getPermission(resource.key, action)
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-700 text-gray-300'
                                }`}
                              >
                                {saving[`${resource.key}_${action}`] ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  action.charAt(0).toUpperCase() + action.slice(1)
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-[#1e3a5f]">
          <Button onClick={onClose} variant="outline" className="border-[#1e3a5f]">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}