import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const { event, data } = body;
    
    // Só processar se for rejeição
    if (data?.status !== 'rejeitado' || event?.type !== 'update') {
      return new Response(JSON.stringify({ status: 'skipped', reason: 'not_rejection' }), { status: 200 });
    }
    
    const aprovacao = data;
    const atividade_id = aprovacao?.atividade_id;
    const tipo = aprovacao?.tipo;
    
    if (!atividade_id || !tipo) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing atividade_id or tipo' }), { status: 400 });
    }
    
    try {
      // Deletar o registro baseado no tipo
      if (tipo === 'atividade') {
        await base44.asServiceRole.entities.Atividade.delete(atividade_id);
      } else if (tipo === 'fechamento') {
        await base44.asServiceRole.entities.FechamentoSemanal.delete(atividade_id);
      } else if (tipo === 'warroom') {
        await base44.asServiceRole.entities.Incidente.delete(atividade_id);
      } else if (tipo === 'avaliacao') {
        await base44.asServiceRole.entities.Avaliacao.delete(atividade_id);
      } else if (tipo === 'quizz') {
        await base44.asServiceRole.entities.QuizzRelampago.delete(atividade_id);
      } else if (tipo === 'questao') {
        await base44.asServiceRole.entities.Questao.delete(atividade_id);
      }
      
      // Log da exclusão
      const user = await base44.auth.me();
      if (user) {
        try {
          await base44.asServiceRole.entities.Log.create({
            usuario_email: user.email,
            usuario_nome: user.full_name,
            acao: 'Excluiu',
            entidade: 'Sistema',
            detalhes: `Registro ${tipo} ID ${atividade_id} foi deletado automaticamente após rejeição`,
          });
        } catch (logError) {
          console.warn('Erro ao criar log:', logError);
        }
      }
      
      return new Response(JSON.stringify({ status: 'success', deleted: tipo, id: atividade_id }), { status: 200 });
    } catch (deleteError) {
      // Se não encontrar o registro, é ok (já foi deletado)
      return new Response(JSON.stringify({ status: 'success', message: 'Record not found or already deleted' }), { status: 200 });
    }
  } catch (error) {
    console.error('Error in deleteRejectedRecords:', error);
    return new Response(JSON.stringify({ status: 'error', message: error.message }), { status: 500 });
  }
});