import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem limpar registros' }, { status: 403 });
    }

    // Deletar AprovacaoAtividade pendentes
    const aprovacoesPendentes = await base44.entities.AprovacaoAtividade.filter({ status: 'pendente' });
    let countAprovacoes = 0;
    for (const aprovacao of aprovacoesPendentes) {
      await base44.entities.AprovacaoAtividade.delete(aprovacao.id);
      countAprovacoes++;
    }

    // Deletar Avaliacao pendentes
    const avaliacoesPendentes = await base44.entities.Avaliacao.filter({ status: 'Pendente' });
    let countAvaliacoes = 0;
    for (const avaliacao of avaliacoesPendentes) {
      await base44.entities.Avaliacao.delete(avaliacao.id);
      countAvaliacoes++;
    }

    // Deletar Questao pendentes
    const questoesPendentes = await base44.entities.Questao.filter({ status: 'Pendente' });
    let countQuestoes = 0;
    for (const questao of questoesPendentes) {
      await base44.entities.Questao.delete(questao.id);
      countQuestoes++;
    }

    // Deletar SolicitacaoFuncao pendentes
    const solicitacoesPendentes = await base44.entities.SolicitacaoFuncao.filter({ status: 'pendente' });
    let countSolicitacoes = 0;
    for (const solicitacao of solicitacoesPendentes) {
      await base44.entities.SolicitacaoFuncao.delete(solicitacao.id);
      countSolicitacoes++;
    }

    // Log da operação
    await base44.entities.Log.create({
      usuario_email: user.email,
      usuario_nome: user.full_name,
      acao: 'Criou',
      entidade: 'Sistema',
      detalhes: `Limpeza de registros pendentes: ${countAprovacoes} aprovações, ${countAvaliacoes} avaliações, ${countQuestoes} questões, ${countSolicitacoes} solicitações de função deletadas.`
    });

    return Response.json({
      success: true,
      message: 'Registros pendentes deletados com sucesso',
      deleted: {
        aprovacoes: countAprovacoes,
        avaliacoes: countAvaliacoes,
        questoes: countQuestoes,
        solicitacoes: countSolicitacoes
      },
      total: countAprovacoes + countAvaliacoes + countQuestoes + countSolicitacoes
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});