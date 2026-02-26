import React, { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

const ORIENTACOES = {
  'Chamados': {
    titulo: 'Chamados Verdana',
    descricao: 'Atendimento de tickets técnicos via sistema Verdana. Avalie clareza, tempo de resolução e qualidade técnica.',
    focoAvaliacao: ['Resolução efetiva', 'Documentação adequada', 'Tempo de resposta', 'Satisfação do cliente'],
  },
  'Ligações': {
    titulo: 'Ligações Next IP',
    descricao: 'Atendimento telefônico via sistema Next IP. Avalie comunicação, empatia e resolução no primeiro contato.',
    focoAvaliacao: ['Tom de voz', 'Empatia', 'Clareza na comunicação', 'FCR (First Call Resolution)'],
  },
  'Monitoria Offline': {
    titulo: 'Monitoria Offline',
    descricao: 'Análise de atendimentos gravados/registrados. Permite avaliação detalhada de processos e scripts.',
    focoAvaliacao: ['Seguimento de processos', 'Uso de scripts', 'Qualidade técnica', 'Conformidade'],
  },
  'Monitoria Assistida': {
    titulo: 'Monitoria Assistida',
    descricao: 'Acompanhamento ao vivo de atendimentos. Permite orientação em tempo real e correção imediata.',
    focoAvaliacao: ['Aplicação imediata', 'Adaptabilidade', 'Resposta ao feedback', 'Confiança'],
  },
  'Feedback Individual': {
    titulo: 'Feedback Individual (1:1)',
    descricao: 'Reunião individual para discussão de performance, pontos de melhoria e plano de desenvolvimento.',
    focoAvaliacao: ['Receptividade', 'Comprometimento', 'Evolução', 'Definição de metas'],
  },
};

export default function AtividadeInfoTooltip({ tipo, modalOpen }) {
  const info = ORIENTACOES[tipo];
  const [open, setOpen] = useState(false);

  if (!info) return null;

  // Sempre que o modal abrir, tooltip começa fechada
  useEffect(() => {
    if (modalOpen) {
      setOpen(false);
    }
  }, [modalOpen]);

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((prev) => !prev);
            }}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
          >
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>

        <TooltipContent
          side="right"
          className="bg-[#1a1a1a] border-gray-700 max-w-xs"
          onPointerDownOutside={() => setOpen(false)}
        >
          <div className="space-y-2">
            <h4 className="font-semibold text-white">{info.titulo}</h4>
            <p className="text-sm text-gray-300">{info.descricao}</p>

            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs font-medium text-gray-400 mb-1">
                Foco da avaliação:
              </p>
              <ul className="space-y-1">
                {info.focoAvaliacao.map((foco, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-gray-400 flex items-center gap-1"
                  >
                    <span className="w-1 h-1 rounded-full bg-blue-400" />
                    {foco}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}