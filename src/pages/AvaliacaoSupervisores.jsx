import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, Zap, Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';

export default function AvaliacaoSupervisores() {
  const [avaliacao, setAvaliacao] = useState(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [generating, setGenerating] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const gerarAvaliacaoMutation = useMutation({
    mutationFn: async (supervisorEmail = null) => {
      setGenerating(true);
      try {
        const url = supervisorEmail
          ? `${base44.functions.baseUrl}/avaliarSupervisoresIA?supervisor_email=${supervisorEmail}`
          : `${base44.functions.baseUrl}/avaliarSupervisoresIA`;

        const response = await base44.functions.invoke('avaliarSupervisoresIA', {
          supervisor_email: supervisorEmail,
        });

        setAvaliacao(response.data.avaliacao);
        toast.success('Avaliação gerada com sucesso!');
      } catch (error) {
        toast.error('Erro ao gerar avaliação: ' + error.message);
      } finally {
        setGenerating(false);
      }
    },
  });

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-400">Acesso restrito a Coordenadores</p>
      </div>
    );
  }

  if (!avaliacao) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Avaliação de Supervisores</h1>
            <p className="text-gray-400 mt-1">Análise de desempenho com recomendações de ação</p>
          </div>
          <Button
            onClick={() => gerarAvaliacaoMutation.mutate()}
            disabled={generating}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {generating ? 'Analisando...' : 'Gerar Avaliação com IA'}
          </Button>
        </div>
      </div>
    );
  }

  const ranking = avaliacao.ranking || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Avaliação de Supervisores</h1>
        <p className="text-gray-400 mt-1">Análise completa de desempenho e recomendações</p>
      </div>

      {/* Resumo Executivo */}
      {avaliacao.resumo_executivo && (
        <Card className="bg-blue-500/10 border-blue-500/30 p-6">
          <h2 className="text-lg font-bold text-blue-400 mb-3">Resumo Executivo</h2>
          <p className="text-gray-300 leading-relaxed">{avaliacao.resumo_executivo}</p>
        </Card>
      )}

      {/* Pontos Positivos & Atenção */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {avaliacao.pontos_positivos && avaliacao.pontos_positivos.length > 0 && (
          <Card className="bg-emerald-500/10 border-emerald-500/30 p-6">
            <h2 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Pontos Positivos
            </h2>
            <ul className="space-y-2">
              {avaliacao.pontos_positivos.map((ponto, i) => (
                <li key={i} className="text-gray-300 flex gap-2">
                  <span className="text-emerald-400">✓</span> {ponto}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {avaliacao.pontos_atencao && avaliacao.pontos_atencao.length > 0 && (
          <Card className="bg-red-500/10 border-red-500/30 p-6">
            <h2 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Pontos de Atenção
            </h2>
            <ul className="space-y-2">
              {avaliacao.pontos_atencao.map((ponto, i) => (
                <li key={i} className="text-gray-300 flex gap-2">
                  <span className="text-red-400">⚠</span> {ponto}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Recomendações */}
      {avaliacao.recomendacoes && avaliacao.recomendacoes.length > 0 && (
        <Card className="bg-purple-500/10 border-purple-500/30 p-6">
          <h2 className="text-lg font-bold text-purple-400 mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Recomendações para Evolução
          </h2>
          <ul className="space-y-2">
            {avaliacao.recomendacoes.map((rec, i) => (
              <li key={i} className="text-gray-300 flex gap-2">
                <span className="text-purple-400">•</span> {rec}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Ranking */}
      {ranking.length > 0 && (
        <Card className="bg-[#0d0d0d] border-gray-800 p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#ADF802]" />
            Ranking da Equipe
          </h2>
          <div className="space-y-3">
            {ranking.map((sup, idx) => (
              <Dialog key={idx}>
                <DialogTrigger asChild>
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 cursor-pointer hover:border-gray-600 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#ADF802]/20 flex items-center justify-center">
                          <span className="text-[#ADF802] font-bold text-lg">#{sup.posicao}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{sup.nome}</h3>
                          <p className="text-sm text-gray-400">{sup.motivo}</p>
                        </div>
                      </div>
                      <Button variant="ghost" className="text-[#ADF802] hover:text-[#ADF802]/80">
                        Gerar Recomendações
                      </Button>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{sup.nome}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Motivo da Classificação</p>
                      <p className="text-gray-300">{sup.motivo}</p>
                    </div>

                    {avaliacao.recomendacoes_individuais &&
                      avaliacao.recomendacoes_individuais[sup.email] && (
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Recomendações Individuais</p>
                          <ul className="space-y-2">
                            {avaliacao.recomendacoes_individuais[sup.email].map((rec, i) => (
                              <li key={i} className="text-gray-300 flex gap-2">
                                <span className="text-[#ADF802]">→</span> {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </Card>
      )}

      {/* Botão Gerar Nova Avaliação */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={() => {
            setAvaliacao(null);
            setSelectedSupervisor(null);
          }}
          variant="outline"
          className="border-gray-700 gap-2"
        >
          Gerar Nova Avaliação
        </Button>
      </div>
    </div>
  );
}