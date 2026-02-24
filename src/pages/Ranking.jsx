import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Star, TrendingUp, Award, Loader2, Calendar, Target, Zap } from 'lucide-react';
import { startOfWeek, endOfWeek, getWeek, startOfMonth, endOfMonth, getYear, getMonth } from 'date-fns';

export default function Ranking() {
  const [viewMode, setViewMode] = useState('semanal');
  const [rankingType, setRankingType] = useState('pontos');

  const { data: analistas = [], isLoading: loadingAnalistas } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const { data: atividades = [], isLoading: loadingAtividades } = useQuery({
    queryKey: ['atividades'],
    queryFn: () => base44.entities.Atividade.list(),
  });

  const { data: rankings = [], isLoading: loadingRankings } = useQuery({
    queryKey: ['rankings'],
    queryFn: () => base44.entities.RankingAnalista.list('-pontos_total'),
  });

  const calculateRanking = useMemo(() => {
    if (!analistas.length || !atividades.length) return [];

    const now = new Date();
    const currentYear = getYear(now);
    const currentMonth = getMonth(now) + 1;
    const currentWeek = getWeek(now);

    const analistaStats = analistas.map(analista => {
      // Filtrar atividades por período
      let filteredAtividades = [];
      
      if (viewMode === 'semanal') {
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        filteredAtividades = atividades.filter(a => {
          const ativDate = new Date(a.data);
          return a.analista_id === analista.id && 
                 ativDate >= weekStart && 
                 ativDate <= weekEnd;
        });
      } else if (viewMode === 'mensal') {
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        filteredAtividades = atividades.filter(a => {
          const ativDate = new Date(a.data);
          return a.analista_id === analista.id && 
                 ativDate >= monthStart && 
                 ativDate <= monthEnd;
        });
      } else {
        // Total - todas as atividades
        filteredAtividades = atividades.filter(a => a.analista_id === analista.id);
      }

      const totalAtividades = filteredAtividades.length;
      const media = totalAtividades > 0
        ? filteredAtividades.reduce((sum, a) => sum + (a.nota || 0), 0) / totalAtividades
        : 0;

      // Calcular pontos
      let pontos = 0;
      if (viewMode === 'semanal') {
        if (media >= 9.0) pontos = 200;
        else if (media >= 8.0) pontos = 100;
        else pontos = 0;
      } else if (viewMode === 'mensal') {
        // Soma dos pontos de todas as semanas do mês
        const monthRankings = rankings.filter(r => 
          r.analista_id === analista.id && 
          r.ano === currentYear && 
          r.mes === currentMonth
        );
        pontos = monthRankings.reduce((sum, r) => sum + (r.pontos_semana || 0), 0);
      } else {
        // Total - soma de todos os pontos
        const totalRankings = rankings.filter(r => r.analista_id === analista.id);
        pontos = totalRankings.reduce((sum, r) => sum + (r.pontos_total || 0), 0);
      }

      // Medalhas
      const analistaRankings = rankings.filter(r => r.analista_id === analista.id);
      const medalhasOuro = analistaRankings.reduce((sum, r) => sum + (r.medalhas_ouro || 0), 0);
      const medalhasPrata = analistaRankings.reduce((sum, r) => sum + (r.medalhas_prata || 0), 0);
      const medalhasBronze = analistaRankings.reduce((sum, r) => sum + (r.medalhas_bronze || 0), 0);

      return {
        ...analista,
        media: parseFloat(media.toFixed(2)),
        pontos,
        totalAtividades,
        medalhasOuro,
        medalhasPrata,
        medalhasBronze,
        totalMedalhas: medalhasOuro + medalhasPrata + medalhasBronze
      };
    });

    // Ordenar por tipo de ranking
    if (rankingType === 'pontos') {
      analistaStats.sort((a, b) => b.pontos - a.pontos);
    } else {
      analistaStats.sort((a, b) => {
        if (b.medalhasOuro !== a.medalhasOuro) return b.medalhasOuro - a.medalhasOuro;
        if (b.medalhasPrata !== a.medalhasPrata) return b.medalhasPrata - a.medalhasPrata;
        return b.medalhasBronze - a.medalhasBronze;
      });
    }

    return analistaStats;
  }, [analistas, atividades, rankings, viewMode, rankingType]);

  const getPodiumColor = (position) => {
    switch(position) {
      case 0: return 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/50';
      case 1: return 'from-gray-400/20 to-gray-500/10 border-gray-400/50';
      case 2: return 'from-orange-600/20 to-orange-700/10 border-orange-600/50';
      default: return 'from-[#0a1628]/50 to-[#0a1628]/30 border-[#1e3a5f]';
    }
  };

  const getMedalIcon = (position) => {
    switch(position) {
      case 0: return <Trophy className="w-8 h-8 text-yellow-500" />;
      case 1: return <Medal className="w-8 h-8 text-gray-400" />;
      case 2: return <Award className="w-8 h-8 text-orange-600" />;
      default: return null;
    }
  };

  if (loadingAnalistas || loadingAtividades || loadingRankings) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
          <Trophy className="w-8 h-8 text-[#ADF802]" />
          Ranking de Performance
        </h1>
        <p className="text-gray-400 mt-1">Sistema de gamificação - MMORPG Style</p>
      </div>

      {/* Seletor de Período */}
      <Card className="bg-[#242424] border-gray-800 p-6">
        <div className="flex flex-wrap gap-4">
          <Tabs value={viewMode} onValueChange={setViewMode} className="flex-1">
            <TabsList className="bg-[#1a1a1a] border border-gray-800">
              <TabsTrigger value="semanal" className="data-[state=active]:bg-[#ADF802] data-[state=active]:text-black">
                <Calendar className="w-4 h-4 mr-2" />
                Semanal
              </TabsTrigger>
              <TabsTrigger value="mensal" className="data-[state=active]:bg-[#ADF802] data-[state=active]:text-black">
                <Target className="w-4 h-4 mr-2" />
                Mensal
              </TabsTrigger>
              <TabsTrigger value="total" className="data-[state=active]:bg-[#ADF802] data-[state=active]:text-black">
                <Star className="w-4 h-4 mr-2" />
                Total
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Tabs value={rankingType} onValueChange={setRankingType}>
            <TabsList className="bg-[#1a1a1a] border border-gray-800">
              <TabsTrigger value="pontos" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Zap className="w-4 h-4 mr-2" />
                Pontos
              </TabsTrigger>
              <TabsTrigger value="medalhas" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                <Trophy className="w-4 h-4 mr-2" />
                Medalhas
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Card>

      {/* Regras do Sistema */}
      <Card className="bg-gradient-to-r from-[#ADF802]/10 to-emerald-500/10 border-[#ADF802]/30 p-6">
        <h3 className="font-semibold text-[#ADF802] mb-3 flex items-center gap-2">
          <Star className="w-5 h-5" />
          Regras de Pontuação
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
          <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-3">
            <p className="font-semibold text-yellow-400 mb-1">🔥 Média 9.0 - 10.0</p>
            <p>200 pontos (100 x2)</p>
          </div>
          <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-3">
            <p className="font-semibold text-blue-400 mb-1">💪 Média 8.0 - 8.99</p>
            <p>100 pontos (100 x1)</p>
          </div>
          <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-3">
            <p className="font-semibold text-red-400 mb-1">⚠️ Média &lt; 8.0</p>
            <p>0 pontos</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          💡 Cada semana vale 100 pontos base | Mês com 4 semanas = 400 pts | Mês com 5 semanas = 500 pts
        </p>
      </Card>

      {/* Pódio */}
      {calculateRanking.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 0, 2].map((position) => {
            const analista = calculateRanking[position];
            if (!analista) return null;

            return (
              <Card 
                key={position}
                className={`bg-gradient-to-br ${getPodiumColor(position)} p-6 ${position === 0 ? 'md:order-2 transform md:scale-110' : position === 1 ? 'md:order-1' : 'md:order-3'}`}
              >
                <div className="text-center space-y-3">
                  <div className="flex justify-center">
                    {getMedalIcon(position)}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{analista.nome}</p>
                    <p className="text-sm text-gray-400">#{position + 1} Lugar</p>
                  </div>
                  <div className="space-y-2">
                    {rankingType === 'pontos' ? (
                      <>
                        <div className="bg-[#0a1628] rounded-lg p-3">
                          <p className="text-3xl font-bold text-emerald-400">{analista.pontos}</p>
                          <p className="text-xs text-gray-400">Pontos</p>
                        </div>
                        <div className="text-xs text-gray-400">
                          Média: {analista.media} | {analista.totalAtividades} atividades
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-center gap-3">
                          <div className="bg-[#0a1628] rounded-lg p-2 flex items-center gap-1">
                            <Trophy className="w-4 h-4 text-yellow-500" />
                            <span className="font-bold text-white">{analista.medalhasOuro}</span>
                          </div>
                          <div className="bg-[#0a1628] rounded-lg p-2 flex items-center gap-1">
                            <Medal className="w-4 h-4 text-gray-400" />
                            <span className="font-bold text-white">{analista.medalhasPrata}</span>
                          </div>
                          <div className="bg-[#0a1628] rounded-lg p-2 flex items-center gap-1">
                            <Award className="w-4 h-4 text-orange-600" />
                            <span className="font-bold text-white">{analista.medalhasBronze}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          {analista.pontos} pontos totais
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lista Completa */}
      <Card className="bg-[#242424] border-gray-800 p-6">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          Classificação Completa
        </h3>
        <div className="space-y-3">
          {calculateRanking.map((analista, index) => (
            <div
              key={analista.id}
              className={`p-4 rounded-lg border transition-all hover:scale-[1.02] ${
                index < 3
                  ? `bg-gradient-to-r ${getPodiumColor(index)}`
                  : 'bg-[#1a1a1a] border-gray-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
                    index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                    index === 1 ? 'bg-gray-400/20 text-gray-400' :
                    index === 2 ? 'bg-orange-600/20 text-orange-600' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    #{index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-lg">{analista.nome}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                      <span>Média: {analista.media}</span>
                      <span>•</span>
                      <span>{analista.totalAtividades} atividades</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  {rankingType === 'pontos' ? (
                    <div className="text-right">
                      <p className="text-3xl font-bold text-emerald-400">{analista.pontos}</p>
                      <p className="text-xs text-gray-400">pontos</p>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      {analista.medalhasOuro > 0 && (
                        <div className="flex items-center gap-1 bg-yellow-500/20 px-3 py-1 rounded-lg">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          <span className="font-bold text-white">{analista.medalhasOuro}</span>
                        </div>
                      )}
                      {analista.medalhasPrata > 0 && (
                        <div className="flex items-center gap-1 bg-gray-400/20 px-3 py-1 rounded-lg">
                          <Medal className="w-4 h-4 text-gray-400" />
                          <span className="font-bold text-white">{analista.medalhasPrata}</span>
                        </div>
                      )}
                      {analista.medalhasBronze > 0 && (
                        <div className="flex items-center gap-1 bg-orange-600/20 px-3 py-1 rounded-lg">
                          <Award className="w-4 h-4 text-orange-600" />
                          <span className="font-bold text-white">{analista.medalhasBronze}</span>
                        </div>
                      )}
                      {analista.totalMedalhas === 0 && (
                        <p className="text-gray-500 text-sm">Sem medalhas</p>
                      )}
                    </div>
                  )}
                  {index < 3 && getMedalIcon(index)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}