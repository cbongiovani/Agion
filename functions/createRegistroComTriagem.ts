import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tipo, payload } = await req.json();

    if (!tipo || !payload) {
      return Response.json({ error: 'Missing tipo or payload' }, { status: 400 });
    }

    let novoRegistro;

    // 1) Criar registro principal
    if (tipo === 'atividade') {
      novoRegistro = await base44.entities.Atividade.create(payload);
    } else if (tipo === 'fechamento') {
      novoRegistro = await base44.entities.FechamentoSemanal.create(payload);
    } else if (tipo === 'warroom') {
      novoRegistro = await base44.entities.Incidente.create(payload);
    } else {
      return Response.json({ error: 'Invalid tipo' }, { status: 400 });
    }

    // 2) Verificar se já existe aprovação para este registro
    try {
      const aprovacaoExistente = await base44.entities.AprovacaoAtividade.filter({
        atividade_id: novoRegistro.id,
        tipo: tipo
      });

      if (aprovacaoExistente.length > 0) {
        // Rollback: deletar registro criado
        if (tipo === 'atividade') {
          await base44.entities.Atividade.delete(novoRegistro.id);
        } else if (tipo === 'fechamento') {
          await base44.entities.FechamentoSemanal.delete(novoRegistro.id);
        } else if (tipo === 'warroom') {
          await base44.entities.Incidente.delete(novoRegistro.id);
        }
        return Response.json({ 
          error: 'Registro de aprovação duplicado detectado. Operação cancelada.' 
        }, { status: 409 });
      }

      // 3) Criar AprovacaoAtividade
      const novaAprovacao = await base44.entities.AprovacaoAtividade.create({
        atividade_id: novoRegistro.id,
        tipo: tipo,
        status: 'pendente'
      });

      // 4) Criar log
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Criou',
        entidade: tipo === 'atividade' ? 'Atividade' : tipo === 'fechamento' ? 'Fechamento Semanal' : 'Incidente',
        detalhes: `Registro ${novoRegistro.id} enviado para aprovação`
      });

      return Response.json({
        success: true,
        registro: novoRegistro,
        aprovacao: novaAprovacao
      });
    } catch (aprovacaoError) {
      // ROLLBACK: deletar registro principal se falhar aprovação
      if (tipo === 'atividade') {
        await base44.entities.Atividade.delete(novoRegistro.id);
      } else if (tipo === 'fechamento') {
        await base44.entities.FechamentoSemanal.delete(novoRegistro.id);
      } else if (tipo === 'warroom') {
        await base44.entities.Incidente.delete(novoRegistro.id);
      }

      return Response.json({ 
        error: 'Falha ao criar aprovação. Registro foi cancelado. Tente novamente.' 
      }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});