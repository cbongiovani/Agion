import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PermissionGrid({ user, resources, userOverrides, roles }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState({});

  // Agrupar recursos por módulo
  const resourcesByModule = resources.reduce((acc, r) => {
    if (!acc[r.module]) acc[r.module] = [];
    acc[r.module].push(r);
    return acc;
  }, {});

  // Obter permissão padrão da role
  const { data: rolePermissions = [] } = useQuery({
    queryKey: ['rolePermissions', user.role],
    queryFn: () =>
      base44.entities.RolePermission.filter({ role_key: user.role }),
    enabled: !!user.role,
  });

  // Função para obter permissão (precedência: override > role > deny)
  const getPermission = useCallback(
    (resourceKey, action) => {
      const override = userOverrides.find(
        (o) => o.resource_key === resourceKey && o.action === action
      );
      if (override !== undefined) return override.allowed;

      const rolePerms = rolePermissions.find(
        (rp) => rp.resource_key === resourceKey && rp.action === action
      );
      return rolePerms ? rolePerms.allowed : false;
    },
    [userOverrides, rolePermissions]
  );

  // Função para saber se é override
  const isOverride = useCallback(
    (resourceKey, action) => {
      return userOverrides.some(
        (o) => o.resource_key === resourceKey && o.action === action
      );
    },
    [userOverrides]
  );

  // Mutation: Atualizar permissão
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ resourceKey, action, allowed }) => {
      const user = await base44.auth.me();
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
          reason: 'Manual override',
          created_by: user.email,
        });
      }

      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'UserPermissionOverride',
        detalhes: `${resourceKey}/${action} = ${allowed ? 'SIM' : 'NÃO'} para ${user.email}`,
      });

      queryClient.invalidateQueries({ queryKey: ['userOverrides'] });
    },
    onError: (error) => toast.error('Erro: ' + error.message),
  });

  const handlePermissionChange = async (resourceKey, action, allowed) => {
    setSaving((prev) => ({ ...prev, [`${resourceKey}_${action}`]: true }));
    try {
      await updatePermissionMutation.mutateAsync({
        resourceKey,
        action,
        allowed,
      });
      toast.success(`Permissão atualizada!`);
    } finally {
      setSaving((prev) => ({ ...prev, [`${resourceKey}_${action}`]: false }));
    }
  };

  return (
    <div className="bg-[#0a1628] rounded-xl border border-[#1e3a5f] p-4 flex flex-col">
      <h2 className="text-lg font-bold text-white mb-4">Permissões</h2>
      <p className="text-xs text-gray-400 mb-4">
        Padrão da role: <strong>{roles.find(r => r.key === user.role)?.label}</strong>
      </p>

      <div className="flex-1 overflow-y-auto space-y-4">
        {Object.entries(resourcesByModule).map(([module, moduleResources]) => (
          <div key={module} className="bg-[#0f1f35] rounded-lg p-3 border border-[#1e3a5f]/30">
            <h3 className="text-sm font-semibold text-[#ADF802] mb-3">{module}</h3>

            <div className="space-y-2">
              {moduleResources.map((resource) => (
                <div key={resource.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-medium">{resource.label}</span>
                  </div>

                  {/* Visibility */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-16">Visível:</span>
                    <Select
                      value={getPermission(resource.key, 'view') ? 'sim' : 'nao'}
                      onValueChange={(val) =>
                        handlePermissionChange(resource.key, 'view', val === 'sim')
                      }
                      disabled={saving[`${resource.key}_view`]}
                    >
                      <SelectTrigger className="bg-[#0a1628] border-[#1e3a5f] h-7 text-xs w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a1628] border-[#1e3a5f]">
                        <SelectItem value="sim">Sim</SelectItem>
                        <SelectItem value="nao">Não</SelectItem>
                      </SelectContent>
                    </Select>
                    {isOverride(resource.key, 'view') && (
                      <Badge className="bg-orange-500/20 text-orange-300 text-xs">
                        Exceção
                      </Badge>
                    )}
                  </div>

                  {/* Other actions */}
                  {resource.actions
                    .filter((a) => a !== 'view')
                    .map((action) => (
                      <div key={action} className="flex items-center gap-2 text-xs pl-4">
                        <span className="text-gray-500 w-12 capitalize">{action}:</span>
                        <Select
                          value={getPermission(resource.key, action) ? 'sim' : 'nao'}
                          onValueChange={(val) =>
                            handlePermissionChange(resource.key, action, val === 'sim')
                          }
                          disabled={saving[`${resource.key}_${action}`]}
                        >
                          <SelectTrigger className="bg-[#0a1628] border-[#1e3a5f] h-7 text-xs w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0a1628] border-[#1e3a5f]">
                            <SelectItem value="sim">Sim</SelectItem>
                            <SelectItem value="nao">Não</SelectItem>
                          </SelectContent>
                        </Select>
                        {isOverride(resource.key, action) && (
                          <Badge className="bg-orange-500/20 text-orange-300 text-xs">
                            Exceção
                          </Badge>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}