import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Verificar se é admin
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem executar esta migração' }, { status: 403 });
    }

    // 1. Migrar todos os usuários com role 'user' ou 'analyst' via Platform API
    const users = await base44.asServiceRole.entities.User.list();
    const usersToMigrate = users.filter(u => u.role === 'user' || u.role === 'analyst');

    let migratedCount = 0;
    for (const usr of usersToMigrate) {
      try {
        // Usar fetch para chamar a Platform API diretamente
        const response = await fetch(`https://api.base44.com/api/v1/users/${usr.id}/role`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('BASE44_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ role: 'analyst' })
        });
        if (response.ok) migratedCount++;
      } catch (e) {
        console.error(`Erro ao migrar ${usr.id}:`, e.message);
      }
    }

    // 2. Registrar log da migração
    await base44.asServiceRole.entities.Log.create({
      usuario_email: user.email,
      usuario_nome: user.full_name,
      acao: 'Sistema',
      entidade: 'Sistema',
      detalhes: `Migração: ${migratedCount} usuários alterados para 'analyst'`,
    });

    return Response.json({
      success: true,
      message: `Migração concluída: ${migratedCount} usuários alterados para 'Analista'`,
      migratedCount: migratedCount
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});