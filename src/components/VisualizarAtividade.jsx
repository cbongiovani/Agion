import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import MonitoriaOfflineForm from '@/components/MonitoriaOfflineForm';
import MonitoriaAssistidaForm from '@/components/MonitoriaAssistidaForm';
import AtividadeInfoTooltip from '@/components/AtividadeInfoTooltip';

export default function VisualizarAtividade({ 
  atividade, 
  supervisorNome, 
  analistaNome 
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {atividade.codigo_atividade && (
          <div className="sm:col-span-2">
            <Label>Código da Atividade</Label>
            <div className="bg-[#ADF802]/10 border border-[#ADF802]/30 rounded-md p-2 mt-2">
              <p className="text-[#ADF802] font-mono font-bold">{atividade.codigo_atividade}</p>
            </div>
          </div>
        )}
        <div>
          <Label>Data</Label>
          <Input
            type="text"
            value={atividade.data && !isNaN(new Date(atividade.data).getTime()) 
              ? new Date(atividade.data).toLocaleDateString('pt-BR')
              : 'Data inválida'}
            className="bg-[#1a1a1a] border-gray-700 mt-2 text-white"
            readOnly
            disabled
          />
        </div>
        <div>
          <Label className="flex items-center gap-2">
            Tipo de Atividade
            <AtividadeInfoTooltip tipo={atividade.tipo} />
          </Label>
          <Select value={atividade.tipo} disabled>
            <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#242424] border-gray-700">
              <SelectItem value="Chamados">Chamados</SelectItem>
              <SelectItem value="Ligações">Ligações</SelectItem>
              <SelectItem value="Monitoria Offline">Monitoria Offline</SelectItem>
              <SelectItem value="Monitoria Assistida">Monitoria Assistida</SelectItem>
              <SelectItem value="Feedback Individual">Feedback Individual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Analista</Label>
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-md p-2 mt-2">
            <p className="text-white">{analistaNome}</p>
          </div>
        </div>
        <div>
          <Label>Supervisor Responsável</Label>
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-md p-2 mt-2">
            <p className="text-white">{supervisorNome}</p>
          </div>
        </div>
      </div>

      {atividade.tipo === 'Chamados' && atividade.ticket_acompanhado && (
        <div>
          <Label>Ticket</Label>
          <Input
            type="text"
            value={atividade.ticket_acompanhado}
            className="bg-[#1a1a1a] border-gray-700 mt-2 text-white"
            readOnly
            disabled
          />
        </div>
      )}

      {atividade.tipo === 'Ligações' && atividade.protocolo_gravacao && (
        <div>
          <Label>Protocolo da Gravação</Label>
          <Input
            type="text"
            value={atividade.protocolo_gravacao}
            className="bg-[#1a1a1a] border-gray-700 mt-2 text-white"
            readOnly
            disabled
          />
        </div>
      )}

      {atividade.tipo === 'Monitoria Offline' && atividade.topicos_monitoria_offline && (
        <MonitoriaOfflineForm
          data={{
            ...atividade.topicos_monitoria_offline,
            protocolo: atividade.protocolo_gravacao
          }}
          onChange={() => {}}
          readOnly={true}
        />
      )}

      {atividade.tipo === 'Monitoria Assistida' && atividade.topicos_monitoria_assistida && (
        <MonitoriaAssistidaForm
          data={{
            ...atividade.topicos_monitoria_assistida,
            linkGravacao: atividade.link_gravacao_teams
          }}
          onChange={() => {}}
          readOnly={true}
        />
      )}

      {atividade.tipo === 'Feedback Individual' && (
        <div>
          <Label>Tipo de Feedback</Label>
          <Select value={atividade.tipo_feedback} disabled>
            <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#242424] border-gray-700">
              <SelectItem value="Positivo">Positivo</SelectItem>
              <SelectItem value="Negativo">Negativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {atividade.tipo !== 'Monitoria Offline' && atividade.tipo !== 'Monitoria Assistida' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Nota (0-10)</Label>
            <Input
              type="text"
              value={atividade.nota}
              className="bg-[#1a1a1a] border-gray-700 mt-2 text-white"
              readOnly
              disabled
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={atividade.status} disabled>
              <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#242424] border-gray-700">
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Em evolução">Em evolução</SelectItem>
                <SelectItem value="Concluído">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {atividade.comentario && (
        <div>
          <Label>Comentário</Label>
          <Textarea
            value={atividade.comentario}
            className="bg-[#1a1a1a] border-gray-700 mt-2 h-24 text-white"
            readOnly
            disabled
          />
        </div>
      )}

      <div>
        <Label>Registrado Por</Label>
        <div className="bg-[#1a1a1a] border border-gray-700 rounded-md p-2 mt-2">
          <p className="text-white">{atividade.registrado_por || atividade.created_by || '-'}</p>
        </div>
      </div>
    </div>
  );
}