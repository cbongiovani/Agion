import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Pencil, Save, X } from 'lucide-react';

const perguntasDefault = [
  { key: 'ip_hotline_ata', pergunta: '1 - Qual o IP padrão do Hotline ou ATA das Lojas?', resposta: '172.30.X.161' },
  { key: 'opcao_nfe', pergunta: '2 - Qual é a opção no VAR 3.0 para emissão de NFE?', resposta: 'Menu de apoio / Selecionar registro NFe' },
  { key: 'consulta_voucher', pergunta: '3 - Qual é a opção no LOGIX para consulta de voucher de descontos?', resposta: 'LAV0022' },
  { key: 'inoperancia_tipos', pergunta: '4 - Qual a diferença de inoperância parcial e total?', resposta: 'Parcial: loja com serviço de pagamento parado ou lentidão. Total: nenhuma forma de pagamento ou erro de abertura' },
  { key: 'versao_var2', pergunta: '5 - Qual a última versão do VAR 2 e função desabilitada?', resposta: 'V270 - Emissão de NFe desabilitada' },
  { key: 'setor_usuario_senha', pergunta: '6 - Setor responsável por criação de usuário e senhas no VAR?', resposta: 'Financeiro - auditoria.senhas@grupoaavenida.com.br' },
  { key: 'roleta_avenida', pergunta: '7 - O que é e como funciona a roleta avenida?', resposta: 'Roleta de descontos com até 3 giros (R$ 3 a R$ 50) - roleta.avenida.com.br' },
  { key: 'dtef_configuracao', pergunta: '8 - Opção no DTEF para consultar cadastro de loja e configurar DPOS?', resposta: 'Menu configuração - Lojas' },
  { key: 'sistema_cobranca', pergunta: '9 - Equipe responsável pelo Cobransaas (substituiu Easycollector)?', resposta: 'Time de Cobrança' },
  { key: 'analise_credito', pergunta: '10 - Prazo para nova análise após proposta recusada do cartão avenida?', resposta: '90 dias' },
];

export default function MonitoriaAssistidaForm({
  data = {},
  onChange,
  onLinkChange,
  onNotaChange,
  readOnly = false,
}) {
  // Estado LOCAL para garantir reatividade dentro do Dialog
  const [respostas, setRespostas] = useState(() => {
    // inicializa marcações existentes
    const init = {};
    perguntasDefault.forEach((p) => {
      init[p.key] = data[p.key] || false;
    });
    return init;
  });

  const [perguntas, setPerguntas] = useState(() => {
    if (data.perguntas && Array.isArray(data.perguntas)) return data.perguntas;
    return perguntasDefault;
  });

  const [link, setLink] = useState(data.linkGravacao || '');
  const [editingKey, setEditingKey] = useState(null);
  const [editData, setEditData] = useState({});

  const calcularNota = (r = respostas) => {
    return perguntas.filter((p) => r[p.key] === true).length;
  };

  const handleToggle = (key) => {
    if (readOnly) return;
    setRespostas((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // propaga para o pai
      const fullData = { ...data, ...next, perguntas };
      onChange && onChange(fullData);
      const nota = perguntas.filter((p) => next[p.key] === true).length;
      onNotaChange && onNotaChange(nota);
      return next;
    });
  };

  const handleLink = (v) => {
    setLink(v);
    onLinkChange && onLinkChange(v);
  };

  const startEdit = (item) => {
    if (readOnly) return;
    setEditingKey(item.key);
    setEditData({ pergunta: item.pergunta, resposta: item.resposta });
  };

  const saveEdit = () => {
    const updated = perguntas.map((p) =>
      p.key === editingKey ? { ...p, ...editData } : p
    );
    setPerguntas(updated);
    const fullData = { ...data, ...respostas, perguntas: updated };
    onChange && onChange(fullData);
    setEditingKey(null);
    setEditData({});
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditData({});
  };

  const notaCalculada = calcularNota();

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div>
          <Label>Link da Gravação (Teams)</Label>
          <Input
            type="url"
            value={link}
            onChange={(e) => handleLink(e.target.value)}
            className="bg-[#1a1a1a] border-gray-700 mt-2"
            placeholder="https://teams.microsoft.com/..."
          />
        </div>
      )}
      {readOnly && data.linkGravacao && (
        <div>
          <Label>Link da Gravação (Teams)</Label>
          <a
            href={data.linkGravacao}
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:underline text-sm block mt-2"
          >
            {data.linkGravacao}
          </a>
        </div>
      )}

      <div className="border-t border-gray-700 pt-4">
        <Label className="text-base mb-3 block">Avaliação Técnica - Conhecimento</Label>
        <div className="space-y-3">
          {perguntas.map((item) => (
            <div key={item.key} className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-4">
              {editingKey === item.key ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-400">Pergunta</Label>
                    <Textarea
                      value={editData.pergunta}
                      onChange={(e) => setEditData({ ...editData, pergunta: e.target.value })}
                      className="bg-[#0d0d0d] border-gray-600 mt-1 text-sm"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Resposta</Label>
                    <Textarea
                      value={editData.resposta}
                      onChange={(e) => setEditData({ ...editData, resposta: e.target.value })}
                      className="bg-[#0d0d0d] border-gray-600 mt-1 text-sm"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={saveEdit} className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                      <Save className="w-3 h-3" /> Salvar
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={cancelEdit} className="border-gray-600 gap-1">
                      <X className="w-3 h-3" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  {/* Botão de checkbox customizado */}
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggle(item.key);
                    }}
                    className={[
                      'mt-0.5 w-6 h-6 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all',
                      respostas[item.key]
                        ? 'bg-[#ADF802] border-[#ADF802] text-black'
                        : 'bg-[#0d0d0d] border-gray-600 hover:border-[#ADF802]/60',
                      readOnly ? 'cursor-default opacity-70' : 'cursor-pointer',
                    ].join(' ')}
                  >
                    {respostas[item.key] && (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1">
                    <div
                      className={`text-sm font-medium text-white mb-1 ${!readOnly ? 'cursor-pointer' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!readOnly) handleToggle(item.key);
                      }}
                    >
                      {item.pergunta}
                    </div>
                    <p className="text-xs text-emerald-400">✓ {item.resposta}</p>
                  </div>

                  {!readOnly && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                      className="text-gray-400 hover:text-white h-8 w-8"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#ADF802]/10 border border-[#ADF802]/30 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-white">Nota Calculada:</span>
          <span className="text-2xl font-bold text-[#ADF802]">{notaCalculada}.0</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">1 ponto para cada resposta correta (máximo 10)</p>
      </div>
    </div>
  );
}