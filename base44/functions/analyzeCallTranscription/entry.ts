import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Only POST allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const incidentId = formData.get('incidentId');

    if (!file || !incidentId) {
      return Response.json({ error: 'Missing file or incidentId' }, { status: 400 });
    }

    // Upload do arquivo
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // Buscar o incidente para context
    const incident = await base44.asServiceRole.entities.Incidente.filter({ id: incidentId });
    const incidentData = incident.length > 0 ? incident[0] : null;

    // Preparar prompt para análise
    const analysisPrompt = `Você é um especialista em RCA (Root Cause Analysis) de incidentes TI em ambientes de alta disponibilidade.

Arquivo de transcrição da call de incidente: ${file_url}

Contexto do incidente:
- Título: ${incidentData?.titulo || 'Não informado'}
- Severidade: ${incidentData?.severidade || 'Não informada'}
- Categoria: ${incidentData?.categoria || 'Não informada'}

ANALISE A TRANSCRIÇÃO E:

1. Extraia TODOS os eventos e ações mencionadas
2. Para cada evento/ação, identifique:
   - Horário (HH:MM format, se mencionado na transcrição)
   - Descrição clara da ação/evento
   - Setor/Time responsável (Suporte, Redes, NOC, Segurança, Sistemas, DevOps, etc)
   - Validação: É pertinente ao RCA do incidente TI? (sim/não)

3. Ordene cronologicamente desde o primeiro evento até encerramento

4. RESPONDA COM JSON ESTRUTURADO:
{
  "transcription_analysis": true,
  "incident_title": "título extraído",
  "activities": [
    {
      "hora": "HH:MM",
      "acao": "Descrição clara e concisa da ação",
      "setor": "Suporte|Redes|NOC|Segurança|Sistemas|DevOps|Gestão|Fornecedor/Terceiro|Outro",
      "relevant_to_rca": true,
      "relevance_reason": "Por que é pertinente ao RCA"
    }
  ],
  "rca_summary": "Resumo breve do RCA baseado nas atividades",
  "root_causes": ["causa1", "causa2"],
  "prevention_actions": ["ação preventiva 1", "ação preventiva 2"]
}`;

    // Chamar IA para análise
    const analysisResult = await base44.integrations.Core.InvokeLLM({
      prompt: analysisPrompt,
      add_context_from_internet: false,
      response_json_schema: {
        type: 'object',
        properties: {
          transcription_analysis: { type: 'boolean' },
          incident_title: { type: 'string' },
          activities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                hora: { type: 'string' },
                acao: { type: 'string' },
                setor: { type: 'string' },
                relevant_to_rca: { type: 'boolean' },
                relevance_reason: { type: 'string' }
              }
            }
          },
          rca_summary: { type: 'string' },
          root_causes: { type: 'array', items: { type: 'string' } },
          prevention_actions: { type: 'array', items: { type: 'string' } }
        }
      },
      file_urls: [file_url]
    });

    // Filtrar apenas atividades relevantes ao RCA
    const relevantActivities = analysisResult.activities?.filter(a => a.relevant_to_rca) || [];

    return Response.json({
      success: true,
      file_url,
      analysis: {
        incident_title: analysisResult.incident_title,
        activities: relevantActivities,
        rca_summary: analysisResult.rca_summary,
        root_causes: analysisResult.root_causes,
        prevention_actions: analysisResult.prevention_actions,
        total_activities: relevantActivities.length
      },
      message: `Análise concluída. ${relevantActivities.length} atividades pertinentes ao RCA identificadas.`
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return Response.json(
      { error: error.message || 'Erro ao analisar transcrição' },
      { status: 500 }
    );
  }
});