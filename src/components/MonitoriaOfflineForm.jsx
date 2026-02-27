import React, { useState } from 'react';
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
  { key: 'encerramento_padrao', label: '10 - Encerramento Padrão', peso: 0.5 },
];

function calcularNota(dados) {
  let totalPonderado = 0;
  let pesoTotal = 0;
  topicos.forEach((t) => {
    const v = dados[t.key];
    if (v) {
      totalPonderado += v * t.peso;
      pesoTotal += t.peso;
    }
  });
  if (pesoTotal === 0) return 0;
  return Math.min((totalPonderado / pesoTotal) * 2, 10);
}

export default function MonitoriaOfflineForm({
  data = {},
  onChange,
  onProtocoloChange,
  onNotaChange,
  readOnly = false,
}) {
  // Estado LOCAL para garantir reatividade dentro do Dialog
  const [valores, setValores] = useState(() => ({ ...data }));
  const [protocolo, setProtocolo] = useState(data.protocolo || '');

  const handleNota = (key, valor) => {
    if (readOnly) return;
    setValores((prev) => {
      const next = { ...prev, [key]: valor };
      onChange && onChange(next);
      const nota = calcularNota(next);
      onNotaChange && onNotaChange(parseFloat(nota.toFixed(2)));
      return next;
    });
  };

  const handleProtocolo = (v) => {
    setProtocolo(v);
    onProtocoloChange && onProtocoloChange(v);
  };

  const notaCalculada = calcularNota(valores).toFixed(2);

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div>
          <Label>Protocolo da Gravação</Label>
          <Input
            type="text"
            value={protocolo}
            onChange={(e) => handleProtocolo(e.target.value)}
            className="bg-[#1a1a1a] border-gray-700 mt-2"
            placeholder="Digite o protocolo"
          />
        </div>
      )}
      {readOnly && data.protocolo && (
        <div>
          <Label>Protocolo da Gravação</Label>
          <div className="bg-[#1a1a1a] border border-gray-700 rounded p-2 mt-2 text-white text-sm">
            {data.protocolo}
          </div>
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
              <span className="text-xs text-gray-300 flex-1">{topico.label}</span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => {
                  const selected = valores[topico.key] === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      disabled={readOnly}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleNota(topico.key, v);
                      }}
                      className={[
                        'w-9 h-9 rounded-md border-2 text-sm font-bold flex items-center justify-center transition-all',
                        selected
                          ? 'bg-[#ADF802] border-[#ADF802] text-black'
                          : 'bg-[#1a1a1a] border-gray-600 text-gray-300 hover:border-[#ADF802]/60 hover:bg-[#242424]',
                        readOnly ? 'cursor-default opacity-70' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#ADF802]/10 border border-[#ADF802]/30 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-white">Nota Calculada:</span>
          <span className="text-2xl font-bold text-[#ADF802]">{notaCalculada}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Nota calculada automaticamente com pesos diferenciados (máximo 10.0)
        </p>
      </div>
    </div>
  );
}