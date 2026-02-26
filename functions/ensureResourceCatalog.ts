// FUNÇÃO PARA SINCRONIZAR REGISTRY COM BANCO DE DADOS
// Deve ser executada ao iniciar o app (admin) ou em deploy
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const RESOURCE_REGISTRY = [
  // MENUS PRINCIPAIS
  {
    key: "dashboard",
    label: "Dashboard",
    category: "menu",
    module: "Dashboard",
    route: "/dashboard",
    actions: ["view"],
    tooltip: "Visão geral consolidada de métricas e performance",
  },
  {
    key: "atividades",
    label: "Atividades",
    category: "menu",
    module: "Atividades",
    route: "/atividades",
    actions: ["view", "create", "edit", "delete"],
    tooltip: "Registre e acompanhe atividades de monitorias, chamados e feedback",
  },
  {
    key: "fechamento_semanal",
    label: "Fechamento Semanal",
    category: "menu",
    module: "Fechamento",
    route: "/fechamento-semanal",
    actions: ["view", "create", "edit", "delete"],
    tooltip: "Consolidação semanal de resultados e backlog",
  },
  {
    key: "supervisores",
    label: "Supervisores",
    category: "menu",
    module: "Gestão",
    route: "/supervisores",
    actions: ["view", "create", "edit", "delete"],
    tooltip: "Gestão de equipes supervisoras",
  },
  {
    key: "analistas",
    label: "Analistas",
    category: "menu",
    module: "Gestão",
    route: "/analistas",
    actions: ["view", "create", "edit", "delete"],
    tooltip: "Cadastro e acompanhamento de analistas N1",
  },
  {
    key: "ranking",
    label: "Ranking",
    category: "menu",
    module: "Ranking",
    route: "/ranking",
    actions: ["view"],
    tooltip: "Ranking de performance com gamificação MMORPG",
  },
  {
    key: "quizz_relampago",
    label: "Quizz Relâmpago",
    category: "menu",
    module: "Quizz",
    route: "/quizz-relampago",
    actions: ["view", "create", "edit", "delete"],
    tooltip: "Testes rápidos de conhecimento",
  },
  {
    key: "avaliacoes",
    label: "Avaliações",
    category: "menu",
    module: "Avaliações",
    route: "/avaliacoes",
    actions: ["view", "create", "edit", "delete"],
    tooltip: "Avaliações periódicas (AT) estruturadas",
  },
  {
    key: "certificados",
    label: "Certificados",
    category: "menu",
    module: "Certificados",
    route: "/certificados",
    actions: ["view", "create", "edit", "delete"],
    tooltip: "Gerenciar certificados e cursos",
  },
  {
    key: "war_room",
    label: "War Room",
    category: "menu",
    module: "War Room",
    route: "/war-room",
    actions: ["view", "create", "edit", "delete", "export"],
    tooltip: "Gerenciamento de incidentes críticos",
  },
  {
    key: "manual_supervisor",
    label: "Manual do Supervisor",
    category: "menu",
    module: "Documentação",
    route: "/manual-supervisor",
    actions: ["view"],
    tooltip: "Base de conhecimento para supervisores",
  },
  {
    key: "logs",
    label: "Logs do Sistema",
    category: "menu",
    module: "Admin",
    route: "/logs",
    actions: ["view"],
    tooltip: "Rastreamento de ações do painel",
  },
  {
    key: "gestao_usuarios",
    label: "Gestão de Usuários",
    category: "menu",
    module: "Admin",
    route: "/gestao-usuarios",
    actions: ["view", "create", "edit", "delete", "admin"],
    tooltip: "Convites, permissões e funções personalizadas",
  },
  // OPERAÇÕES
  {
    key: "atividades_approve",
    label: "Aprovação de Atividades",
    category: "operacao",
    module: "Aprovação",
    actions: ["view", "approve"],
    tooltip: "Aprovar/Rejeitar atividades pendentes",
  },
  {
    key: "export_pdf",
    label: "Exportar PDF",
    category: "acao",
    module: "Exportação",
    actions: ["export"],
    tooltip: "Exportar dados e relatórios em PDF",
  },
];

const SYSTEM_ROLES = [
  {
    key: "admin",
    label: "Administrador",
    description: "Acesso total ao sistema",
    badge_color: "red",
    is_system: true,
    display_order: 1,
  },
  {
    key: "supervisor",
    label: "Supervisor",
    description: "Gerencia analistas e atividades",
    badge_color: "blue",
    is_system: true,
    display_order: 2,
  },
  {
    key: "analista",
    label: "Analista",
    description: "Registra e acompanha atividades",
    badge_color: "green",
    is_system: true,
    display_order: 3,
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== "admin") {
      return Response.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    let createdCount = 0;
    let updatedCount = 0;

    // 1. Sincronizar recursos (UPSERT)
    for (const resource of RESOURCE_REGISTRY) {
      const existing = await base44.entities.ResourceCatalog.filter({
        key: resource.key,
      });

      if (existing.length === 0) {
        await base44.asServiceRole.entities.ResourceCatalog.create(resource);
        createdCount++;
      } else {
        await base44.asServiceRole.entities.ResourceCatalog.update(
          existing[0].id,
          {
            label: resource.label,
            category: resource.category,
            module: resource.module,
            route: resource.route,
            actions: resource.actions,
            tooltip: resource.tooltip,
          }
        );
        updatedCount++;
      }
    }

    // 2. Sincronizar roles padrão
    let rolesCreated = 0;
    for (const role of SYSTEM_ROLES) {
      const existing = await base44.entities.Role.filter({ key: role.key });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.Role.create(role);
        rolesCreated++;
      }
    }

    // 3. Aplicar permissões padrão para Admin (todas as ações)
    const adminRole = (await base44.entities.Role.filter({ key: "admin" }))[0];
    if (adminRole) {
      for (const resource of RESOURCE_REGISTRY) {
        for (const action of resource.actions) {
          const existing =
            await base44.entities.RolePermission.filter({
              role_key: "admin",
              resource_key: resource.key,
              action: action,
            });

          if (existing.length === 0) {
            await base44.asServiceRole.entities.RolePermission.create({
              role_key: "admin",
              resource_key: resource.key,
              action: action,
              allowed: true,
            });
          }
        }
      }
    }

    return Response.json({
      success: true,
      message: "Resource catalog synchronized",
      resourcesCreated: createdCount,
      resourcesUpdated: updatedCount,
      rolesCreated: rolesCreated,
    });
  } catch (error) {
    console.error("Error in ensureResourceCatalog:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
});