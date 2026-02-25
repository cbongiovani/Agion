import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Verificar se é admin
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem executar esta migração' }, { status: 403 });
    }

    // 1. Migrar todos os usuários com role 'user' para 'analyst'
    const users = await base44.asServiceRole.entities.User.list();
    const usersToMigrate = users.filter(u => u.role === 'user');

    for (const usr of usersToMigrate) {
      await base44.asServiceRole.entities.User.update(usr.id, { role: 'analyst' });
    }

    // 2. Registrar log da migração
    await base44.asServiceRole.entities.Log.create({
      usuario_email: user.email,
      usuario_nome: user.full_name,
      acao: 'Sistema',
      entidade: 'Sistema',
      detalhes: `Migração: ${usersToMigrate.length} usuários alterados de 'user' para 'analyst'`,
    });

    return Response.json({
      success: true,
      message: `Migração concluída: ${usersToMigrate.length} usuários alterados para 'Analista'`,
      migratedCount: usersToMigrate.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});