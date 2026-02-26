import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, RefreshCw, Loader2, Calendar, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { startOfWeek, endOfWeek, format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PlanoAcaoIAWidget({ currentUser }) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  // Buscar supervisor logado
  const { data: supervisorLogado } = useQuery({
    queryKey: ['supervisorLogado', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;
      const supervisores = await base44.entities.Supervisor.filter({ usuario_email: currentUser.email });
      return supervisores.length > 0 ? supervisores[0] : null;
    },
    enabled: !!currentUser?.email,
  });

  // Período atual (semana + últimos 7 dias)
  const hoje = new Date();
  const periodoInicio = format(subDays(hoje, 7), 'yyyy-MM-dd');
  const periodoFim = format(hoje, 'yyyy-MM-dd');

  // Buscar plano mais recente do supervisor
  const { data: planoAtual } = useQuery({
    queryKey: ['planoAcao', supervisorLogado?.id, periodoInicio],
    queryFn: async () => {
      if (!supervisorLogado?.id) return null;
      const planos = await base44.entities.PlanoAcaoIA.filter({ 
        supervisor_id: supervisorLogado.id,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim
      });
      return planos.length > 0 ? planos[0] : null;
    },
    enabled: !!supervisorLogado?.id,
  });

  const gerarPlanoMutation = useMutation({
    mutationFn: async () => {
      setGenerating(true);
      
      // 1. Buscar analistas do supervisor
      const analistas = await base44.entities.Analista.filter({ supervisor_id: supervisorLogado.id });
      
      if (analistas.length === 0) {
        throw new Error('Nenhum analista vinculado a este supervisor');
      }

      const analistaIds = analistas.map(a => a.id);

      // 2. Buscar aprovações de atividades
      const todasAprovacoes = await base44.entities.AprovacaoAtividade.list();
      const aprovadas = todasAprovacoes
        .filter(a => a.tipo === 'atividade' && a.status === 'aprovado')
        .map(a => a.atividade_id);

      // 3. Buscar atividades aprovadas dos analistas (período)
      const todasAtividades = await base44.entities.Atividade.list();
      const atividadesEquipe = todasAtividades.filter(ativ => {
        const ativDate = new Date(ativ.data);
        const dentroPeríodo = ativ.data >= periodoInicio && ativ.data <= periodoFim;
        const doSupervisor = ativ.supervisor_id === supervisorLogado.id;
        const aprovada = aprovadas.includes(ativ.id);
        return dentroPeríodo && doSupervisor && aprovada;
      });

      // 4. Preparar dados para IA
      const estatisticasPorAnalista = analistas.map(analista => {
        const atividadesAnalista = atividadesEquipe.filter(a => a.analista_id === analista.id);
        
        const porTipo = {
          'Chamados': atividadesAnalista.filter(a => a.tipo === 'Chamados').length,
          'Ligações': atividadesAnalista.filter(a => a.tipo === 'Ligações').length,
          'Monitoria Offline': atividadesAnalista.filter(a => a.tipo === 'Monitoria Offline').length,
          'Monitoria Assistida': atividadesAnalista.filter(a => a.tipo === 'Monitoria Assistida').length,
          'Feedback Individual': atividadesAnalista.filter(a => a.tipo === 'Feedback Individual').length,
        };

        const media = atividadesAnalista.length > 0
          ? atividadesAnalista.reduce((sum, a) => sum + (a.nota || 0), 0) / atividadesAnalista.length
          : 0;

        return {
          nome: analista.nome,
          total_atividades: atividadesAnalista.length,
          media_notas: parseFloat(media.toFixed(2)),
          por_tipo: porTipo,
          atividades_detalhadas: atividadesAnalista.map(a => ({
            tipo: a.tipo,
            data: a.data,
            nota: a.nota,
            comentario: a.comentario
          }))
        };
      });

      // 5. Prompt detalhado para IA
      const prompt = `Você é um especialista em gestão de equipes de suporte técnico N1 com conhecimento profundo em ITIL e governança operacional.

**CONTEXTO:**
- Supervisor: ${supervisorLogado.nome}
- Equipe: ${supervisorLogado.equipe}
- Período analisado: ${format(new Date(periodoInicio), 'dd/MM/yyyy')} a ${format(new Date(periodoFim), 'dd/MM/yyyy')}
- Total de analistas: ${analistas.length}
- Total de atividades aprovadas: ${atividadesEquipe.length}

**DADOS DA EQUIPE:**
${JSON.stringify(estatisticasPorAnalista, null, 2)}

**LIMITES OPERACIONAIS POR ANALISTA (IMPORTANTE):**
- Chamados: 1 por dia
- Ligações: 1 por dia
- Monitoria Offline: 1 por dia
- Monitoria Assistida: 1 por semana
- Feedback Individual: 1 por semana

**TAREFA:**
Gere um plano de ação EXTREMAMENTE DETALHADO e estruturado para a semana seguinte. Inclua:

## 1. DIAGNÓSTICO SEMANAL
- Análise dos pontos fortes da equipe
- Identificação dos pontos fracos e gaps
- Riscos operacionais identificados
- Tendências de desempenho

## 2. PRIORIDADES POR TIPO DE ATIVIDADE
Para cada tipo (Chamados, Ligações, Monitorias, Feedback):
- Volume atual vs. esperado
- Qualidade (média de notas)
- Distribuição entre analistas
- Ações corretivas necessárias

## 3. PLANO DIÁRIO (SEGUNDA A SEXTA)
Para cada dia da semana, liste:
- Atividades prioritárias
- Analistas que precisam de atenção
- Monitorias/feedbacks a realizar
- Checkpoints do dia

## 4. MICRO-PLANO POR ANALISTA
Para cada analista:
- Diagnóstico individual
- Principais gaps
- Ações específicas (o que fazer, como fazer, quando fazer)
- Meta para a semana
- Como o supervisor deve atuar

## 5. CHECKLIST OPERACIONAL DO SUPERVISOR
Lista de tarefas diárias e semanais para garantir execução:
- [ ] Tarefas diárias
- [ ] Tarefas semanais
- [ ] Follow-ups necessários

## 6. RECOMENDAÇÕES DE COMUNICAÇÃO
- Como orientar o time
- Como dar feedback construtivo
- Comunicados importantes
- Reuniões necessárias

## 7. INDICADORES DE SUCESSO
Métricas para acompanhar ao final da semana

**IMPORTANTE:**
- Se houver poucos dados, informe o que está faltando e sugira como corrigir
- Seja específico e acionável em todas as recomendações
- Use dados numéricos sempre que possível
- Priorize ações de alto impacto`;

      // 6. Chamar IA
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false
      });

      // 7. Salvar plano
      const novoPlano = await base44.entities.PlanoAcaoIA.create({
        supervisor_id: supervisorLogado.id,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        conteudo: resultado,
        gerado_por: currentUser.email
      });

      return novoPlano;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planoAcao'] });
      toast.success('✅ Plano de ação gerado com sucesso!');
      setGenerating(false);
    },
    onError: (error) => {
      toast.error(`Erro ao gerar plano: ${error.message}`);
      setGenerating(false);
    },
  });

  // Não mostrar se não for supervisor
  if (!supervisorLogado) {
    return null;
  }

  return (
    <Card className="bg-[#0a1628] border-[#1e3a5f] p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#ADF802]/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#ADF802]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Plano de Ação da Semana (IA) – Minha Equipe
            </h3>
            <p className="text-sm text-gray-400">
              <Calendar className="w-3 h-3 inline mr-1" />
              {format(new Date(periodoInicio), 'dd/MM/yyyy')} - {format(new Date(periodoFim), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>
        <Button
          onClick={() => gerarPlanoMutation.mutate()}
          disabled={generating}
          size="sm"
          className="bg-[#ADF802] hover:bg-[#9DE002] text-black gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              {planoAtual ? 'Gerar Novamente' : 'Gerar Plano'}
            </>
          )}
        </Button>
      </div>

      {planoAtual ? (
        <div className="space-y-4">
          <div className="text-xs text-gray-400 flex items-center gap-2 pb-3 border-b border-[#1e3a5f]">
            <AlertCircle className="w-3 h-3" />
            Gerado em {format(new Date(planoAtual.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              className="text-gray-300"
              components={{
                h2: ({ children }) => <h2 className="text-xl font-bold text-[#ADF802] mt-6 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 ml-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 ml-2">{children}</ol>,
                li: ({ children }) => <li className="text-gray-300 text-sm">{children}</li>,
                p: ({ children }) => <p className="text-gray-300 text-sm mb-3">{children}</p>,
                strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
              }}
            >
              {planoAtual.conteudo}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Sparkles className="w-12 h-12 text-[#ADF802] mx-auto mb-4 opacity-50" />
          <p className="text-gray-400 mb-4">
            Ainda não há plano de ação gerado para este período
          </p>
          <Button
            onClick={() => gerarPlanoMutation.mutate()}
            disabled={generating}
            className="bg-[#ADF802] hover:bg-[#9DE002] text-black gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Gerar Plano Agora
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}