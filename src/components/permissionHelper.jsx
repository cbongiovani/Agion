// HELPER GLOBAL DE PERMISSÕES - can()
import { base44 } from "@/api/base44Client";

interface User {
  email: string;
  role?: string;
  full_name?: string;
}

// Cache de permissões por role (role_key -> {resource_key -> {action -> boolean}})
let permissionCache: Record<
  string,
  Record<string, Record<string, boolean>>
> = {};

// Cache de overrides por usuário
let overrideCache: Record<
  string,
  Record<string, Record<string, boolean>>
> = {};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
let lastCacheUpdate = 0;

/**
 * Carrega permissões do RolePermission para o cache
 */
export async function loadRolePermissions() {
  try {
    const now = Date.now();
    if (now - lastCacheUpdate < CACHE_TTL) {
      return; // Cache ainda válido
    }

    const rolePermissions =
      await base44.entities.RolePermission.list();
    permissionCache = {};

    for (const perm of rolePermissions) {
      if (!permissionCache[perm.role_key]) {
        permissionCache[perm.role_key] = {};
      }
      if (!permissionCache[perm.role_key][perm.resource_key]) {
        permissionCache[perm.role_key][perm.resource_key] = {};
      }
      permissionCache[perm.role_key][perm.resource_key][perm.action] =
        perm.allowed;
    }

    lastCacheUpdate = now;
  } catch (error) {
    console.error("Erro ao carregar permissões de role:", error);
  }
}

/**
 * Carrega overrides de permissão por usuário
 */
export async function loadUserPermissionOverrides(userEmail: string) {
  try {
    const overrides =
      await base44.entities.UserPermissionOverride.filter({
        user_email: userEmail,
      });

    if (!overrideCache[userEmail]) {
      overrideCache[userEmail] = {};
    }

    for (const override of overrides) {
      if (!overrideCache[userEmail][override.resource_key]) {
        overrideCache[userEmail][override.resource_key] = {};
      }
      overrideCache[userEmail][override.resource_key][override.action] =
        override.allowed;
    }
  } catch (error) {
    console.error("Erro ao carregar overrides:", error);
  }
}

/**
 * Função principal de verificação de permissão
 * Ordem de decisão:
 * 1. Se user.role === 'admin' -> true
 * 2. Se existe UserPermissionOverride -> usar
 * 3. Senão -> RolePermission
 * 4. Senão -> false
 */
export async function can(
  user: User | null,
  resourceKey: string,
  action: string
): Promise<boolean> {
  if (!user) return false;

  // Admin tem tudo
  if (user.role === "admin") return true;

  const userRole = user.role || "user";

  // Carregar caches se necessário
  await loadRolePermissions();
  await loadUserPermissionOverrides(user.email);

  // 1. Verificar UserPermissionOverride (exceção por usuário)
  if (
    overrideCache[user.email] &&
    overrideCache[user.email][resourceKey] &&
    overrideCache[user.email][resourceKey][action] !== undefined
  ) {
    return overrideCache[user.email][resourceKey][action];
  }

  // 2. Verificar RolePermission
  if (
    permissionCache[userRole] &&
    permissionCache[userRole][resourceKey] &&
    permissionCache[userRole][resourceKey][action] !== undefined
  ) {
    return permissionCache[userRole][resourceKey][action];
  }

  // 3. Padrão: não permitido
  return false;
}

/**
 * Limpar caches (útil após mudanças de permissão)
 */
export function clearPermissionCaches() {
  permissionCache = {};
  overrideCache = {};
  lastCacheUpdate = 0;
}

/**
 * Buscar todas as permissões de uma role
 */
export async function getRolePermissions(
  roleKey: string
): Promise<Record<string, Record<string, boolean>>> {
  await loadRolePermissions();
  return permissionCache[roleKey] || {};
}

/**
 * Buscar todos os overrides de um usuário
 */
export async function getUserOverrides(
  userEmail: string
): Promise<Record<string, Record<string, boolean>>> {
  await loadUserPermissionOverrides(userEmail);
  return overrideCache[userEmail] || {};
}