import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, BarChart3, Users, AlertTriangle, Trophy, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardIntro() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      icon: BookOpen,
      title: 'Painel de Governança - N1',
      description: 'Bem-vindo ao sistema de gerenciamento e monitoramento do Suporte N1 do Grupo Agion.',
      highlight: 'Objetivo: Controlar, acompanhar e otimizar as atividades de suporte técnico em tempo real.'
    },
    {
      icon: BarChart3,
      title: 'Atividades',
      description: 'Registre e acompanhe todas as atividades de suporte realizadas pela equipe.',
      details: [
        '📞 Ligações Next IP',
        '🎫 Chamados Verdana',
        '👁️ Monitorias Offline e Assistida',
        '💬 Feedbacks Individuais'
      ]
    },
    {
      icon: Users,
      title: 'Analistas e Supervisores',
      description: 'Gerenciar equipes de analistas e seus supervisores responsáveis.',
      details: [
        'Vincular analistas aos supervisores',
        'Acompanhar performance individual',
        'Avaliar competências técnicas',
        'Gerar relatórios de desenvolvimento'
      ]
    },
    {
      icon: AlertTriangle,
      title: 'War Room',
      description: 'Monitoramento de incidentes e situações críticas que afetam o suporte.',
      details: [
        'Registrar incidentes com severidade',
        'Acompanhar status em tempo real',
        'Documentar ações tomadas',
        'Agilizar resolução de problemas'
      ]
    },
    {
      icon: Trophy,
      title: 'Ranking',
      description: 'Visualizar performance e ranking dos analistas por período.',
      details: [
        'Ranking semanal e mensal',
        'Pontuação e medalhas',
        'Comparação de performance',
        'Reconhecimento de destaque'
      ]
    },
    {
      icon: Settings,
      title: 'Configurações e Relatórios',
      description: 'Acessar relatórios semanais, manuais e configurações do sistema.',
      details: [
        'Fechamento semanal das atividades',
        'Exportar relatórios em PDF',
        'Manual do supervisor',
        'Histórico de logs do sistema'
      ]
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="space-y-8">
      {/* Header Descritivo */}
      <div className="bg-gradient-to-r from-[#0a1628] via-[#0f1f35] to-[#0a1628] border border-[#1e3a5f] rounded-2xl p-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#ADF802]/10 border border-[#ADF802]/30 mb-6">
            <BookOpen className="w-8 h-8 text-[#ADF802]" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Painel de Governança - N1
          </h1>
          <p className="text-lg text-gray-300 mb-4">
            Sistema integrado de gerenciamento e monitoramento do Suporte Técnico
          </p>
          <div className="bg-[#ADF802]/10 border border-[#ADF802]/30 rounded-xl p-4 mt-6">
            <p className="text-[#ADF802] font-semibold text-center">
              🎯 Objetivo Principal: Controlar, acompanhar e otimizar as atividades de suporte em tempo real, garantindo qualidade e eficiência operacional.
            </p>
          </div>
        </div>
      </div>

      {/* Carrossel de Funcionalidades */}
      <div className="bg-[#0d0d0d] border border-[#1e3a5f] rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-white mb-8 text-center">Funcionalidades do Sistema</h2>
        
        <div className="max-w-4xl mx-auto">
          {/* Slide */}
          <div className="min-h-96 flex flex-col justify-center">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* Ícone */}
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-2xl bg-[#ADF802]/10 border border-[#ADF802]/30 flex items-center justify-center">
                  <Icon className="w-12 h-12 text-[#ADF802]" />
                </div>
              </div>

              {/* Conteúdo */}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-3">
                  {slide.title}
                </h3>
                <p className="text-gray-300 text-lg mb-4">
                  {slide.description}
                </p>
                
                {slide.highlight && (
                  <div className="bg-[#ADF802]/5 border border-[#ADF802]/20 rounded-lg p-4 mb-4">
                    <p className="text-[#ADF802] font-semibold">{slide.highlight}</p>
                  </div>
                )}

                {slide.details && (
                  <div className="space-y-2">
                    {slide.details.map((detail, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-[#ADF802] font-bold mt-1">✓</span>
                        <span className="text-gray-300">{detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controles */}
          <div className="flex items-center justify-center gap-6 mt-8">
            <Button
              onClick={prevSlide}
              variant="outline"
              size="icon"
              className="border-[#1e3a5f] hover:bg-[#1e3a5f] min-h-[44px] min-w-[44px]"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            {/* Indicadores */}
            <div className="flex gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentSlide
                      ? 'bg-[#ADF802] w-8'
                      : 'bg-gray-700 w-2 hover:bg-gray-600'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>

            <Button
              onClick={nextSlide}
              variant="outline"
              size="icon"
              className="border-[#1e3a5f] hover:bg-[#1e3a5f] min-h-[44px] min-w-[44px]"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Informação do Slide */}
          <div className="text-center mt-6">
            <p className="text-gray-400 text-sm">
              {currentSlide + 1} de {slides.length}
            </p>
          </div>
        </div>
      </div>

      {/* Cards Informativos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
            <span className="text-xl">📊</span>
            Visibilidade Completa
          </h4>
          <p className="text-gray-300 text-sm">
            Acompanhe todas as atividades da equipe com relatórios detalhados e em tempo real.
          </p>
        </div>

        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
          <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
            <span className="text-xl">🎯</span>
            Controle e Gestão
          </h4>
          <p className="text-gray-300 text-sm">
            Gerencie equipes, analise performance e otimize processos de suporte.
          </p>
        </div>

        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
          <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
            <span className="text-xl">⚡</span>
            Resposta Rápida
          </h4>
          <p className="text-gray-300 text-sm">
            War Room permite identificar e resolver incidentes críticos rapidamente.
          </p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6">
          <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
            <span className="text-xl">🏆</span>
            Reconhecimento
          </h4>
          <p className="text-gray-300 text-sm">
            Ranking de performance motiva a excelência e valoriza destaque da equipe.
          </p>
        </div>
      </div>
    </div>
  );
}