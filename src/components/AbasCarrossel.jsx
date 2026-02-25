import React from 'react';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

const abasInfo = [
  {
    key: 'dashboard',
    nome: 'Dashboard',
    descricao: 'Painel executivo com visão consolidada de métricas, KPIs e performance geral do Suporte N1.',
    boaPratica: 'Garanta que apenas coordenadores e supervisores tenham acesso para tomada de decisões estratégicas baseadas em dados.'
  },
  {
    key: 'atividades',
    nome: 'Atividades',
    descricao: 'Registro detalhado de todas as atividades realizadas: chamados, ligações, monitorias e feedbacks individuais.',
    boaPratica: 'Permita acesso a supervisores para acompanhamento diário. Use permissões granulares para controlar quem pode criar, editar ou deletar registros.'
  },
  {
    key: 'fechamento_semanal',
    nome: 'Fechamento Semanal',
    descricao: 'Consolidação semanal de métricas por supervisor: ligações, chamados, monitorias, backlog e planos de ação.',
    boaPratica: 'Acesso restrito a supervisores e coordenadores. Essencial para planejamento semanal e identificação de gargalos operacionais.'
  },
  {
    key: 'supervisores',
    nome: 'Supervisores',
    descricao: 'Gestão completa de supervisores: cadastro, edição, visualização de equipes e análise de performance.',
    boaPratica: 'Apenas coordenadores devem ter permissão para criar/editar supervisores. Garante hierarquia organizacional consistente.'
  },
  {
    key: 'analistas',
    nome: 'Analistas',
    descricao: 'Cadastro e gerenciamento de analistas do Suporte N1, incluindo vínculo com supervisores e histórico de atividades.',
    boaPratica: 'Supervisores podem visualizar apenas seus analistas. Coordenadores têm visão global para realocação de recursos.'
  },
  {
    key: 'ranking',
    nome: 'Ranking',
    descricao: 'Gamificação e reconhecimento: ranking de analistas por pontos, medalhas e performance semanal/mensal.',
    boaPratica: 'Visível para todos os usuários. Promove engajamento, competição saudável e reconhecimento público de resultados.'
  },
  {
    key: 'avaliacoes',
    nome: 'Avaliações',
    descricao: 'Sistema de provas técnicas com IA: criação de questões, banco de conhecimento e avaliações trimestrais (AT1-AT4).',
    boaPratica: 'Acesso restrito a coordenadores e supervisores. Mantém integridade das avaliações e impede vazamento de questões.'
  },
  {
    key: 'war_room',
    nome: 'War Room',
    descricao: 'Gestão de incidentes críticos segundo ITIL v4 e ISO 20000: registro, acompanhamento e resolução de emergências.',
    boaPratica: 'Acessível para NOC, supervisores e coordenadores. Centraliza comunicação durante crises e mantém histórico de incidentes.'
  },
  {
    key: 'manual_supervisor',
    nome: 'Manual do Supervisor',
    descricao: 'Base de conhecimento com procedimentos, boas práticas e diretrizes para supervisores do Suporte N1.',
    boaPratica: 'Disponível para supervisores e coordenadores. Padroniza processos e facilita onboarding de novos líderes.'
  },
  {
    key: 'gestao_usuarios',
    nome: 'Gestão de Usuários',
    descricao: 'Controle total de usuários: convites, edição de perfis, definição de permissões granulares por aba e funcionalidade.',
    boaPratica: 'Exclusivo para coordenadores. Centraliza governança de acesso e garante segurança do sistema através do princípio do menor privilégio.'
  },
  {
    key: 'logs',
    nome: 'Logs do Sistema',
    descricao: 'Auditoria completa: registro de todas as ações realizadas no sistema (criação, edição, exclusão, login/logout).',
    boaPratica: 'Acesso exclusivo de coordenadores. Essencial para conformidade, rastreabilidade e investigação de incidentes de segurança.'
  }
];

export default function AbasCarrossel() {
  return (
    <Carousel className="w-full">
      <CarouselContent>
        {abasInfo.map((aba) => (
          <CarouselItem key={aba.key} className="md:basis-1/2 lg:basis-1/3">
            <Card className="bg-[#0f1f35] border-[#1e3a5f] h-full">
              <CardHeader>
                <CardTitle className="text-blue-400 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  {aba.nome}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-1">Descrição:</p>
                  <p className="text-sm text-gray-300">{aba.descricao}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-400 mb-1">Boa Prática:</p>
                  <p className="text-sm text-gray-300">{aba.boaPratica}</p>
                </div>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="bg-[#1e3a5f] border-[#1e3a5f] text-white hover:bg-[#2a4a7f]" />
      <CarouselNext className="bg-[#1e3a5f] border-[#1e3a5f] text-white hover:bg-[#2a4a7f]" />
    </Carousel>
  );
}