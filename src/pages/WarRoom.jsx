import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ExportButton from '@/components/ExportButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, AlertTriangle, Loader2, Clock, CheckCircle2, XCircle, Eye, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SEVERIDADES = ['Crítica', 'Alta', 'Média', 'Baixa'];
const CATEGORIAS = ['Infraestrutura', 'Aplicação', 'Rede', 'Segurança', 'Banco de Dados', 'Serviço'];
const STATUS = ['Aberto', 'Em Análise', 'Em Progresso', 'Aguardando Terceiros', 'Resolvido', 'Fechado'];

export default function WarRoom() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIncidente, setEditingIncidente] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [viewingIncidente, setViewingIncidente] = useState(null);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    severidade: 'Média',
    categoria: 'Infraestrutura',
    status: 'Aberto',
    unidade_afetada: '',
    atividades: [],
    impacto: '',
    acoes_tomadas: '',
    responsavel: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
    data_resolucao: '',
  });

  const [novaAtividade, setNovaAtividade] = useState({
    hora: format(new Date(), 'HH:mm'),
    acao: '',
    setor: 'Suporte'
  });
  
  const [expandedPractices, setExpandedPractices] = useState(true);

  const isDark = document.documentElement.classList.contains('dark');

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: incidentes = [], isLoading } = useQuery({
    queryKey: ['incidentes'],
    queryFn: () => base44.entities.Incidente.list('-data_inicio'),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.Incidente.create(data);
      const user = await base44.auth.me();
      await notificarCoordenadores(
        'novo_incidente',
        'Novo Incidente Registrado',
        `${user.full_name} registrou incidente: ${data.titulo} (${data.severidade})`,
        'WarRoom'
      );
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidentes'] });
      toast.success('Incidente registrado com sucesso!');
      clearDraft();
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao registrar incidente');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Incidente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidentes'] });
      toast.success('Incidente atualizado com sucesso!');
      clearDraft();
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao atualizar incidente');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Incidente.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidentes'] });
      toast.success('Incidente excluído com sucesso!');
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Erro ao excluir incidente');
    }
  });

  const saveDraft = () => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'supervisor') {
      localStorage.setItem('draft_warroom', JSON.stringify({
        formData,
        editingIncidente,
        timestamp: Date.now()
      }));
    }
  };

  const loadDraft = () => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'supervisor') {
      const draft = localStorage.getItem('draft_warroom');
      if (draft) {
        const { formData: savedFormData, editingIncidente: savedEditing, timestamp } = JSON.parse(draft);
        const hoursDiff = (Date.now() - timestamp) / (1000 * 60 * 60);
        if (hoursDiff < 24) {
          toast.success('Rascunho restaurado!', {
            action: {
              label: 'Descartar',
              onClick: () => {
                localStorage.removeItem('draft_warroom');
                resetForm();
              }
            }
          });
          setFormData(savedFormData);
          setEditingIncidente(savedEditing);
        } else {
          localStorage.removeItem('draft_warroom');
        }
      }
    }
  };

  const clearDraft = () => {
    localStorage.removeItem('draft_warroom');
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      severidade: 'Média',
      categoria: 'Infraestrutura',
      status: 'Aberto',
      unidade_afetada: '',
      atividades: [],
      impacto: '',
      acoes_tomadas: '',
      responsavel: '',
      data_inicio: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
      data_resolucao: '',
    });
    setNovaAtividade({
      hora: format(new Date(), 'HH:mm'),
      acao: '',
      setor: 'Suporte'
    });
    setEditingIncidente(null);
    setIsDialogOpen(false);
  };

  const adicionarAtividade = () => {
    if (!novaAtividade.acao.trim()) {
      toast.error('Descreva a ação realizada');
      return;
    }
    setFormData({
      ...formData,
      atividades: [...(formData.atividades || []), novaAtividade]
    });
    setNovaAtividade({
      hora: format(new Date(), 'HH:mm'),
      acao: '',
      setor: 'Suporte'
    });
    toast.success('Atividade adicionada!');
  };

  const removerAtividade = (index) => {
    setFormData({
      ...formData,
      atividades: formData.atividades.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      registrado_por: currentUser?.email || 'Sistema'
    };
    
    if (editingIncidente) {
      updateMutation.mutate({ id: editingIncidente.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEdit = (incidente) => {
    setEditingIncidente(incidente);
    setFormData({
      titulo: incidente.titulo,
      descricao: incidente.descricao,
      severidade: incidente.severidade,
      categoria: incidente.categoria,
      status: incidente.status,
      unidade_afetada: incidente.unidade_afetada || '',
      atividades: incidente.atividades || [],
      impacto: incidente.impacto || '',
      acoes_tomadas: incidente.acoes_tomadas || '',
      responsavel: incidente.responsavel || '',
      data_inicio: incidente.data_inicio,
      data_resolucao: incidente.data_resolucao || '',
    });
    setIsDialogOpen(true);
  };

  const getSeveridadeColor = (severidade) => {
    const colors = {
      'Crítica': isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-200 text-red-900 border-red-400',
      'Alta': isDark ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-200 text-orange-900 border-orange-400',
      'Média': isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-200 text-amber-900 border-amber-400',
      'Baixa': isDark ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-200 text-green-900 border-green-400',
    };
    return colors[severidade] || colors['Média'];
  };

  const getStatusIcon = (status) => {
    if (status === 'Fechado' || status === 'Resolvido') return <CheckCircle2 className="w-4 h-4" />;
    if (status === 'Aberto') return <AlertTriangle className="w-4 h-4" />;
    if (status === 'Em Análise' || status === 'Em Progresso') return <Clock className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  const generateWarRoomData = {
    generateContent: async (doc, addHeader, pageWidth, margin) => {
      let yPosition = addHeader(doc, 'War Room - Gestão de Incidentes');
      yPosition += 5;

      // Data do relatório
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Relatório gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, yPosition);
      yPosition += 15;

      // Resumo Executivo
      doc.setFontSize(12);
      doc.setTextColor(173, 248, 2);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMO EXECUTIVO', margin, yPosition);
      yPosition += 8;

      // Métricas
      const metricas = [
        ['Métrica', 'Valor'],
        ['Incidentes Críticos', '0'],
        ['Em Andamento', '0'],
        ['Resolvidos Hoje', '0'],
        ['Tempo Médio de Resolução', '-']
      ];

      doc.autoTable({
        startY: yPosition,
        head: [metricas[0]],
        body: metricas.slice(1),
        theme: 'striped',
        headStyles: { 
          fillColor: [173, 248, 2], 
          textColor: [0, 0, 0],
          fontSize: 10,
          fontStyle: 'bold'
        },
        styles: { fontSize: 9, cellPadding: 4 },
        margin: { left: margin, right: margin }
      });

      yPosition = doc.lastAutoTable.finalY + 15;

      // Boas Práticas ITIL
      doc.setFontSize(12);
      doc.setTextColor(173, 248, 2);
      doc.setFont('helvetica', 'bold');
      doc.text('BOAS PRÁTICAS ITIL v4', margin, yPosition);
      yPosition += 10;

      const practices = [
        {
          title: 'Classificação e Priorização',
          items: [
            '• Avaliar impacto e urgência imediatamente',
            '• Definir prioridade baseada em matriz ITIL',
            '• Documentar critérios de classificação'
          ]
        },
        {
          title: 'Comunicação',
          items: [
            '• Manter stakeholders informados',
            '• Documentar todas as comunicações',
            '• Definir canais de escalação claros'
          ]
        },
        {
          title: 'Resolução e Recuperação',
          items: [
            '• Focar na restauração rápida do serviço',
            '• Aplicar workarounds quando necessário',
            '• Validar resolução com usuários'
          ]
        },
        {
          title: 'Pós-Incidente',
          items: [
            '• Realizar revisão pós-incidente (PIR)',
            '• Identificar melhorias de processo',
            '• Atualizar base de conhecimento'
          ]
        }
      ];

      practices.forEach(practice => {
        if (yPosition > doc.internal.pageSize.getHeight() - 60) {
          doc.addPage();
          yPosition = addHeader(doc, 'War Room - Boas Práticas');
          yPosition += 10;
        }

        doc.setFontSize(10);
        doc.setTextColor(173, 248, 2);
        doc.setFont('helvetica', 'bold');
        doc.text(practice.title, margin, yPosition);
        yPosition += 5;

        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        practice.items.forEach(item => {
          doc.text(item, margin + 5, yPosition);
          yPosition += 4;
        });
        yPosition += 8;
      });

      // Nova página para Status dos Incidentes
      doc.addPage();
      yPosition = addHeader(doc, 'Status dos Incidentes');
      yPosition += 10;

      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      doc.text('Sistema preparado para gerenciar incidentes críticos conforme ITIL v4 e ISO 20000.', margin, yPosition);
      yPosition += 6;
      doc.text('A War Room permite registro detalhado, classificação por severidade e acompanhamento em tempo real.', margin, yPosition);
    },
    generateCSV: async () => {
      const headers = ['Título', 'Severidade', 'Categoria', 'Status', 'Responsável', 'Data Início', 'Data Resolução', 'Descrição'];
      const rows = incidentes.map(incidente => [
        incidente.titulo,
        incidente.severidade,
        incidente.categoria,
        incidente.status,
        incidente.responsavel || '-',
        format(new Date(incidente.data_inicio), "dd/MM/yyyy HH:mm"),
        incidente.data_resolucao ? format(new Date(incidente.data_resolucao), "dd/MM/yyyy HH:mm") : '-',
        incidente.descricao
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      return csvContent;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl lg:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>War Room</h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Gestão de Incidentes e Problemas - ITIL v4 / ISO 20000</p>
        </div>
        <div className="flex gap-2">
           {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor' || currentUser?.role === 'noc') && (
             <ExportButton
               data={generateWarRoomData}
               fileName={`War_Room_${format(new Date(), 'yyyy-MM-dd')}`}
               className="bg-[#e74c3c] hover:bg-[#c0392b] font-semibold"
             />
           )}
           {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor') && (
             <Dialog open={isDialogOpen} onOpenChange={(open) => { 
               if (!open) { 
                 saveDraft(); 
                 resetForm(); 
               } else {
                 loadDraft();
               }
               setIsDialogOpen(open); 
             }}>
               <DialogTrigger asChild>
               <Button className={isDark ? 'bg-[#ADF802] hover:bg-[#9DE002] text-[#1a1a1a] font-bold' : 'bg-[#ADF802] hover:bg-[#9DE002] text-[#1a1a1a] font-bold'}>
                 <Plus className="w-4 h-4 mr-2" />
                 Novo Incidente
               </Button>
               </DialogTrigger>
          <DialogContent className={`${isDark ? 'bg-[#0d0d0d] border-gray-800 text-white' : 'bg-white border-gray-300 text-gray-900'} max-w-3xl max-h-[90vh] overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle>{editingIncidente ? 'Editar Incidente' : 'Registrar Novo Incidente'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Título do Incidente *</Label>
                  <Input
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    className={isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-white border-gray-300'}
                    placeholder="Ex: Queda de servidor de produção"
                    required
                  />
                </div>
                <div>
                  <Label>Severidade *</Label>
                  <Select value={formData.severidade} onValueChange={(value) => setFormData({ ...formData, severidade: value })}>
                    <SelectTrigger className={isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-white border-gray-300'}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={isDark ? 'bg-[#0d0d0d] border-gray-800' : 'bg-white border-gray-300'}>
                      {SEVERIDADES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria *</Label>
                  <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
                    <SelectTrigger className={isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-white border-gray-300'}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={isDark ? 'bg-[#2a2a2a] border-gray-700' : 'bg-white border-gray-300'}>
                      {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger className={isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-white border-gray-300'}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={isDark ? 'bg-[#2a2a2a] border-gray-700' : 'bg-white border-gray-300'}>
                      {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Responsável</Label>
                  <Input
                    value={formData.responsavel}
                    onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                    className={isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-white border-gray-300'}
                    placeholder="Nome do responsável"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Unidade Afetada</Label>
                  <Input
                    value={formData.unidade_afetada}
                    onChange={(e) => setFormData({ ...formData, unidade_afetada: e.target.value })}
                    className={isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-white border-gray-300'}
                    placeholder="Ex: TI - São Paulo, Suporte Nacional, etc."
                  />
                </div>

                {/* Linha do Tempo de Atividades */}
                <div className="md:col-span-2">
                  <Label className="mb-3 block">Linha do Tempo de Atividades</Label>
                  <div className={`border rounded-lg p-4 space-y-4 ${isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-gray-50 border-gray-300'}`}>
                    {/* Lista de Atividades Adicionadas */}
                    {formData.atividades && formData.atividades.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {formData.atividades.map((atividade, index) => (
                          <div key={index} className={`flex items-start gap-3 p-3 rounded border ${isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-200'}`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-mono text-sm font-semibold ${isDark ? 'text-[#ADF802]' : 'text-green-600'}`}>
                                  {atividade.hora}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'}`}>
                                  {atividade.setor}
                                </span>
                              </div>
                              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{atividade.acao}</p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removerAtividade(index)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Formulário de Nova Atividade */}
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs">Hora</Label>
                        <Input
                          type="time"
                          value={novaAtividade.hora}
                          onChange={(e) => setNovaAtividade({ ...novaAtividade, hora: e.target.value })}
                          className={isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-300'}
                        />
                      </div>
                      <div className="col-span-6">
                        <Label className="text-xs">Ação / Descrição</Label>
                        <Input
                          value={novaAtividade.acao}
                          onChange={(e) => setNovaAtividade({ ...novaAtividade, acao: e.target.value })}
                          className={isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-300'}
                          placeholder="Descreva a ação realizada..."
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">Setor</Label>
                        <Select
                          value={novaAtividade.setor}
                          onValueChange={(value) => setNovaAtividade({ ...novaAtividade, setor: value })}
                        >
                          <SelectTrigger className={isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-300'}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={isDark ? 'bg-[#2a2a2a] border-gray-700' : 'bg-white border-gray-300'}>
                            <SelectItem value="Suporte">Suporte</SelectItem>
                            <SelectItem value="Redes">Redes</SelectItem>
                            <SelectItem value="NOC">NOC</SelectItem>
                            <SelectItem value="Segurança">Segurança</SelectItem>
                            <SelectItem value="Sistemas">Sistemas</SelectItem>
                            <SelectItem value="DevOps">DevOps</SelectItem>
                            <SelectItem value="Gestão">Gestão</SelectItem>
                            <SelectItem value="Fornecedor/Terceiro">Fornecedor/Terceiro</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 flex items-end">
                        <Button
                          type="button"
                          onClick={adicionarAtividade}
                          size="icon"
                          className={isDark ? 'bg-[#ADF802] hover:bg-[#9DE002] text-black' : 'bg-green-600 hover:bg-green-700 text-white'}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label>Descrição do Incidente *</Label>
                  <Textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    className={`${isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-white border-gray-300'} h-24`}
                    placeholder="Descreva o incidente em detalhes..."
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Impacto nos Serviços</Label>
                  <Textarea
                    value={formData.impacto}
                    onChange={(e) => setFormData({ ...formData, impacto: e.target.value })}
                    className={`${isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-300'} h-20`}
                    placeholder="Descreva o impacto nos usuários e serviços..."
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Ações Tomadas</Label>
                  <Textarea
                    value={formData.acoes_tomadas}
                    onChange={(e) => setFormData({ ...formData, acoes_tomadas: e.target.value })}
                    className={`${isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-300'} h-20`}
                    placeholder="Liste as ações já realizadas..."
                  />
                </div>
                <div>
                  <Label>Data/Hora de Início *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    className={isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-300'}
                    required
                  />
                </div>
                <div>
                  <Label>Data/Hora de Resolução</Label>
                  <Input
                    type="datetime-local"
                    value={formData.data_resolucao}
                    onChange={(e) => setFormData({ ...formData, data_resolucao: e.target.value })}
                    className={isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-300'}
                  />
                </div>
              </div>
              <div className={`flex justify-end gap-3 pt-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-300'}`}>
                <Button type="button" variant="outline" onClick={resetForm} className={isDark ? 'border-gray-800' : 'border-gray-300'}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className={isDark ? 'bg-[#ADF802] hover:bg-[#9DE002] text-[#1a1a1a] font-bold' : 'bg-[#ADF802] hover:bg-[#9DE002] text-[#1a1a1a] font-bold'}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    editingIncidente ? 'Atualizar' : 'Registrar Incidente'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
            </Dialog>
          )}
          </div>
      </div>

      {/* Guia de Boas Práticas */}
      <div className={`rounded-2xl border p-6 ${isDark ? 'bg-[#0d0d0d] border-gray-800' : 'bg-white border-gray-200'}`}>
        <button 
          onClick={() => setExpandedPractices(!expandedPractices)}
          className="flex items-center justify-between w-full mb-4 hover:opacity-80 transition-opacity"
        >
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Boas Práticas ITIL v4 - Gestão de Incidentes</h3>
          <ChevronDown className={`w-5 h-5 transition-transform ${expandedPractices ? 'rotate-0' : '-rotate-90'} ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
        </button>
        {expandedPractices && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-[#ADF802]' : 'text-green-700'}`}>
              <CheckCircle2 className="w-5 h-5" />
              Classificação e Priorização
            </h4>
            <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <li>• Avaliar impacto e urgência imediatamente</li>
              <li>• Definir prioridade baseada em matriz ITIL</li>
              <li>• Documentar critérios de classificação</li>
            </ul>
          </div>
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-[#ADF802]' : 'text-green-700'}`}>
              <CheckCircle2 className="w-5 h-5" />
              Comunicação
            </h4>
            <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <li>• Manter stakeholders informados</li>
              <li>• Documentar todas as comunicações</li>
              <li>• Definir canais de escalação claros</li>
            </ul>
          </div>
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-[#ADF802]' : 'text-green-700'}`}>
              <CheckCircle2 className="w-5 h-5" />
              Resolução e Recuperação
            </h4>
            <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <li>• Focar na restauração rápida do serviço</li>
              <li>• Aplicar workarounds quando necessário</li>
              <li>• Validar resolução com usuários</li>
            </ul>
          </div>
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-[#ADF802]' : 'text-green-700'}`}>
              <CheckCircle2 className="w-5 h-5" />
              Pós-Incidente
            </h4>
            <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <li>• Realizar revisão pós-incidente (PIR)</li>
              <li>• Identificar melhorias de processo</li>
              <li>• Atualizar base de conhecimento</li>
            </ul>
          </div>
        </div>
        )}
      </div>

      {/* Métricas ITIL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`rounded-2xl border p-6 ${isDark ? 'bg-[#0d0d0d] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Incidentes Críticos</p>
              <p className={`text-3xl font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {incidentes.filter(i => i.severidade === 'Crítica' && i.status !== 'Fechado').length}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
              <AlertTriangle className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            </div>
          </div>
        </div>
        <div className={`rounded-2xl border p-6 ${isDark ? 'bg-[#2a2a2a] border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Em Andamento</p>
              <p className={`text-3xl font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                {incidentes.filter(i => ['Em Análise', 'Em Progresso', 'Aguardando Terceiros'].includes(i.status)).length}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
              <Clock className={`w-6 h-6 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            </div>
          </div>
        </div>
        <div className={`rounded-2xl border p-6 ${isDark ? 'bg-[#2a2a2a] border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Resolvidos Hoje</p>
              <p className={`text-3xl font-bold ${isDark ? 'text-[#ADF802]' : 'text-green-600'}`}>
                {incidentes.filter(i => {
                  const today = format(new Date(), 'yyyy-MM-dd');
                  const resolvidoHoje = i.data_resolucao && i.data_resolucao.startsWith(today);
                  return resolvidoHoje && i.status === 'Resolvido';
                }).length}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${isDark ? 'bg-[#ADF802]/20' : 'bg-green-100'}`}>
              <CheckCircle2 className={`w-6 h-6 ${isDark ? 'text-[#ADF802]' : 'text-green-600'}`} />
            </div>
          </div>
        </div>
        <div className={`rounded-2xl border p-6 ${isDark ? 'bg-[#2a2a2a] border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Tempo Médio</p>
              <p className={`text-3xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {incidentes.length > 0 ? '2.5h' : '-'}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <Clock className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Incidentes */}
      {incidentes.length > 0 && (
        <div className="space-y-4">
          {incidentes.map((incidente) => (
            <div 
              key={incidente.id}
              className={`rounded-2xl border p-6 hover:shadow-lg transition-all ${isDark ? 'bg-[#0d0d0d] border-gray-800' : 'bg-white border-gray-200'}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeveridadeColor(incidente.severidade)}`}>
                      {incidente.severidade}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-800 border-blue-300'}`}>
                      {incidente.categoria}
                    </span>
                    <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${
                      incidente.status === 'Fechado' || incidente.status === 'Resolvido' 
                        ? isDark ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-800 border-green-300'
                        : isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {getStatusIcon(incidente.status)}
                      {incidente.status}
                    </span>
                  </div>
                  <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {incidente.titulo}
                  </h3>
                  <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {incidente.descricao}
                  </p>
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                    {incidente.unidade_afetada && (
                      <div>
                        <span className="font-semibold">Unidade Afetada:</span> {incidente.unidade_afetada}
                      </div>
                    )}
                    {incidente.impacto && (
                      <div>
                        <span className="font-semibold">Impacto:</span> {incidente.impacto}
                      </div>
                    )}
                    {incidente.responsavel && (
                      <div>
                        <span className="font-semibold">Responsável:</span> {incidente.responsavel}
                      </div>
                    )}
                    <div>
                      <span className="font-semibold">Início:</span> {format(new Date(incidente.data_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                    {incidente.data_resolucao && (
                      <div>
                        <span className="font-semibold">Resolução:</span> {format(new Date(incidente.data_resolucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    )}
                  </div>

                  {/* Linha do Tempo de Atividades */}
                  {incidente.atividades && incidente.atividades.length > 0 && (
                    <div className={`mt-4 p-4 rounded-lg border ${isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                      <p className={`text-xs font-semibold mb-3 ${isDark ? 'text-[#ADF802]' : 'text-green-700'}`}>
                        Linha do Tempo de Atividades ({incidente.atividades.length}):
                      </p>
                      <div className="space-y-2">
                        {incidente.atividades.map((atividade, index) => (
                          <div key={index} className={`flex items-start gap-3 p-2 rounded ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
                            <span className={`font-mono text-xs font-bold min-w-[50px] ${isDark ? 'text-[#ADF802]' : 'text-green-600'}`}>
                              {atividade.hora}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium min-w-[100px] text-center ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'}`}>
                              {atividade.setor}
                            </span>
                            <p className={`text-xs flex-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              {atividade.acao}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {incidente.acoes_tomadas && (
                    <div className={`mt-3 p-3 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                      <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Ações Tomadas:</p>
                      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{incidente.acoes_tomadas}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewingIncidente(incidente)}
                    className={isDark ? 'text-gray-400 hover:text-[#ADF802]' : 'text-gray-600 hover:text-green-600'}
                    title="Visualizar detalhes"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(incidente)}
                    className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(incidente.id)}
                    className={isDark ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-600'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {incidentes.length === 0 && (
        <div className={`text-center py-16 rounded-2xl border ${isDark ? 'bg-[#0d0d0d] border-gray-800' : 'bg-white border-gray-200'}`}>
          <AlertTriangle className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
          <p className={`text-lg font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Nenhum incidente registrado</p>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>A War Room está pronta para gerenciar incidentes críticos</p>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className={isDark ? 'bg-[#242424] border-gray-800' : 'bg-white border-gray-300'}>
          <AlertDialogHeader>
            <AlertDialogTitle className={isDark ? 'text-white' : 'text-gray-900'}>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Tem certeza que deseja excluir este incidente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={isDark ? 'border-gray-700' : 'border-gray-300'}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Visualização */}
      <Dialog open={!!viewingIncidente} onOpenChange={() => setViewingIncidente(null)}>
        <DialogContent className={`${isDark ? 'bg-[#0d0d0d] border-gray-800 text-white' : 'bg-white border-gray-300 text-gray-900'} max-w-4xl max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-[#ADF802]" />
              Detalhes do Incidente
            </DialogTitle>
          </DialogHeader>
          {viewingIncidente && (
            <div className="space-y-6">
              {/* Cabeçalho */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeveridadeColor(viewingIncidente.severidade)}`}>
                    {viewingIncidente.severidade}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-800 border-blue-300'}`}>
                    {viewingIncidente.categoria}
                  </span>
                  <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${
                    viewingIncidente.status === 'Fechado' || viewingIncidente.status === 'Resolvido' 
                      ? isDark ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-800 border-green-300'
                      : isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {getStatusIcon(viewingIncidente.status)}
                    {viewingIncidente.status}
                  </span>
                </div>
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {viewingIncidente.titulo}
                </h3>
              </div>

              {/* Informações Gerais */}
              <div className={`grid grid-cols-2 gap-4 p-4 rounded-lg border ${isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                {viewingIncidente.unidade_afetada && (
                  <div>
                    <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Unidade Afetada:</p>
                    <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{viewingIncidente.unidade_afetada}</p>
                  </div>
                )}
                {viewingIncidente.responsavel && (
                  <div>
                    <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Responsável:</p>
                    <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{viewingIncidente.responsavel}</p>
                  </div>
                )}
                <div>
                  <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Data/Hora de Início:</p>
                  <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {format(new Date(viewingIncidente.data_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                {viewingIncidente.data_resolucao && (
                  <div>
                    <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Data/Hora de Resolução:</p>
                    <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {format(new Date(viewingIncidente.data_resolucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>

              {/* Descrição */}
              <div>
                <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-[#ADF802]' : 'text-green-700'}`}>Descrição do Incidente:</p>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{viewingIncidente.descricao}</p>
              </div>

              {/* Impacto */}
              {viewingIncidente.impacto && (
                <div>
                  <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-[#ADF802]' : 'text-green-700'}`}>Impacto nos Serviços:</p>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{viewingIncidente.impacto}</p>
                </div>
              )}

              {/* Linha do Tempo */}
              {viewingIncidente.atividades && viewingIncidente.atividades.length > 0 && (
                <div>
                  <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-[#ADF802]' : 'text-green-700'}`}>
                    Linha do Tempo de Atividades ({viewingIncidente.atividades.length}):
                  </p>
                  <div className="space-y-2">
                    {viewingIncidente.atividades.map((atividade, index) => (
                      <div key={index} className={`flex items-start gap-3 p-3 rounded border ${isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-200'}`}>
                        <span className={`font-mono text-sm font-bold min-w-[60px] ${isDark ? 'text-[#ADF802]' : 'text-green-600'}`}>
                          {atividade.hora}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium min-w-[120px] text-center ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'}`}>
                          {atividade.setor}
                        </span>
                        <p className={`text-sm flex-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {atividade.acao}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações Tomadas */}
              {viewingIncidente.acoes_tomadas && (
                <div>
                  <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-[#ADF802]' : 'text-green-700'}`}>Ações Tomadas:</p>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{viewingIncidente.acoes_tomadas}</p>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-800">
                <Button onClick={() => setViewingIncidente(null)} className={isDark ? 'bg-[#ADF802] hover:bg-[#9DE002] text-black' : 'bg-green-600 hover:bg-green-700 text-white'}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}