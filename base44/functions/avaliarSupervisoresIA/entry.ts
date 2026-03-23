import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supervisorEmail = new URL(req.url).searchParams.get('supervisor_email');

    // Buscar dados
    const [atividades, supervisores, analistas, fechamentos, incidentes, quizzes, avaliacoes] = await Promise.all([
      base44.entities.Atividade.list(),
      base44.entities.Supervisor.list(),
      base44.entities.Analista.list(),
      base44.entities.FechamentoSemanal.list(),
      base44.entities.Incidente.list(),
      base44.entities.QuizzRelampago.list(),
      base44.entities.Avaliacao.list(),
    ]);

    // Se supervisorEmail fornecido, filtrar para esse supervisor
    let supervisoresAnalise = supervisores;
    if (supervisorEmail) {
      supervisoresAnalise = supervisores.filter((s) => s.usuario_email === supervisorEmail);
    }

    const analisesSupervisores = supervisoresAnalise.map((supervisor) => {
      const analistasDoSupervisor = analistas.filter((a) => a.supervisor_id === supervisor.id);
      const emailsAnalistas = analistasDoSupervisor.map((a) => a.usuario_email);

      const atividadesSupervisor = atividades.filter(
        (a) => a.supervisor_id === supervisor.id || emailsAnalistas.includes(a.registrado_por)
      );

      const fechamentosSupervisor = fechamentos.filter((f) => f.supervisor_id === supervisor.id);
      const incidentesSupervisor = incidentes.filter((i) => i.supervisor_id === supervisor.id);
      const quizzesSupervisor = quizzes.filter((q) => emailsAnalistas.includes(q.usuario_email));
      const avaliacoesSupervisor = avaliacoes.filter((av) =>
        analistasDoSupervisor.some((a) => a.id === av.analista_id)
      );

      return {
        nome: supervisor.nome,
        email: supervisor.usuario_email,
        equipe: supervisor.equipe,
        analistas: analistasDoSupervisor.length,
        totalAtividades: atividadesSupervisor.length,
        mediaNotasAtividades:
          atividadesSupervisor.length > 0
            ? (atividadesSupervisor.reduce((sum, a) => sum + (a.nota || 0), 0) / atividadesSupervisor.length).toFixed(1)
            : 0,
        totalFechamentos: fechamentosSupervisor.length,
        totalIncidentes: incidentesSupervisor.length,
        totalQuizzes: quizzesSupervisor.length,
        totalAvaliacoes: avaliacoesSupervisor.length,
        atividadesData: atividadesSupervisor.map((a) => ({ data: a.data, nota: a.nota, status: a.status })),
        fechamentosData: fechamentosSupervisor.map((f) => ({
          semana: f.semana_inicio,
          backlog: f.backlog_final,
        })),
      };
    });

    // Gerar análise consolidada via IA
    const prompt = `Analise os dados de desempenho destes supervisores e gere recomendações:

${analisesSupervisores
  .map(
    (s) => `
SUPERVISOR: ${s.nome} (${s.equipe})
- Analistas: ${s.analistas}
- Total de Atividades: ${s.totalAtividades} (Média de nota: ${s.mediaNotasAtividades}/10)
- Fechamentos Semanais: ${s.totalFechamentos}
- Incidentes: ${s.totalIncidentes}
- Quizzes: ${s.totalQuizzes}
- Avaliações: ${s.totalAvaliacoes}
`
  )
  .join('\n')}

Retorne um JSON com:
{
  "resumo_executivo": "texto com visão geral",
  "pontos_positivos": ["ponto 1", "ponto 2", ...],
  "pontos_atencao": ["ponto 1", "ponto 2", ...],
  "recomendacoes": ["rec 1", "rec 2", ...],
  "ranking": [
    {"nome": "Supervisor X", "posicao": 1, "motivo": "razão"},
    ...
  ],
  "recomendacoes_individuais": {
    "email@supervisor.com": ["rec 1", "rec 2", ...]
  }
}`;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          resumo_executivo: { type: 'string' },
          pontos_positivos: { type: 'array', items: { type: 'string' } },
          pontos_atencao: { type: 'array', items: { type: 'string' } },
          recomendacoes: { type: 'array', items: { type: 'string' } },
          ranking: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nome: { type: 'string' },
                posicao: { type: 'number' },
                motivo: { type: 'string' },
              },
            },
          },
          recomendacoes_individuais: { type: 'object' },
        },
      },
    });

    return Response.json({
      analises: analisesSupervisores,
      avaliacao: resultado,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});