import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const perguntas = [
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

export default function MonitoriaAssistidaForm({ topicos = {}, onChange, linkGravacao, onLinkChange }) {
  const handleCheckboxChange = (key, checked) => {
    onChange({
      ...topicos,
      [key]: checked
    });
  };

  const calcularNotaTotal = () => {
    const acertos = Object.values(topicos).filter(v => v === true).length;
    return acertos.toFixed(1);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Link da Gravação (Teams)</Label>
        <Input
          type="url"
          value={linkGravacao}
          onChange={(e) => onLinkChange(e.target.value)}
          className="bg-[#1a1a1a] border-gray-700 mt-2"
          placeholder="https://teams.microsoft.com/..."
        />
      </div>

      <div className="border-t border-gray-700 pt-4">
        <Label className="text-base mb-3 block">Avaliação Técnica - Conhecimento</Label>
        <div className="space-y-4">
          {perguntas.map((item, index) => (
            <div key={item.key} className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={item.key}
                  checked={topicos[item.key] || false}
                  onCheckedChange={(checked) => handleCheckboxChange(item.key, checked)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor={item.key} className="text-sm font-medium text-white cursor-pointer block mb-1">
                    {item.pergunta}
                  </label>
                  <p className="text-xs text-emerald-400">✓ {item.resposta}</p>
                </div>
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
        <p className="text-xs text-gray-400 mt-1">1 ponto para cada resposta correta (máximo 10)</p>
      </div>
    </div>
  );
}