// REGISTRY ÚNICO DE RECURSOS DO SISTEMA
// Toda feature nova deve ser cadastrada aqui automaticamente
export interface ResourceDefinition {
  key: string;
  label: string;
  category: "menu" | "operacao" | "acao" | "admin";
  module: string;
  route?: string;
  actions: ("view" | "create" | "edit" | "delete" | "approve" | "export" | "admin")[];
  tooltip?: string;
}

export const RESOURCE_REGISTRY: ResourceDefinition[] = [
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
  {
    key: "export_excel",
    label: "Exportar Excel",
    category: "acao",
    module: "Exportação",
    actions: ["export"],
    tooltip: "Exportar dados em planilha Excel",
  },
  {
    key: "gerar_relatorio_ia",
    label: "Gerar Relatório IA",
    category: "acao",
    module: "IA",
    actions: ["view", "create"],
    tooltip: "Gerar análises e recomendações com IA",
  },
];

// Funções auxiliares para o registry
export function getResourceByKey(key: string): ResourceDefinition | undefined {
  return RESOURCE_REGISTRY.find((r) => r.key === key);
}

export function getResourcesByCategory(
  category: "menu" | "operacao" | "acao" | "admin"
): ResourceDefinition[] {
  return RESOURCE_REGISTRY.filter((r) => r.category === category);
}

export function getResourcesByModule(module: string): ResourceDefinition[] {
  return RESOURCE_REGISTRY.filter((r) => r.module === module);
}

export function getAllMenuResources(): ResourceDefinition[] {
  return RESOURCE_REGISTRY.filter((r) => r.category === "menu");
}