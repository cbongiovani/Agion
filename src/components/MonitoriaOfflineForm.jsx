import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const topicos = [
  { key: 'saudacao_padrao', label: '1 - Saudação Padrão de Atendimento', peso: 0.5 },
  { key: 'validacao_loja', label: '2 - Validação da loja e colaborador em linha', peso: 1.0 },
  { key: 'dominio_problema', label: '3 - Domínio/conhecimento do problema', peso: 1.5 },
  { key: 'comunicacao_direta', label: '4 - Comunicação direta e objetiva', peso: 1.0 },
  { key: 'dominio_conclusao', label: '5 - Domínio na condução da ligação', peso: 1.5 },
  { key: 'tratou_respeito', label: '6 - Tratou a loja com respeito', peso: 1.0 },
  { key: 'teve_equilibrio', label: '7 - Teve Equilíbrio Emocional', peso: 1.0 },
  { key: 'ruido_ambiente', label: '8 - Ruído no Ambiente/mutar o telefone', peso: 1.0 },
  { key: 'retorno_loja', label: '9 - Retorno para a loja', peso: 1.0 },
  { key: 'encerramento_padrao', label: '10 - Encerramento Padrão', peso: 0.5 }
];

export default function MonitoriaOfflineForm({ data = {}, onChange, onProtocoloChange, onNotaChange, readOnly = false }) {
  const topicosValues = data;
  
  const handleTopicoChange = (key, value) => {
    if (readOnly) return;
    
    const newData = {
      ...topicosValues,
      [key]: value
    };
    onChange(newData);
    
    // Calcular e atualizar a nota automaticamente
    if (onNotaChange) {
      const nota = calcularNotaTotal(newData);
      onNotaChange(parseFloat(nota));
    }
  };

  const calcularNotaTotal = (dados = topicosValues) => {
    let totalPonderado = 0;
    let pesoTotal = 0;
    
    topicos.forEach((topico) => {
      const valor = dados[topico.key];
      if (valor) {
        totalPonderado += valor * topico.peso;
        pesoTotal += topico.peso;
      }
    });
    
    if (pesoTotal === 0) return '0.00';
    
    // Calcular nota proporcional a 10
    const nota = (totalPonderado / pesoTotal) * 2; // *2 porque escala vai de 1-5 e queremos 0-10
    return Math.min(nota, 10).toFixed(2);
  };

  return (
    <div className="space-y-4">
      {(onProtocoloChange || readOnly) && (
        <div>
          <Label>Protocolo da Gravação</Label>
          <Input
            type="text"
            value={topicosValues.protocolo || ''}
            onChange={(e) => !readOnly && onProtocoloChange && onProtocoloChange(e.target.value)}
            className="bg-[#1a1a1a] border-gray-700 mt-2"
            placeholder="Digite o protocolo"
            disabled={readOnly}
          />
        </div>
      )}

      <div className="border-t border-gray-700 pt-4">
        <Label className="text-base mb-3 block">Tópicos de Avaliação</Label>
        <div className="space-y-1">
          {topicos.map((topico, index) => (
            <div 
              key={topico.key} 
              className={`flex items-center justify-between gap-3 p-2 rounded border border-gray-700/50 ${
                index % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#0d0d0d]'
              }`}
            >
              <Label className="text-xs text-gray-300 flex-1">{topico.label}</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => handleTopicoChange(topico.key, valor)}
                    disabled={readOnly}
                    className={`
                      w-8 h-8 rounded border transition-all text-xs font-semibold
                      ${topicosValues[topico.key] === valor
                        ? 'bg-[#ADF802] border-[#ADF802] text-black'
                        : 'bg-[#242424] border-gray-600 text-gray-400 hover:border-gray-500'
                      }
                      ${readOnly ? 'cursor-default opacity-80' : ''}
                    `}
                  >
                    {valor}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#ADF802]/10 border border-[#ADF802]/30 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-white">Nota Calculada:</span>
          <span className="text-2xl font-bold text-[#ADF802]">{calcularNotaTotal()}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">Nota calculada automaticamente com pesos diferenciados (máximo 10.0)</p>
      </div>
    </div>
  );
}