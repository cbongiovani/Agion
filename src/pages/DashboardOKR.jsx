import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { AlertTriangle, TrendingUp, Zap, Loader2, Plus, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardOKR() {
  const queryClient = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedOKR, setSelectedOKR] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: okrs = [], isLoading } = useQuery({
    queryKey: ['okrs'],
    queryFn: () => base44.entities.OKR.list('-created_date'),
  });

  const { data: planosAcao = [] } = useQuery({
    queryKey: ['planosAcao'],
    queryFn: () => base44.entities.PlanoAcaoOKR.list('-created_date'),
  });

  const gerarPlanosMutation = useMutation({
    mutationFn: async () => {
      setAnalyzing(true);
      try {
        const prompt = `Analise estes OKRs e gere planos de ação prioritizados:
${okrs
  .map(
    (o) => `
OKR: ${o.nome}
Status: ${o.status}
Progresso: ${o.valor_atual}/${o.meta_valor} ${o.unidade}
Taxa: ${((o.valor_atual / o.meta_valor) * 100).toFixed(0)}%
${o.status === 'Risco' ? 'EM RISCO - AÇÃO IMEDIATA NECESSÁRIA' : ''}
`
  )
  .join('\n')}

Para CADA OKR em risco ou abaixo de 60%, gere:
1. Um plano de ação prático e executável
2. Prioridade (Crítica se risco, Alta se <60%)
3. 3-5 passos concretos
4. Análise breve das causas raiz

Retorne um JSON array com: [{okr_id, titulo, descricao, prioridade, passos: [], analise}]`;

        const resultado = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            properties: {
              planos: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    okr_id: { type: 'string' },
                    titulo: { type: 'string' },
                    descricao: { type: 'string' },
                    prioridade: { type: 'string' },
                    passos: { type: 'array', items: { type: 'string' } },
                    analise: { type: 'string' },
                  },
                },
              },
            },
          },
        });

        const actor = await base44.auth.me();

        for (const plano of resultado.planos || []) {
          const okrId = okrs.find((o) => o.nome.includes(plano.okr_id))?.id;
          if (okrId) {
            await base44.entities.PlanoAcaoOKR.create({
              okr_id: okrId,
              titulo: plano.titulo,
              descricao: plano.descricao,
              prioridade: plano.prioridade,
              passos: plano.passos || [],
              analise_ia: plano.analise,
              responsavel: actor.email,
              status: 'Planejado',
              data_criacao: new Date().toISOString(),
              gerado_por_ia: true,
            });
          }
        }

        await base44.entities.Log.create({
          usuario_email: actor.email,
          usuario_nome: actor.full_name,
          acao: 'Criou',
          entidade: 'PlanoAcaoOKR',
          detalhes: `Gerou ${resultado.planos?.length || 0} planos de ação via IA`,
        });

        toast.success(`${resultado.planos?.length || 0} planos de ação gerados!`);
        queryClient.invalidateQueries({ queryKey: ['planosAcao'] });
      } catch (error) {
        toast.error('Erro ao gerar planos: ' + error.message);
      } finally {
        setAnalyzing(false);
      }
    },
  });

  const getStatusColor = (status) => {
    const colors = {
      'No Alvo': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      'Em Progresso': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      Risco: 'bg-red-500/20 text-red-400 border-red-500/30',
      Concluído: 'bg-green-500/20 text-green-400 border-green-500/30',
    };
    return colors[status] || colors['Em Progresso'];
  };

  const getPrioridadeColor = (pri) => {
    const colors = {
      Crítica: 'bg-red-600 text-white',
      Alta: 'bg-orange-600 text-white',
      Média: 'bg-yellow-600 text-white',
      Baixa: 'bg-blue-600 text-white',
    };
    return colors[pri] || colors.Média;
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-400">Acesso restrito a Coordenadores</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const okrsEmRisco = okrs.filter((o) => o.status === 'Risco' || (o.valor_atual / o.meta_valor) * 100 < 60);
  const planosEmRisco = planosAcao.filter((p) => p.prioridade === 'Crítica' || p.prioridade === 'Alta');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard KPI & OKR</h1>
          <p className="text-gray-400 mt-1">Métricas de desempenho e objetivos estratégicos</p>
        </div>
        <Button onClick={() => gerarPlanosMutation.mutate()} disabled={analyzing} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {analyzing ? 'Analisando...' : 'Gerar Planos com IA'}
        </Button>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {okrs.slice(0, 4).map((okr) => {
          const progresso = ((okr.valor_atual / okr.meta_valor) * 100).toFixed(0);
          return (
            <Card key={okr.id} className="bg-[#0d0d0d] border-gray-800 p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-gray-400">{okr.categoria}</p>
                <span className={`text-xs font-bold px-2 py-1 rounded border ${getStatusColor(okr.status)}`}>{progresso}%</span>
              </div>
              <h3 className="text-white font-semibold text-sm mb-3">{okr.nome}</h3>
              <div className="bg-gray-900 rounded h-2 mb-2">
                <div className="bg-[#ADF802] h-2 rounded transition-all" style={{ width: `${Math.min(progresso, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-500">
                {okr.valor_atual} / {okr.meta_valor} {okr.unidade}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Alertas de Risco */}
      {okrsEmRisco.length > 0 && (
        <Card className="bg-red-500/10 border-red-500/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-400 mb-2">{okrsEmRisco.length} OKR(s) em Risco</h3>
              <div className="text-sm text-red-300">
                {okrsEmRisco.map((o) => (
                  <p key={o.id}>• {o.nome}: {((o.valor_atual / o.meta_valor) * 100).toFixed(0)}% do alvo</p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Objetivos & Resultados */}
      <Card className="bg-[#0d0d0d] border-gray-800 p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#ADF802]" />
          Objetivos & Resultados (OKRs)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {okrs.map((okr) => (
            <div key={okr.id} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2">{okr.nome}</h3>
              <p className="text-xs text-gray-400 mb-3">{okr.descricao}</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Progresso</span>
                  <span className="text-white font-bold">{((okr.valor_atual / okr.meta_valor) * 100).toFixed(0)}%</span>
                </div>
                <div className="bg-gray-900 rounded h-1.5">
                  <div className="bg-[#ADF802] h-1.5 rounded" style={{ width: `${((okr.valor_atual / okr.meta_valor) * 100).toFixed(0)}%` }} />
                </div>
                <p className="text-xs text-gray-500">
                  {okr.valor_atual} / {okr.meta_valor} {okr.unidade}
                </p>
                <span className={`inline-block text-xs font-bold px-2 py-1 rounded border mt-2 ${getStatusColor(okr.status)}`}>
                  {okr.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Planos de Ação */}
      <Card className="bg-[#0d0d0d] border-gray-800 p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          Planos de Ação ({planosAcao.length})
        </h2>
        {planosAcao.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Nenhum plano gerado. Use o botão "Gerar Planos com IA" acima.</p>
        ) : (
          <div className="space-y-3">
            {planosEmRisco.slice(0, 5).map((plano) => (
              <Dialog key={plano.id}>
                <DialogTrigger asChild>
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 cursor-pointer hover:border-gray-600 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-white">{plano.titulo}</h3>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${getPrioridadeColor(plano.prioridade)}`}>
                        {plano.prioridade}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{plano.descricao.substring(0, 100)}...</p>
                  </div>
                </DialogTrigger>
                <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{plano.titulo}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Prioridade</p>
                      <span className={`inline-block text-xs font-bold px-3 py-1 rounded ${getPrioridadeColor(plano.prioridade)}`}>
                        {plano.prioridade}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Descrição</p>
                      <p className="text-white">{plano.descricao}</p>
                    </div>
                    {plano.analise_ia && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Análise IA</p>
                        <p className="text-gray-300 text-sm">{plano.analise_ia}</p>
                      </div>
                    )}
                    {plano.passos?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Passos de Execução</p>
                        <ol className="space-y-1 text-sm text-gray-300">
                          {plano.passos.map((passo, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-[#ADF802] font-bold">{i + 1}.</span> {passo}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}