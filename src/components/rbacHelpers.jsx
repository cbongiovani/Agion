import { ROLE_PRESETS, MODULES } from './moduleConstants';
import { base44 } from '@/api/base44Client';

// Obter ou criar permissões do usuário
export async function getUserModulePermissions(userEmail, userRole) {
  try {
    const existing = await base44.entities.UserModulePermission.filter({
      user_email: userEmail,
    });

    if (existing.length > 0) {
      return existing[0];
    }

    // Criar com preset do role
    const preset = ROLE_PRESETS[userRole] || ROLE_PRESETS.analyst;
    const newPerms = await base44.entities.UserModulePermission.create({
      user_email: userEmail,
      modules: preset,
      updated_by: userEmail,
    });
    return newPerms;
  } catch (error) {
    console.error('Erro ao obter permissões:', error);
    return null;
  }
}

// Checar se módulo está visível
export function isModuleVisible(permissions, moduleKey) {
  return permissions?.modules?.[moduleKey]?.visible === true;
}

// Checar se usuário pode ler módulo
export function canReadModule(permissions, moduleKey) {
  return permissions?.modules?.[moduleKey]?.read === true;
}

// Checar se usuário pode criar no módulo
export function canCreateModule(permissions, moduleKey) {
  return permissions?.modules?.[moduleKey]?.create === true;
}

// Checar se usuário pode editar no módulo
export function canEditModule(permissions, moduleKey) {
  return permissions?.modules?.[moduleKey]?.edit === true;
}

// Checar se usuário pode deletar no módulo
export function canDeleteModule(permissions, moduleKey) {
  return permissions?.modules?.[moduleKey]?.delete === true;
}

// Filtrar itens de navegação visíveis
export function getVisibleNavItems(permissions, allItems) {
  return allItems.filter((item) => isModuleVisible(permissions, item.permKey));
}

// Atualizar permissões de módulo
export async function updateModulePermission(
  userEmail,
  moduleKey,
  permission,
  updatedBy
) {
  try {
    const existing = await base44.entities.UserModulePermission.filter({
      user_email: userEmail,
    });

    if (existing.length === 0) return null;

    const perms = existing[0];
    const updated = {
      ...perms.modules,
      [moduleKey]: {
        ...perms.modules[moduleKey],
        ...permission,
      },
    };

    await base44.entities.UserModulePermission.update(perms.id, {
      modules: updated,
      updated_by: updatedBy,
    });

    return updated;
  } catch (error) {
    console.error('Erro ao atualizar permissão:', error);
    return null;
  }
}

// Resetar para preset do role
export async function resetToRolePreset(userEmail, userRole, updatedBy) {
  try {
    const existing = await base44.entities.UserModulePermission.filter({
      user_email: userEmail,
    });

    const preset = ROLE_PRESETS[userRole] || ROLE_PRESETS.analyst;

    if (existing.length > 0) {
      await base44.entities.UserModulePermission.update(existing[0].id, {
        modules: preset,
        updated_by: updatedBy,
      });
    } else {
      await base44.entities.UserModulePermission.create({
        user_email: userEmail,
        modules: preset,
        updated_by: updatedBy,
      });
    }

    return preset;
  } catch (error) {
    console.error('Erro ao resetar permissões:', error);
    return null;
  }
}