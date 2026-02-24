import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const topicos = [
  { key: 'saudacao_padrao', label: '1 - Saudação Padrão de Atendimento', max: 5 },
  { key: 'validacao_loja', label: '2 - Validação da loja e colaborador em linha', max: 5 },
  { key: 'dominio_problema', label: '3 - Domínio/conhecimento do problema', max: 5 },
  { key: 'comunicacao_direta', label: '4 - Comunicação direta e objetiva', max: 5 },
  { key: 'dominio_conclusao', label: '5 - Domínio na condução da ligação', max: 5 },
  { key: 'tratou_respeito', label: '6 - Tratou a loja com respeito', max: 5 },
  { key: 'teve_equilibrio', label: '7 - Teve Equilíbrio Emocional', max: 5 },
  { key: 'ruido_ambiente', label: '8 - Ruído no Ambiente/mutar o telefone', max: 5 },
  { key: 'retorno_loja', label: '9 - Retorno para a loja', max: 2 },
  { key: 'encerramento_padrao', label: '10 - Encerramento Padrão', max: 5 }
];

export default function MonitoriaOfflineForm({ topicos: topicosValues = {}, onChange, protocolo, onProtocoloChange }) {
  const handleTopicoChange = (key, value) => {
    const numValue = parseFloat(value) || 0;
    onChange({
      ...topicosValues,
      [key]: numValue
    });
  };

  const calcularNotaTotal = () => {
    const total = topicos.reduce((sum, topico) => {
      return sum + (topicosValues[topico.key] || 0);
    }, 0);
    return ((total / 47) * 10).toFixed(2); // 47 é a soma máxima possível
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Protocolo da Gravação</Label>
        <Input
          type="text"
          value={protocolo}
          onChange={(e) => onProtocoloChange(e.target.value)}
          className="bg-[#1a1a1a] border-gray-700 mt-2"
          placeholder="Digite o protocolo"
        />
      </div>

      <div className="border-t border-gray-700 pt-4">
        <Label className="text-base mb-3 block">Tópicos de Avaliação</Label>
        <div className="space-y-3">
          {topicos.map((topico) => (
            <div key={topico.key} className="grid grid-cols-[1fr,100px] gap-3 items-center">
              <Label className="text-sm text-gray-300">{topico.label}</Label>
              <Input
                type="number"
                min="0"
                max={topico.max}
                step="0.5"
                value={topicosValues[topico.key] || ''}
                onChange={(e) => handleTopicoChange(topico.key, e.target.value)}
                className="bg-[#1a1a1a] border-gray-700"
                placeholder={`0-${topico.max}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#ADF802]/10 border border-[#ADF802]/30 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-white">Nota Calculada:</span>
          <span className="text-2xl font-bold text-[#ADF802]">{calcularNotaTotal()}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">Nota calculada automaticamente com base nos tópicos</p>
      </div>
    </div>
  );
}