import React from 'react';
import { Sparkles } from 'lucide-react';

export default function AIRecommendationDisplay({ text }) {
  // Processar o texto em seções
  const parseRecommendations = (text) => {
    const sections = [];
    
    // Padrões comuns de estruturação
    const patterns = [
      { regex: /###\s*(.+?)[\n:]/g, type: 'heading' },
      { regex: /\*\*(.+?)\*\*/g, type: 'bold' },
      { regex: /(?:^|\n)(?:\d+\.|[-•])\s*(.+?)(?=\n|$)/g, type: 'list' },
    ];

    // Dividir por linhas
    const lines = text.split('\n').filter(line => line.trim());
    
    let currentSection = null;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Detectar cabeçalhos (### ou linha que termina com :)
      if (trimmed.startsWith('###') || (trimmed.endsWith(':') && trimmed.length < 80)) {
        if (currentSection) sections.push(currentSection);
        currentSection = {
          type: 'section',
          title: trimmed.replace(/^###\s*/, '').replace(/:$/, ''),
          items: []
        };
      }
      // Detectar itens de lista (começa com número., -, •, ou **)
      else if (/^(?:\d+\.|[-•*])\s/.test(trimmed) || trimmed.startsWith('**')) {
        const content = trimmed
          .replace(/^(?:\d+\.|[-•*])\s*/, '')
          .replace(/^\*\*(.+?)\*\*:?\s*/, '$1: ');
        
        if (currentSection) {
          currentSection.items.push(content);
        } else {
          // Se não há seção atual, criar uma genérica
          if (!currentSection) {
            currentSection = { type: 'section', title: 'Recomendações', items: [] };
          }
          currentSection.items.push(content);
        }
      }
      // Texto normal
      else if (trimmed.length > 0) {
        if (!currentSection) {
          currentSection = { type: 'section', title: 'Análise', items: [] };
        }
        currentSection.items.push(trimmed);
      }
    });
    
    if (currentSection) sections.push(currentSection);
    
    return sections.length > 0 ? sections : [{ type: 'section', title: 'Recomendações', items: [text] }];
  };

  const sections = parseRecommendations(text);

  const getSectionIcon = (title) => {
    const lower = title.toLowerCase();
    if (lower.includes('pontos fracos') || lower.includes('análise')) return '📊';
    if (lower.includes('ações') || lower.includes('ação') || lower.includes('correção')) return '🎯';
    if (lower.includes('treinamento') || lower.includes('específico')) return '📚';
    return '💡';
  };

  const getSectionColor = (title) => {
    const lower = title.toLowerCase();
    if (lower.includes('pontos fracos') || lower.includes('análise')) return 'text-red-400';
    if (lower.includes('ações') || lower.includes('ação')) return 'text-emerald-400';
    if (lower.includes('treinamento')) return 'text-blue-400';
    return 'text-[#ADF802]';
  };

  return (
    <div className="space-y-4">
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{getSectionIcon(section.title)}</span>
            <h4 className={`text-sm font-semibold ${getSectionColor(section.title)}`}>
              {section.title}
            </h4>
          </div>
          <ul className="space-y-2 ml-1">
            {section.items.map((item, itemIndex) => (
              <li key={itemIndex} className="flex items-start gap-2 text-xs text-gray-300">
                <span className="text-gray-500 mt-0.5">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}