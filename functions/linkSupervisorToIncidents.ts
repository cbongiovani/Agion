import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Only POST allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role !== 'admin') {
      return Response.json({ error: 'Only admins can run this' }, { status: 403 });
    }

    // Buscar todos os supervisores
    const supervisores = await base44.asServiceRole.entities.Supervisor.list();
    
    // Buscar todos os incidentes
    const incidentes = await base44.asServiceRole.entities.Incidente.list();

    let updated = 0;

    // Para cada incidente sem supervisor_id
    for (const incidente of incidentes) {
      if (!incidente.supervisor_id && incidente.registrado_por) {
        // Encontrar o supervisor com esse email
        const supervisor = supervisores.find(s => s.usuario_email === incidente.registrado_por);
        
        if (supervisor) {
          await base44.asServiceRole.entities.Incidente.update(incidente.id, {
            supervisor_id: supervisor.id
          });
          updated++;
        }
      }
    }

    return Response.json({
      success: true,
      message: `Vinculação retroativa concluída: ${updated} incidentes atualizados`,
      updated_count: updated
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});