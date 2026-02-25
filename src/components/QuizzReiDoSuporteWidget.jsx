import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Crown, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function QuizzReiDoSuporteWidget() {
  const { data: quizzAtivo } = useQuery({
    queryKey: ['quizzAtivo'],
    queryFn: async () => {
      const quizzes = await base44.entities.QuizzRelampago.list();
      return quizzes.find(q => q.status === 'Ativo') || null;
    },
    refetchInterval: 5000,
  });

  const { data: respostasQuizz = [] } = useQuery({
    queryKey: ['respostasQuizz', quizzAtivo?.id],
    queryFn: () => base44.entities.RespostaQuizz.filter({ quizz_id: quizzAtivo.id }),
    enabled: !!quizzAtivo,
    refetchInterval: 5000,
  });

  const { data: perguntasQuizz = [] } = useQuery({
    queryKey: ['perguntasQuizz', quizzAtivo?.id],
    queryFn: () => base44.entities.PerguntaQuizz.filter({ quizz_id: quizzAtivo.id }, 'ordem'),
    enabled: !!quizzAtivo,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const getTopParticipante = () => {
    if (!respostasQuizz.length || !perguntasQuizz.length) return null;

    const perguntasCount = perguntasQuizz.length;
    const rankingMap = {};

    respostasQuizz.forEach(resposta => {
      if (!rankingMap[resposta.analista_id]) {
        rankingMap[resposta.analista_id] = {
          analista_id: resposta.analista_id,
          usuario_id: resposta.usuario_id,
          acertos: 0,
          tempoTotal: 0,
        };
      }
      if (resposta.correta) rankingMap[resposta.analista_id].acertos += 1;
      rankingMap[resposta.analista_id].tempoTotal += resposta.tempo_resposta_segundos;
    });

    const ranking = Object.values(rankingMap)
      .filter(p => {
        const respostasDoUser = respostasQuizz.filter(r => r.analista_id === p.analista_id);
        return respostasDoUser.length >= perguntasCount;
      })
      .sort((a, b) => {
        if (b.acertos !== a.acertos) return b.acertos - a.acertos;
        return a.tempoTotal - b.tempoTotal;
      })[0];

    return ranking;
  };

  const getAnalistaNome = (analistaId, usuarioId) => {
    const usuario = usuarios.find(u => u.id === usuarioId);
    if (usuario?.nome_customizado) return usuario.nome_customizado;
    if (usuario?.full_name) return usuario.full_name;
    const analista = analistas.find(a => a.id === analistaId);
    return analista?.nome || 'Usuário';
  };

  const topParticipante = getTopParticipante();

  if (!quizzAtivo || !topParticipante) return null;

  return (
    <Card className="bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border-yellow-500/50 p-6 mb-6">
      <div className="flex items-center gap-4">
        <Crown className="w-12 h-12 text-yellow-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs uppercase text-yellow-200 font-semibold">Rei do Suporte</p>
          <p className="text-2xl font-bold text-white mt-1">{getAnalistaNome(topParticipante.analista_id, topParticipante.usuario_id)}</p>
          <p className="text-sm text-yellow-100 mt-1">
            {topParticipante.acertos} acertos • {topParticipante.tempoTotal.toFixed(1)}s no quizz: {quizzAtivo.titulo}
          </p>
        </div>
        <Trophy className="w-16 h-16 text-yellow-400 flex-shrink-0" />
      </div>
    </Card>
  );
}