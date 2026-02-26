import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PermissionsManager({ user, onClose }) {
  const queryClient = useQueryClient();
  const [permissionsData, setPermissionsData] = useState({});
  const [rolPermissions, setRolPermissions] = useState({});

  const { data: resources = [] } = useQuery({
    queryKey: ['resources'],
    queryFn: () => base44.entities.ResourceCatalog.list(),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list(),
  });

  const { data: userOverrides = [] } = useQuery({
    queryKey: ['userOverrides', user?.email],
    queryFn: () => base44.entities.UserPermissionOverride.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  // Carregar permissões da role do usuário
  useEffect(() => {
    if (user?.role && resources.length > 0) {
      loadRolePermissions(user.role);
    }
  }, [user?.role, resources]);

  // Carregar overrides do usuário
  useEffect(() => {
    if (userOverrides.length > 0 && resources.length > 0) {
      const overridesData = {};
      userOverrides.forEach((override) => {
        if (!overridesData[override.resource_key]) {
          overridesData[override.resource_key] = {};
        }
        overridesData[override.resource_key][override.action] = override.allowed;
      });
      setPermissionsData(overridesData);
    }
  }, [userOverrides, resources]);

  const loadRolePermissions = async (roleKey) => {
    try {
      const perms = await base44.entities.RolePermission.filter({ role_key: roleKey });
      const permsData = {};
      perms.forEach((perm) => {
        if (!permsData[perm.resource_key]) {
          permsData[perm.resource_key] = {};
        }
        permsData[perm.resource_key][perm.action] = perm.allowed;
      });
      setRolPermissions(permsData);
    } catch (error) {
      console.error('Erro ao carregar permissões da role:', error);
    }
  };

  const saveOverrideMutation = useMutation({
    mutationFn: async (overrides) => {
      const user = await base44.auth.me();
      
      for (const [resourceKey, actions] of Object.entries(overrides)) {
        for (const [action, allowed] of Object.entries(actions)) {
          const existing = userOverrides.find(
            (o) => o.resource_key === resourceKey && o.action === action
          );

          if (existing) {
            await base44.entities.UserPermissionOverride.update(existing.id, { allowed });
          } else {
            await base44.entities.UserPermissionOverride.create({
              user_email: user.email,
              resource_key: resourceKey,
              action,
              allowed,
              created_by: user.email,
            });
          }
        }
      }

      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'Usuário',
        detalhes: `Atualizou overrides de permissão para ${user.email}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userOverrides'] });
      toast.success('Permissões atualizadas com sucesso!');
      onClose?.();
    },
    onError: (error) => {
      toast.error('Erro ao atualizar permissões: ' + error.message);
    },
  });

  const handlePermissionChange = (resourceKey, action, value) => {
    setPermissionsData({
      ...permissionsData,
      [resourceKey]: {
        ...permissionsData[resourceKey],
        [action]: value,
      },
    });
  };

  const handleSave = () => {
    saveOverrideMutation.mutate(permissionsData);
  };

  const getDefaultPermission = (resourceKey, action) => {
    return rolPermissions?.[resourceKey]?.[action] ?? false;
  };

  const menuResources = resources.filter((r) => r.category === 'menu');

  return (
    <div className="space-y-6">
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <p className="text-sm text-yellow-400">
          ℹ️ Exceções de permissão (overrides) apenas - a role padrão é: <strong>{user?.role}</strong>
        </p>
      </div>

      {menuResources.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Nenhum recurso disponível</p>
      ) : (
        <div className="space-y-4">
          {menuResources.map((resource) => {
            const roleDefault = getDefaultPermission(resource.key, 'view');
            const currentOverride = permissionsData[resource.key]?.['view'];
            const isOverridden = currentOverride !== undefined;

            return (
              <div
                key={resource.key}
                className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{resource.label}</span>
                      {resource.tooltip && (
                        <span className="text-xs text-gray-400">({resource.tooltip})</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Padrão (role): {roleDefault ? '✓ Acessível' : '✗ Bloqueado'}
                      {isOverridden && (
                        <span className="ml-2 text-yellow-400">
                          [Override: {currentOverride ? '✓' : '✗'}]
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`resource_${resource.key}`}
                      checked={isOverridden ? currentOverride : roleDefault}
                      onCheckedChange={(value) =>
                        handlePermissionChange(resource.key, 'view', value)
                      }
                    />
                    <Label htmlFor={`resource_${resource.key}`} className="text-sm cursor-pointer">
                      {isOverridden ? 'Override Ativo' : 'Usar Padrão'}
                    </Label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="border-gray-700"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          className="bg-[#ADF802] hover:bg-[#9DE002] text-black font-bold"
          disabled={saveOverrideMutation.isPending}
        >
          {saveOverrideMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Exceções'
          )}
        </Button>
      </div>
    </div>
  );
}