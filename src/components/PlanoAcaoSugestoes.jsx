import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function gerarSugestoes(analista, atividades) {
  const sugestoes = [];
  
  const media = atividades.length > 0 
    ? atividades.reduce((sum, a) => sum + (a.nota || 0), 0) / atividades.length 
    : 0;

  const ultimas5 = atividades.slice(0, 5);
  const mediaRecente = ultimas5.length > 0
    ? ultimas5.reduce((sum, a) => sum + (a.nota || 0), 0) / ultimas5.length
    : 0;

  const tendencia = mediaRecente - media;
  
  // Análise por tipo de atividade
  const tiposAtividade = {
    'Chamados': atividades.filter(a => a.tipo === 'Chamados'),
    'Ligações': atividades.filter(a => a.tipo === 'Ligações'),
    'Monitoria Offline': atividades.filter(a => a.tipo === 'Monitoria Offline'),
    'Monitoria Assistida': atividades.filter(a => a.tipo === 'Monitoria Assistida'),
    'Feedback Individual': atividades.filter(a => a.tipo === 'Feedback Individual'),
  };

  const mediasPorTipo = {};
  Object.entries(tiposAtividade).forEach(([tipo, ativs]) => {
    if (ativs.length > 0) {
      mediasPorTipo[tipo] = ativs.reduce((sum, a) => sum + (a.nota || 0), 0) / ativs.length;
    }
  });

  // Sugestões baseadas na performance geral
  if (media < 6) {
    sugestoes.push({
      tipo: 'urgente',
      titulo: 'Ação Imediata Necessária',
      descricao: 'Performance abaixo do esperado. Agende reunião individual urgente.',
      acoes: [
        'Agendar 1:1 para identificar causas raiz',
        'Revisar últimos 5 atendimentos em detalhe',
        'Elaborar PIP (Plano de Melhoria de Performance)',
        'Aumentar frequência de monitorias para 2x/semana',
      ],
    });
  } else if (media < 7.5) {
    sugestoes.push({
      tipo: 'atencao',
      titulo: 'Necessita Acompanhamento',
      descricao: 'Performance dentro do mínimo, mas há espaço para desenvolvimento.',
      acoes: [
        'Realizar feedback individual focado em pontos específicos',
        'Monitorar evolução nas próximas 2 semanas',
        'Oferecer treinamento adicional em áreas críticas',
        'Estabelecer metas incrementais de melhoria',
      ],
    });
  } else if (media >= 8.5) {
    sugestoes.push({
      tipo: 'sucesso',
      titulo: 'Alta Performance',
      descricao: 'Analista demonstra excelência. Considerar para desenvolvimento avançado.',
      acoes: [
        'Reconhecer publicamente as conquistas',
        'Considerar para programa de mentoria',
        'Avaliar potencial para assumir casos complexos',
        'Oportunidade para liderar treinamentos da equipe',
      ],
    });
  }

  // Análise de tendência
  if (tendencia < -0.5) {
    sugestoes.push({
      tipo: 'atencao',
      titulo: 'Queda Recente de Performance',
      descricao: 'Notas recentes indicam declínio. Investigar causas.',
      acoes: [
        'Conversa individual para identificar dificuldades',
        'Verificar se há sobrecarga ou problemas pessoais',
        'Revisar mudanças recentes em processos',
        'Considerar redistribuição de demandas',
      ],
    });
  } else if (tendencia > 0.5) {
    sugestoes.push({
      tipo: 'sucesso',
      titulo: 'Evolução Positiva',
      descricao: 'Performance em ascensão. Reforçar comportamentos positivos.',
      acoes: [
        'Elogiar melhoria e identificar o que está funcionando',
        'Manter acompanhamento para consolidar evolução',
        'Considerar aumento gradual de responsabilidades',
      ],
    });
  }

  // Análise por tipo de atividade
  const tipoMaisBaixo = Object.entries(mediasPorTipo).sort((a, b) => a[1] - b[1])[0];
  if (tipoMaisBaixo && tipoMaisBaixo[1] < 7) {
    const tipoMap = {
      'Chamados': 'atendimento escrito e documentação técnica',
      'Ligações': 'comunicação verbal e rapport telefônico',
      'Monitoria Offline': 'seguimento de processos e scripts',
      'Monitoria Assistida': 'performance ao vivo sob supervisão',
      'Feedback Individual': 'receptividade e aplicação de orientações',
    };

    sugestoes.push({
      tipo: 'atencao',
      titulo: `Foco em ${tipoMaisBaixo[0]}`,
      descricao: `Performance mais baixa em ${tipoMaisBaixo[0]} (média ${tipoMaisBaixo[1].toFixed(1)}).`,
      acoes: [
        `Treinamento específico em ${tipoMap[tipoMaisBaixo[0]]}`,
        'Acompanhamento semanal deste tipo de atividade',
        'Fornecer materiais de referência adicionais',
        'Estabelecer meta de melhoria de 1 ponto em 30 dias',
      ],
    });
  }

  // Análise de frequência de feedbacks
  const feedbacks = tiposAtividade['Feedback Individual'];
  const diasDesdeUltimoFeedback = feedbacks.length > 0
    ? Math.floor((new Date() - new Date(feedbacks[0].data)) / (1000 * 60 * 60 * 24))
    : 999;

  if (diasDesdeUltimoFeedback > 30) {
    sugestoes.push({
      tipo: 'atencao',
      titulo: 'Feedback Individual Pendente',
      descricao: diasDesdeUltimoFeedback > 60 
        ? 'Mais de 60 dias sem feedback individual.'
        : 'Há mais de 30 dias sem feedback individual.',
      acoes: [
        'Agendar 1:1 o mais breve possível',
        'Preparar pauta com pontos de melhoria e reconhecimentos',
        'Estabelecer frequência regular de feedbacks (quinzenal ou mensal)',
      ],
    });
  }

  return sugestoes;
}

export default function PlanoAcaoSugestoes({ analista, atividades }) {
  const [expandido, setExpandido] = useState(false);
  const sugestoes = gerarSugestoes(analista, atividades);

  if (sugestoes.length === 0) return null;

  const iconePorTipo = {
    urgente: AlertTriangle,
    atencao: Lightbulb,
    sucesso: CheckCircle,
  };

  const corPorTipo = {
    urgente: 'text-red-400 bg-red-500/20 border-red-500/30',
    atencao: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
    sucesso: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  };

  return (
    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Plano de Ação Inteligente</h3>
            <p className="text-sm text-gray-400">{sugestoes.length} sugestões geradas</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpandido(!expandido)}
          className="text-blue-400 hover:text-blue-300"
        >
          {expandido ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              Recolher
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />
              Ver Detalhes
            </>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 overflow-hidden"
          >
            {sugestoes.map((sugestao, index) => {
              const Icone = iconePorTipo[sugestao.tipo];
              return (
                <div
                  key={index}
                  className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-800"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${corPorTipo[sugestao.tipo]}`}>
                      <Icone className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{sugestao.titulo}</h4>
                      <p className="text-sm text-gray-400 mt-1">{sugestao.descricao}</p>
                    </div>
                  </div>
                  <div className="ml-11 space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Ações Recomendadas:</p>
                    <ul className="space-y-2">
                      {sugestao.acoes.map((acao, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                          {acao}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}