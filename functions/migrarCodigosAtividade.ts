import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Apenas admin pode executar
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar todas as atividades ordenadas por data de criação (mais antigas primeiro)
    const atividades = await base44.asServiceRole.entities.Atividade.list('created_date');

    // Contadores por tipo
    const contadores = {
      'Chamados': 1,
      'Ligações': 1,
      'Monitoria Offline': 1,
      'Monitoria Assistida': 1,
      'Feedback Individual': 1
    };

    // Prefixos por tipo
    const prefixos = {
      'Chamados': 'CH',
      'Ligações': 'LG',
      'Monitoria Offline': 'MO',
      'Monitoria Assistida': 'MA',
      'Feedback Individual': 'FB'
    };

    const atualizacoes = [];

    for (const atividade of atividades) {
      // Pular se já tem código
      if (atividade.codigo_atividade) {
        continue;
      }

      const tipo = atividade.tipo;
      const prefixo = prefixos[tipo];
      const numero = contadores[tipo];
      const codigo = `${prefixo}${String(numero).padStart(5, '0')}`;

      // Atualizar contador
      contadores[tipo]++;

      // Atualizar registro
      await base44.asServiceRole.entities.Atividade.update(atividade.id, {
        codigo_atividade: codigo
      });

      atualizacoes.push({ id: atividade.id, codigo });
    }

    return Response.json({
      success: true,
      total_atualizado: atualizacoes.length,
      contadores_finais: contadores,
      atualizacoes: atualizacoes.slice(0, 10) // Mostrar apenas as primeiras 10
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});