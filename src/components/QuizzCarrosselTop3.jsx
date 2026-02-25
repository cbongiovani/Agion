import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Award } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function QuizzCarrosselTop3() {
  const { data: quizzAtivo } = useQuery({
     queryKey: ['quizzAtivo'],
     queryFn: async () => {
       const quizzes = await base44.entities.QuizzRelampago.list();
       return quizzes.find(q => q.status === 'Ativo') || null;
     },
     staleTime: 10000, // Cache por 10s ao invés de refetch a cada 5s
     refetchInterval: 30000, // Refetch apenas a cada 30s
   });

   const { data: respostasQuizz = [] } = useQuery({
     queryKey: ['respostasQuizzCarrossel', quizzAtivo?.id],
     queryFn: () => base44.entities.RespostaQuizz.filter({ quizz_id: quizzAtivo.id }),
     enabled: !!quizzAtivo,
     staleTime: 10000,
     refetchInterval: 30000,
   });

  const { data: perguntasQuizz = [] } = useQuery({
    queryKey: ['perguntasQuizzCarrossel', quizzAtivo?.id],
    queryFn: () => base44.entities.PerguntaQuizz.filter({ quizz_id: quizzAtivo.id }, 'ordem'),
    enabled: !!quizzAtivo,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuariosCarrossel'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistasCarrossel'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const getTopParticipantes = () => {
    if (!respostasQuizz.length || !perguntasQuizz.length) return [];

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

    return Object.values(rankingMap)
      .filter(p => {
        const respostasDoUser = respostasQuizz.filter(r => r.analista_id === p.analista_id);
        return respostasDoUser.length >= perguntasCount;
      })
      .sort((a, b) => {
        if (b.acertos !== a.acertos) return b.acertos - a.acertos;
        return a.tempoTotal - b.tempoTotal;
      })
      .slice(0, 3);
  };

  const getAnalistaNome = (analistaId, usuarioId) => {
    const usuario = usuarios.find(u => u.id === usuarioId);
    if (usuario?.nome_customizado) return usuario.nome_customizado;
    if (usuario?.full_name) return usuario.full_name;
    const analista = analistas.find(a => a.id === analistaId);
    return analista?.nome || 'Usuário';
  };

  const topParticipantes = getTopParticipantes();

  if (!quizzAtivo || topParticipantes.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Award className="w-4 h-4 text-yellow-400" />
        <p className="text-xs font-semibold text-gray-400 uppercase">Top 3 - {quizzAtivo.titulo}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {topParticipantes.map((participante, index) => (
          <Card
            key={participante.analista_id}
            className={`p-3 text-center ${
              index === 0
                ? 'bg-yellow-500/20 border-yellow-500/50'
                : index === 1
                ? 'bg-gray-400/20 border-gray-400/50'
                : 'bg-amber-600/20 border-amber-600/50'
            }`}
          >
            <div className="flex justify-center mb-1">
              {index === 0 && <span className="text-xl">🥇</span>}
              {index === 1 && <span className="text-xl">🥈</span>}
              {index === 2 && <span className="text-xl">🥉</span>}
            </div>
            <p className="text-xs font-bold text-white truncate">
              {getAnalistaNome(participante.analista_id, participante.usuario_id)}
            </p>
            <p className="text-xs text-gray-300 mt-1">
              {participante.acertos} acertos
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}