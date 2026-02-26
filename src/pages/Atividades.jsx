import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Filter, Loader2, Eye, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateToInput, getLocalDateString, ensureCorrectDate } from '@/components/dateUtils';
import { notificarCoordenadores } from '@/components/notificationHelper';
import AtividadeInfoTooltip from '@/components/AtividadeInfoTooltip';
import MonitoriaOfflineForm from '@/components/MonitoriaOfflineForm';
import MonitoriaAssistidaForm from '@/components/MonitoriaAssistidaForm';

export default function Atividades() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAtividade, setEditingAtividade] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedType, setSelectedType] = useState('Chamados');
  const [viewingAtividade, setViewingAtividade] = useState(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  
  // Filtros
  const [filterSupervisor, setFilterSupervisor] = useState('');
  const [filterAnalista, setFilterAnalista] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [filterIdBusca, setFilterIdBusca] = useState('');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: permissoesUsuario } = useQuery({
    queryKey: ['permissoesUsuario', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;
      const perms = await base44.entities.PermissaoUsuario.filter({ usuario_email: currentUser.email });
      return perms.length > 0 ? perms[0] : null;
    },
    enabled: !!currentUser?.email,
  });

  const canCreate = currentUser?.role === 'admin' || permissoesUsuario?.permissoes_atividades?.criar || false;
  const canEdit = currentUser?.role === 'admin' || permissoesUsuario?.permissoes_atividades?.editar || false;
  const canDelete = currentUser?.role === 'admin' || permissoesUsuario?.permissoes_atividades?.deletar || false;

  const [formData, setFormData] = useState({
    tipo: 'Chamados',
    analista_id: '',
    supervisor_id: '',
    protocolo_gravacao: '',
    link_gravacao_teams: '',
    ticket_acompanhado: '',
    tipo_feedback: '',
    topicos_monitoria_offline: {},
    topicos_monitoria_assistida: {},
    nota: '',
    comentario: '',
    status: 'Aberto',
  });

  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => {
      const todasAtividades = await base44.entities.Atividade.list('-created_date');
      
      // Admin e Supervisor veem tudo
      if (currentUser?.role === 'admin' || currentUser?.role === 'supervisor') {
        return todasAtividades;
      }
      
      // Outros usuários veem apenas aprovadas
      const aprovacoes = await base44.entities.AprovacaoAtividade.filter({ tipo: 'atividade' });
      const aprovadas = aprovacoes
        .filter(a => a.status === 'aprovado')
        .map(a => a.atividade_id);
      
      return todasAtividades.filter(ativ => aprovadas.includes(ativ.id));
    },
    enabled: !!currentUser,
  });

  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Gerar código automático baseado no tipo
      const prefixos = {
        'Chamados': 'CH',
        'Ligações': 'LG',
        'Monitoria Offline': 'MO',
        'Monitoria Assistida': 'MA',
        'Feedback Individual': 'FB'
      };
      
      // Buscar última atividade do mesmo tipo para gerar próximo número (com retry para race condition)
      let codigoAtividade;
      let tentativas = 0;
      const maxTentativas = 3;
      
      while (tentativas < maxTentativas) {
        try {
          const atividadesMesmoTipo = await base44.entities.Atividade.filter({ tipo: data.tipo });
          const codigosExistentes = atividadesMesmoTipo
            .map(a => a.codigo_atividade)
            .filter(c => c && c.startsWith(prefixos[data.tipo]));
          
          let proximoNumero = 1;
          if (codigosExistentes.length > 0) {
            const numeros = codigosExistentes.map(c => parseInt(c.slice(2)));
            proximoNumero = Math.max(...numeros) + 1;
          }
          
          codigoAtividade = `${prefixos[data.tipo]}${String(proximoNumero).padStart(5, '0')}`;
          
          // Tentar criar - se código duplicado, vai dar erro e retry
          const result = await base44.entities.Atividade.create({
            ...data,
            codigo_atividade: codigoAtividade
          });
          
          // Se chegou aqui, sucesso - sair do loop
          tentativas = maxTentativas;
          
          const user = await base44.auth.me();
          
          // Criar registro de aprovação
          await base44.entities.AprovacaoAtividade.create({
            atividade_id: result.id,
            tipo: 'atividade',
            status: 'pendente'
          });
          
          await base44.entities.Log.create({
            usuario_email: user.email,
            usuario_nome: user.full_name,
            acao: 'Criou',
            entidade: 'Atividade',
            detalhes: `Registrou atividade ${codigoAtividade} do tipo ${data.tipo}`,
          });

          await notificarCoordenadores(
            'nova_atividade',
            'Nova Atividade Registrada',
            `${user.full_name} registrou uma nova atividade ${codigoAtividade} do tipo ${data.tipo} - Aguardando aprovação`,
            'Aprovacao'
          );

          return result;
        } catch (error) {
          tentativas++;
          if (tentativas >= maxTentativas) {
            throw error;
          }
          // Pequeno delay antes de retry
          await new Promise(resolve => setTimeout(resolve, 100 * tentativas));
        }
      }
    },
    onSuccess: () => {
      // Fechar dialog de registro IMEDIATAMENTE
      setIsDialogOpen(false);
      resetForm();
      
      // Mostrar dialog de sucesso GARANTIDO
      setShowSuccessDialog(true);
    },
    onError: (error) => {
      toast.error('❌ Erro ao registrar atividade', {
        description: error.message || 'Tente novamente',
        duration: 5000,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const result = await base44.entities.Atividade.update(id, data);
      const user = await base44.auth.me();
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'Atividade',
        detalhes: `Atualizou atividade`,
      });
      return result;
    },
    onSuccess: () => {
      // Fechar dialog e resetar
      setIsDialogOpen(false);
      resetForm();
      
      // Mostrar dialog de sucesso
      setShowSuccessDialog(true);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const user = await base44.auth.me();
      await base44.entities.Atividade.delete(id);
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Excluiu',
        entidade: 'Atividade',
        detalhes: `Excluiu atividade`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade excluída com sucesso!');
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setFormData({
      tipo: 'Chamados',
      analista_id: '',
      supervisor_id: '',
      protocolo_gravacao: '',
      link_gravacao_teams: '',
      ticket_acompanhado: '',
      tipo_feedback: '',
      topicos_monitoria_offline: {},
      topicos_monitoria_assistida: {},
      nota: '',
      comentario: '',
      status: 'Aberto',
    });
    setEditingAtividade(null);
    setIsDialogOpen(false);
    setSelectedType('Chamados');
  };

  const limparFiltros = () => {
    setFilterSupervisor('');
    setFilterAnalista('');
    setFilterTipo('');
    setFilterDataInicio('');
    setFilterDataFim('');
    setFilterIdBusca('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Prevenir múltiplos envios
    if (createMutation.isPending || updateMutation.isPending) {
      return;
    }

    const payload = {
      ...formData,
      // Sempre usa a data atual de registro para novas atividades
      data: editingAtividade ? ensureCorrectDate(formData.data) : formatDateToInput(new Date()),
      nota: parseFloat(formData.nota) || 0,
    };

    if (editingAtividade) {
      updateMutation.mutate({ id: editingAtividade.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEdit = (atividade) => {
    setEditingAtividade(atividade);
    setFormData({
      data: atividade.data,
      tipo: atividade.tipo,
      analista_id: atividade.analista_id || '',
      supervisor_id: atividade.supervisor_id || '',
      protocolo_gravacao: atividade.protocolo_gravacao || '',
      link_gravacao_teams: atividade.link_gravacao_teams || '',
      ticket_acompanhado: atividade.ticket_acompanhado || '',
      tipo_feedback: atividade.tipo_feedback || '',
      topicos_monitoria_offline: atividade.topicos_monitoria_offline || {},
      topicos_monitoria_assistida: atividade.topicos_monitoria_assistida || {},
      nota: atividade.nota?.toString() || '',
      comentario: atividade.comentario || '',
      status: atividade.status || 'Aberto',
    });
    setSelectedType(atividade.tipo);
    setIsDialogOpen(true);
  };

  const getSupervisorNome = (id) => {
    const supervisor = supervisores.find(s => s.id === id);
    const usuario = usuarios.find(u => u.email === supervisor?.usuario_email);
    return usuario?.nome_customizado || usuario?.full_name || supervisor?.nome || '-';
  };

  const getAnalistaNome = (id) => {
    const analista = analistas.find(a => a.id === id);
    const usuario = usuarios.find(u => u.email === analista?.usuario_email);
    return usuario?.nome_customizado || usuario?.full_name || analista?.nome || '-';
  };

  const handleAnalistaChange = (analistaId) => {
    const analista = analistas.find(a => a.id === analistaId);
    setFormData({
      ...formData,
      analista_id: analistaId,
      supervisor_id: analista?.supervisor_id || ''
    });
  };

  const handleTipoChange = (tipo) => {
    setSelectedType(tipo);
    setFormData({ ...formData, tipo });
  };

  const getTipoColor = (tipo) => {
    const colors = {
      'Chamados': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Ligações': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      'Monitoria Offline': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Monitoria Assistida': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'Feedback Individual': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    };
    return colors[tipo] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getNotaBadgeColor = (nota) => {
    if (nota >= 9) return 'bg-emerald-500 text-white';
    if (nota >= 7) return 'bg-yellow-500 text-black';
    return 'bg-red-500 text-white';
  };

  const getStatusColor = (status) => {
    if (status === 'Concluído') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (status === 'Em evolução') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const atividadesFiltradas = atividades.filter(ativ => {
    if (filterIdBusca && !ativ.codigo_atividade?.toLowerCase().includes(filterIdBusca.toLowerCase())) return false;
    if (filterSupervisor && ativ.supervisor_id !== filterSupervisor) return false;
    if (filterAnalista && ativ.analista_id !== filterAnalista) return false;
    if (filterTipo && ativ.tipo !== filterTipo) return false;
    if (filterDataInicio && ativ.data < filterDataInicio) return false;
    if (filterDataFim && ativ.data > filterDataFim) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Atividades</h1>
          <p className="text-gray-400 mt-1">Registre e gerencie as atividades do Suporte N1</p>
        </div>
        {canCreate && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!open) resetForm();
            setIsDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Plus className="w-4 h-4" />
                Nova Atividade
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAtividade ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {editingAtividade && editingAtividade.codigo_atividade && (
                  <div className="bg-[#ADF802]/10 border border-[#ADF802]/30 rounded-lg p-3">
                    <p className="text-sm text-[#ADF802] font-mono">
                      🔖 Código: <strong>{editingAtividade.codigo_atividade}</strong>
                    </p>
                  </div>
                )}
                
                {!editingAtividade && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-sm text-blue-400">
                      📅 A data será registrada automaticamente como <strong>{format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}</strong>
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {editingAtividade && (
                    <div>
                      <Label>Data</Label>
                      <Input
                        type="date"
                        value={formData.data}
                        onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                        className="bg-[#1a1a1a] border-gray-700 mt-2"
                        required
                      />
                    </div>
                  )}
                  <div className={editingAtividade ? '' : 'sm:col-span-2'}>
                    <Label className="flex items-center gap-2">
                      Tipo de Atividade
                      <AtividadeInfoTooltip tipo={selectedType} />
                    </Label>
                    <Select value={selectedType} onValueChange={handleTipoChange}>
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
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
                    <Select value={formData.analista_id} onValueChange={handleAnalistaChange}>
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242424] border-gray-700">
                        {analistas.map((an) => (
                          <SelectItem key={an.id} value={an.id}>{an.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.supervisor_id && (
                    <div>
                      <Label>Supervisor Responsável</Label>
                      <div className="bg-[#1a1a1a] border border-gray-700 rounded-md p-2 mt-2">
                        <p className="text-white">{getSupervisorNome(formData.supervisor_id)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {selectedType === 'Chamados' && (
                  <div>
                    <Label>Ticket</Label>
                    <Input
                      type="text"
                      placeholder="Ex: #12345"
                      maxLength="10"
                      value={formData.ticket_acompanhado}
                      onChange={(e) => setFormData({ ...formData, ticket_acompanhado: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                    />
                  </div>
                )}

                {selectedType === 'Ligações' && (
                  <div>
                    <Label>Protocolo da Gravação</Label>
                    <Input
                      type="text"
                      value={formData.protocolo_gravacao}
                      onChange={(e) => setFormData({ ...formData, protocolo_gravacao: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                    />
                  </div>
                )}

                {selectedType === 'Monitoria Offline' && (
                  <MonitoriaOfflineForm
                    data={formData.topicos_monitoria_offline}
                    onChange={(topicos) => setFormData({ ...formData, topicos_monitoria_offline: topicos })}
                    onProtocoloChange={(protocolo) => setFormData({ ...formData, protocolo_gravacao: protocolo })}
                    onNotaChange={(nota) => setFormData({ ...formData, nota, status: 'Concluído' })}
                  />
                )}

                {selectedType === 'Monitoria Assistida' && (
                  <MonitoriaAssistidaForm
                    data={formData.topicos_monitoria_assistida}
                    onChange={(topicos) => setFormData({ ...formData, topicos_monitoria_assistida: topicos })}
                    onLinkChange={(link) => setFormData({ ...formData, link_gravacao_teams: link })}
                    onNotaChange={(nota) => setFormData({ ...formData, nota, status: 'Concluído' })}
                  />
                )}

                {selectedType === 'Feedback Individual' && (
                  <div>
                    <Label>Tipo de Feedback</Label>
                    <Select value={formData.tipo_feedback} onValueChange={(val) => setFormData({ ...formData, tipo_feedback: val })}>
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242424] border-gray-700">
                        <SelectItem value="Positivo">Positivo</SelectItem>
                        <SelectItem value="Negativo">Negativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedType !== 'Monitoria Offline' && selectedType !== 'Monitoria Assistida' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Nota (0-10)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={formData.nota}
                        onChange={(e) => setFormData({ ...formData, nota: e.target.value })}
                        className="bg-[#1a1a1a] border-gray-700 mt-2"
                        required
                      />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                        <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
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

                <div>
                  <Label>Comentário</Label>
                  <Textarea
                    value={formData.comentario}
                    onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2 h-24"
                    placeholder="Detalhes adicionais..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                  <Button type="button" variant="outline" onClick={resetForm} className="border-gray-700" disabled={createMutation.isPending || updateMutation.isPending}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {editingAtividade ? 'Atualizando...' : 'Registrando...'}
                      </>
                    ) : (
                      editingAtividade ? 'Atualizar' : 'Registrar'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-[#0d0d0d] rounded-2xl border border-gray-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Filtros</h2>
        </div>
        
        {/* Campo de Busca por ID */}
        <div className="mb-4">
          <Label className="text-xs text-gray-400">Buscar por Código (CH, LG, MO, MA, FB)</Label>
          <Input
            type="text"
            placeholder="Ex: CH00001, LG00002, MO00003..."
            value={filterIdBusca}
            onChange={(e) => setFilterIdBusca(e.target.value.toUpperCase())}
            className="bg-[#1a1a1a] border-gray-700 mt-1 font-mono"
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label className="text-xs text-gray-400">Supervisor</Label>
            <Select value={filterSupervisor} onValueChange={setFilterSupervisor}>
              <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-1">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-[#242424] border-gray-700">
                <SelectItem value={null}>Todos</SelectItem>
                {supervisores.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-400">Analista</Label>
            <Select value={filterAnalista} onValueChange={setFilterAnalista}>
              <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-1">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-[#242424] border-gray-700">
                <SelectItem value={null}>Todos</SelectItem>
                {analistas.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-400">Tipo</Label>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-1">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-[#242424] border-gray-700">
                <SelectItem value={null}>Todos</SelectItem>
                <SelectItem value="Chamados">Chamados</SelectItem>
                <SelectItem value="Ligações">Ligações</SelectItem>
                <SelectItem value="Monitoria Offline">Monitoria Offline</SelectItem>
                <SelectItem value="Monitoria Assistida">Monitoria Assistida</SelectItem>
                <SelectItem value="Feedback Individual">Feedback Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-400">Data Início</Label>
            <Input
              type="date"
              value={filterDataInicio}
              onChange={(e) => setFilterDataInicio(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-400">Data Fim</Label>
            <Input
              type="date"
              value={filterDataFim}
              onChange={(e) => setFilterDataFim(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-1"
            />
          </div>
        </div>
        
        {(filterIdBusca || filterSupervisor || filterAnalista || filterTipo || filterDataInicio || filterDataFim) && (
          <div className="mt-4 flex justify-end">
            <Button onClick={limparFiltros} variant="outline" size="sm" className="border-gray-700 gap-2">
              <X className="w-4 h-4" />
              Limpar Filtros
            </Button>
          </div>
        )}
      </div>

      {/* Tabela de Atividades */}
      <div className="bg-[#0d0d0d] rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#1a1a1a] border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Supervisor Resp.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Analista</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Registrado Por</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">Nota</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {atividadesFiltradas.map((atividade) => (
                <tr key={atividade.id} className="hover:bg-[#1a1a1a] transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-1 bg-[#ADF802]/10 text-[#ADF802] text-xs font-mono font-bold rounded border border-[#ADF802]/30">
                      {atividade.codigo_atividade || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                    {getLocalDateString(atividade.data)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium border whitespace-nowrap ${getTipoColor(atividade.tipo)}`}>
                        {atividade.tipo}
                      </span>
                      <AtividadeInfoTooltip tipo={atividade.tipo} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {getSupervisorNome(atividade.supervisor_id)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {getAnalistaNome(atividade.analista_id)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 truncate max-w-[150px]">
                    {atividade.registrado_por || atividade.created_by}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getNotaBadgeColor(atividade.nota)}`}>
                      {atividade.nota}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(atividade.status)}`}>
                      {atividade.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingAtividade(atividade)}
                        className="text-blue-400 hover:text-blue-300 h-8 w-8"
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(atividade)}
                          className="text-gray-400 hover:text-white h-8 w-8"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(atividade.id)}
                          className="text-gray-400 hover:text-red-400 h-8 w-8"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {atividadesFiltradas.length === 0 && (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {atividades.length === 0 ? 'Nenhuma atividade registrada' : 'Nenhuma atividade encontrada com os filtros aplicados'}
            </p>
          </div>
        )}
      </div>

      {/* Dialog de Visualização */}
      <Dialog open={!!viewingAtividade} onOpenChange={() => setViewingAtividade(null)}>
        <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Atividade</DialogTitle>
          </DialogHeader>
          {viewingAtividade && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Data</p>
                  <p className="text-white font-medium">{getLocalDateString(viewingAtividade.data)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Tipo</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getTipoColor(viewingAtividade.tipo)}`}>
                    {viewingAtividade.tipo}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Supervisor</p>
                  <p className="text-white">{getSupervisorNome(viewingAtividade.supervisor_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Analista</p>
                  <p className="text-white">{getAnalistaNome(viewingAtividade.analista_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Nota</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${getNotaBadgeColor(viewingAtividade.nota)}`}>
                    {viewingAtividade.nota}/10
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(viewingAtividade.status)}`}>
                    {viewingAtividade.status}
                  </span>
                </div>
              </div>

              {viewingAtividade.protocolo_gravacao && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Protocolo da Gravação</p>
                  <p className="text-white">{viewingAtividade.protocolo_gravacao}</p>
                </div>
              )}

              {viewingAtividade.link_gravacao_teams && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Link Teams</p>
                  <a href={viewingAtividade.link_gravacao_teams} target="_blank" className="text-blue-400 hover:underline text-sm">
                    {viewingAtividade.link_gravacao_teams}
                  </a>
                </div>
              )}

              {viewingAtividade.ticket_acompanhado && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Ticket</p>
                  <p className="text-white">{viewingAtividade.ticket_acompanhado}</p>
                </div>
              )}

              {viewingAtividade.tipo_feedback && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Tipo de Feedback</p>
                  <p className="text-white">{viewingAtividade.tipo_feedback}</p>
                </div>
              )}

              {viewingAtividade.comentario && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Comentário</p>
                  <p className="text-gray-300 text-sm">{viewingAtividade.comentario}</p>
                </div>
              )}

              {viewingAtividade.tipo === 'Monitoria Offline' && viewingAtividade.topicos_monitoria_offline && (
                <div>
                  <MonitoriaOfflineForm
                    data={{
                      ...viewingAtividade.topicos_monitoria_offline,
                      protocolo: viewingAtividade.protocolo_gravacao
                    }}
                    onChange={() => {}}
                    readOnly={true}
                  />
                </div>
              )}

              {viewingAtividade.tipo === 'Monitoria Assistida' && viewingAtividade.topicos_monitoria_assistida && (
                <div>
                  <MonitoriaAssistidaForm
                    data={{
                      ...viewingAtividade.topicos_monitoria_assistida,
                      linkGravacao: viewingAtividade.link_gravacao_teams
                    }}
                    onChange={() => {}}
                    readOnly={true}
                  />
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-800">
                <Button onClick={() => setViewingAtividade(null)} className="bg-emerald-600 hover:bg-emerald-700">
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir esta atividade? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Sucesso - GARANTIDO */}
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent className="bg-gradient-to-br from-emerald-900/30 to-emerald-950/50 border-2 border-emerald-500/50 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-emerald-400 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              Atividade Registrada com Sucesso!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-300 space-y-3 pt-4">
              <p className="flex items-start gap-2">
                <span className="text-emerald-400 text-xl">📋</span>
                <span>Seu registro foi <strong className="text-white">enviado para aprovação</strong> do coordenador.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-blue-400 text-xl">🔔</span>
                <span>Você será <strong className="text-white">notificado</strong> assim que a atividade for avaliada.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-purple-400 text-xl">👤</span>
                <span>Acompanhe o status no seu <strong className="text-white">Perfil</strong>.</span>
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogAction
              onClick={() => {
                setShowSuccessDialog(false);
                // Refresh otimizado das queries
                queryClient.invalidateQueries({ queryKey: ['atividades'] });
                queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] });
                queryClient.invalidateQueries({ queryKey: ['minhasAtividadesPendentes'] });
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 text-base"
            >
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}