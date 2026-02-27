import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Pencil, Save, X } from 'lucide-react';

const perguntasDefault = [
  {
    key: 'ip_hotline_ata',
    pergunta: '1 - Qual o IP padrão do Hotline ou ATA das Lojas?',
    resposta: '172.30.X.161'
  },
  {
    key: 'opcao_nfe',
    pergunta: '2 - Qual é a opção no VAR 3.0 para emissão de NFE?',
    resposta: 'Menu de apoio / Selecionar registro NFe'
  },
  {
    key: 'consulta_voucher',
    pergunta: '3 - Qual é a opção no LOGIX para consulta de voucher de descontos?',
    resposta: 'LAV0022'
  },
  {
    key: 'inoperancia_tipos',
    pergunta: '4 - Qual a diferença de inoperância parcial e total?',
    resposta: 'Parcial: loja com serviço de pagamento parado ou lentidão. Total: nenhuma forma de pagamento ou erro de abertura'
  },
  {
    key: 'versao_var2',
    pergunta: '5 - Qual a última versão do VAR 2 e função desabilitada?',
    resposta: 'V270 - Emissão de NFe desabilitada'
  },
  {
    key: 'setor_usuario_senha',
    pergunta: '6 - Setor responsável por criação de usuário e senhas no VAR?',
    resposta: 'Financeiro - auditoria.senhas@grupoaavenida.com.br'
  },
  {
    key: 'roleta_avenida',
    pergunta: '7 - O que é e como funciona a roleta avenida?',
    resposta: 'Roleta de descontos com até 3 giros (R$ 3 a R$ 50) - roleta.avenida.com.br'
  },
  {
    key: 'dtef_configuracao',
    pergunta: '8 - Opção no DTEF para consultar cadastro de loja e configurar DPOS?',
    resposta: 'Menu configuração - Lojas'
  },
  {
    key: 'sistema_cobranca',
    pergunta: '9 - Equipe responsável pelo Cobransaas (substituiu Easycollector)?',
    resposta: 'Time de Cobrança'
  },
  {
    key: 'analise_credito',
    pergunta: '10 - Prazo para nova análise após proposta recusada do cartão avenida?',
    resposta: '90 dias'
  }
];

export default function MonitoriaAssistidaForm({ data = {}, onChange, onLinkChange, onNotaChange, readOnly = false }) {
  const [editingKey, setEditingKey] = useState(null);
  const [editData, setEditData] = useState({});
  const topicos = data;

  // Recuperar perguntas salvas ou usar default
  const getPerguntas = () => {
    if (topicos.perguntas && Array.isArray(topicos.perguntas)) {
      return topicos.perguntas;
    }
    return perguntasDefault;
  };

  const perguntas = getPerguntas();

  const handleCheckboxChange = (key, checked) => {
    if (readOnly) return;
    
    const newData = {
      ...topicos,
      [key]: checked
    };
    onChange(newData);
    
    // Calcular e atualizar a nota automaticamente
    if (onNotaChange) {
      const nota = calcularNotaTotal(newData);
      onNotaChange(parseFloat(nota));
    }
  };

  const startEdit = (item) => {
    if (readOnly) return;
    
    setEditingKey(item.key);
    setEditData({
      pergunta: item.pergunta,
      resposta: item.resposta
    });
  };

  const saveEdit = () => {
    const updatedPerguntas = perguntas.map(p => 
      p.key === editingKey 
        ? { ...p, pergunta: editData.pergunta, resposta: editData.resposta }
        : p
    );
    
    onChange({
      ...topicos,
      perguntas: updatedPerguntas
    });
    
    setEditingKey(null);
    setEditData({});
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditData({});
  };

  const calcularNotaTotal = (dados = topicos) => {
    const acertos = perguntas.filter(p => dados[p.key] === true).length;
    return acertos.toFixed(1);
  };

  return (
    <div className="space-y-4">
      {(onLinkChange || readOnly) && (
        <div>
          <Label>Link da Gravação (Teams)</Label>
          <Input
            type="url"
            value={topicos.linkGravacao || ''}
            onChange={(e) => !readOnly && onLinkChange && onLinkChange(e.target.value)}
            className="bg-[#1a1a1a] border-gray-700 mt-2"
            placeholder="https://teams.microsoft.com/..."
            disabled={readOnly}
          />
        </div>
      )}

      <div className="border-t border-gray-700 pt-4">
        <Label className="text-base mb-3 block">Avaliação Técnica - Conhecimento</Label>
        <div className="space-y-4">
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
                    <Button
                      type="button"
                      size="sm"
                      onClick={saveEdit}
                      className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                    >
                      <Save className="w-3 h-3" />
                      Salvar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={cancelEdit}
                      className="border-gray-600 gap-1"
                    >
                      <X className="w-3 h-3" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    disabled={readOnly}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!readOnly) handleCheckboxChange(item.key, !topicos[item.key]);
                    }}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    className={`
                      mt-0.5 w-6 h-6 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all select-none
                      ${topicos[item.key]
                        ? 'bg-[#ADF802] border-[#ADF802] text-black'
                        : 'bg-[#0d0d0d] border-gray-600 hover:border-[#ADF802]/60'
                      }
                      ${readOnly ? 'cursor-default opacity-70' : 'cursor-pointer'}
                    `}
                  >
                    {topicos[item.key] && (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1">
                    <div
                      className="text-sm font-medium text-white cursor-pointer block mb-1 select-none"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!readOnly) handleCheckboxChange(item.key, !topicos[item.key]);
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
                      onClick={() => startEdit(item)}
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
          <span className="text-2xl font-bold text-[#ADF802]">{calcularNotaTotal()}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">1 ponto para cada resposta correta (máximo 10)</p>
      </div>
    </div>
  );
}