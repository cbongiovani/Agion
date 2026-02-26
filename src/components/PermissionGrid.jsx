import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export default function PermissionGrid({ user, resources, userOverrides, roles, onClose }) {
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState({}); // Armazena mudanças antes de aplicar
  const [applying, setApplying] = useState(false);

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

  // Função para obter permissão (precedência: pendingChanges > override > role > deny)
  const getPermission = useCallback(
    (resourceKey, action) => {
      const key = `${resourceKey}_${action}`;
      if (pendingChanges[key] !== undefined) return pendingChanges[key];

      const override = userOverrides.find(
        (o) => o.resource_key === resourceKey && o.action === action
      );
      if (override !== undefined) return override.allowed;

      const rolePerms = rolePermissions.find(
        (rp) => rp.resource_key === resourceKey && rp.action === action
      );
      return rolePerms ? rolePerms.allowed : false;
    },
    [pendingChanges, userOverrides, rolePermissions]
  );

  // Função para saber se é override ou mudança pendente
  const isOverride = useCallback(
    (resourceKey, action) => {
      const key = `${resourceKey}_${action}`;
      return pendingChanges[key] !== undefined || userOverrides.some(
        (o) => o.resource_key === resourceKey && o.action === action
      );
    },
    [pendingChanges, userOverrides]
  );

  // Mutation: Atualizar múltiplas permissões
  const updatePermissionsMutation = useMutation({
    mutationFn: async (changes) => {
      const currentUser = await base44.auth.me();
      
      // Aplicar cada mudança
      for (const [key, allowed] of Object.entries(changes)) {
        const [resourceKey, action] = key.split('_');
        const existing = userOverrides.find(
          (o) => o.resource_key === resourceKey && o.action === action
        );

        if (existing) {
          await base44.entities.UserPermissionOverride.update(existing.id, { allowed });
        } else {
          await base44.entities.UserPermissionOverride.create({
            user_email: currentUser.email,
            resource_key: resourceKey,
            action,
            allowed,
            reason: 'Manual override',
            created_by: currentUser.email,
          });
        }
      }

      await base44.entities.Log.create({
        usuario_email: currentUser.email,
        usuario_nome: currentUser.full_name,
        acao: 'Atualizou',
        entidade: 'UserPermissionOverride',
        detalhes: `Atualizou ${Object.keys(changes).length} permissão(ões)`,
      });

      queryClient.invalidateQueries({ queryKey: ['userOverrides'] });
    },
    onError: (error) => toast.error('Erro ao aplicar permissões: ' + error.message),
  });

  const handlePermissionChange = (resourceKey, action, allowed) => {
    const key = `${resourceKey}_${action}`;
    setPendingChanges((prev) => ({
      ...prev,
      [key]: allowed,
    }));
  };

  const handleApply = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      toast.info('Nenhuma alteração para aplicar');
      return;
    }
    
    setApplying(true);
    try {
      await updatePermissionsMutation.mutateAsync(pendingChanges);
      toast.success('Permissões aplicadas com sucesso!');
      setPendingChanges({});
      setTimeout(() => {
        if (onClose) onClose();
      }, 500);
    } finally {
      setApplying(false);
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

      {/* Botões de Ação */}
      <div className="flex gap-3 pt-4 border-t border-[#1e3a5f] mt-4">
        <button
          onClick={() => onClose?.()}
          className="flex-1 px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
        >
          Fechar
        </button>
        <button
          onClick={handleApply}
          disabled={applying || Object.keys(pendingChanges).length === 0}
          className={`flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            applying || Object.keys(pendingChanges).length === 0
              ? 'bg-gray-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {applying && <Loader2 className="w-4 h-4 animate-spin" />}
          Aplicar {Object.keys(pendingChanges).length > 0 && `(${Object.keys(pendingChanges).length})`}
        </button>
      </div>
      </div>
      );
      }