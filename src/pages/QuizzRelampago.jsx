import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Plus, Trophy, Clock, CheckCircle, XCircle, Pencil, Trash2, Eye, Play, Calendar, User, Award, Timer, Sparkles, Upload, X, Loader2, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import QuizzReiDoSuporteWidget from '@/components/QuizzReiDoSuporteWidget';
import QuizzCarrosselTop3 from '@/components/QuizzCarrosselTop3';

export default function QuizzRelampago() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
   const [selectedQuizz, setSelectedQuizz] = useState(null);
   const [viewMode, setViewMode] = useState('list'); // 'list', 'create', 'participate', 'results'
   const [deleteQuizzId, setDeleteQuizzId] = useState(null);
   const [deletePerguntaId, setDeletePerguntaId] = useState(null);
   const [deleteParticipanteData, setDeleteParticipanteData] = useState(null);
   const [editingQuizzId, setEditingQuizzId] = useState(null);
  
  const [quizzForm, setQuizzForm] = useState({
    titulo: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
  });

  const [perguntas, setPerguntas] = useState([
    { pergunta: '', alternativa_a: '', alternativa_b: '', alternativa_c: '', alternativa_d: '', resposta_correta: '', ordem: 1 }
  ]);

  const [participacaoState, setParticipacaoState] = useState({
    perguntaAtual: 0,
    respostas: [],
    tempoInicio: null,
  });

  const [gerarComIA, setGerarComIA] = useState(false);
  const [arquivosIA, setArquivosIA] = useState([]);
  const [contextoIA, setContextoIA] = useState('');
  const [categoriaIA, setCategoriaIA] = useState('');
  const [perguntaGeradaIA, setPerguntaGeradaIA] = useState(null);
  const [loadingIA, setLoadingIA] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: quizzes = [] } = useQuery({
    queryKey: ['quizzRelampago'],
    queryFn: () => base44.entities.QuizzRelampago.list('-created_date'),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const { data: perguntasQuizz = [] } = useQuery({
    queryKey: ['perguntasQuizz', selectedQuizz?.id],
    queryFn: () => base44.entities.PerguntaQuizz.filter({ quizz_id: selectedQuizz.id }, 'ordem'),
    enabled: !!selectedQuizz,
  });

  const { data: respostasQuizz = [] } = useQuery({
    queryKey: ['respostasQuizz', selectedQuizz?.id],
    queryFn: () => base44.entities.RespostaQuizz.filter({ quizz_id: selectedQuizz.id }),
    enabled: !!selectedQuizz,
  });

  // Usar dados já carregados em perguntasQuizz e respostasQuizz quando necessário
  const todasPerguntas = perguntasQuizz; // Usar dados do quizz selecionado
  const todasRespostas = respostasQuizz; // Usar dados do quizz selecionado

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const createQuizzMutation = useMutation({
    mutationFn: async (data) => {
      const quizz = await base44.entities.QuizzRelampago.create(data.quizz);
      
      const perguntasData = data.perguntas.map((p, idx) => ({
        ...p,
        quizz_id: quizz.id,
        ordem: idx + 1,
      }));
      
      await base44.entities.PerguntaQuizz.bulkCreate(perguntasData);
      
      return quizz;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzRelampago'] });
      toast.success('Quizz criado com sucesso!');
      resetForm();
      setIsCreateDialogOpen(false);
    },
  });

  const updateQuizzMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.QuizzRelampago.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzRelampago'] });
      toast.success('Quizz atualizado!');
      setEditingQuizzId(null);
    },
  });

  const deleteQuizzMutation = useMutation({
    mutationFn: async (quizzId) => {
      const perguntas = await base44.entities.PerguntaQuizz.filter({ quizz_id: quizzId });
      const respostas = await base44.entities.RespostaQuizz.filter({ quizz_id: quizzId });
      
      for (const resposta of respostas) {
        await base44.entities.RespostaQuizz.delete(resposta.id);
      }
      
      for (const pergunta of perguntas) {
        await base44.entities.PerguntaQuizz.delete(pergunta.id);
      }
      
      await base44.entities.QuizzRelampago.delete(quizzId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzRelampago'] });
      toast.success('Quizz excluído!');
      setDeleteQuizzId(null);
    },
  });

  const deletePerguntaMutation = useMutation({
    mutationFn: async (perguntaId) => {
      const respostas = await base44.entities.RespostaQuizz.filter({ pergunta_id: perguntaId });
      for (const resposta of respostas) {
        await base44.entities.RespostaQuizz.delete(resposta.id);
      }
      await base44.entities.PerguntaQuizz.delete(perguntaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perguntasQuizz'] });
      toast.success('Pergunta excluída!');
      setDeletePerguntaId(null);
    },
  });

  const submeterRespostaMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.RespostaQuizz.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['respostasQuizz'] });
      queryClient.invalidateQueries({ queryKey: ['todasRespostasQuizz'] });
    },
  });

  const deleteParticipanteMutation = useMutation({
    mutationFn: async ({ quizzId, analistaId }) => {
      const respostas = await base44.entities.RespostaQuizz.filter({ 
        quizz_id: quizzId, 
        analista_id: analistaId 
      });
      
      for (const resposta of respostas) {
        await base44.entities.RespostaQuizz.delete(resposta.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['respostasQuizz'] });
      queryClient.invalidateQueries({ queryKey: ['todasRespostasQuizz'] });
      toast.success('Participação removida! O analista pode participar novamente.');
      setDeleteParticipanteData(null);
    },
  });

  const isCoordOrSuper = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';
  const isCoord = currentUser?.role === 'admin';

  const handleCreateQuizz = () => {
    if (!quizzForm.titulo || !quizzForm.data_inicio || !quizzForm.data_fim) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (perguntas.length < 1) {
      toast.error('Adicione pelo menos uma pergunta');
      return;
    }

    const perguntasValidas = perguntas.every(p => 
      p.pergunta && p.alternativa_a && p.alternativa_b && p.alternativa_c && p.alternativa_d && p.resposta_correta
    );

    if (!perguntasValidas) {
      toast.error('Preencha todas as perguntas completamente');
      return;
    }

    if (editingQuizzId) {
      updateQuizzMutation.mutate({
        id: editingQuizzId,
        data: {
          ...quizzForm,
        }
      });
    } else {
      createQuizzMutation.mutate({
        quizz: {
          ...quizzForm,
          criado_por: currentUser.email,
          criador_nome: currentUser.full_name,
          status: new Date(quizzForm.data_inicio) <= new Date() ? 'Ativo' : 'Agendado',
        },
        perguntas,
      });
    }
  };

  const handleEditarQuizz = (quizz) => {
    setEditingQuizzId(quizz.id);
    setQuizzForm({
      titulo: quizz.titulo,
      descricao: quizz.descricao,
      data_inicio: quizz.data_inicio,
      data_fim: quizz.data_fim,
    });
    setIsCreateDialogOpen(true);
  };

  const handleToggleStatus = (quizz) => {
    const novoStatus = quizz.status === 'Ativo' ? 'Encerrado' : 'Ativo';
    updateQuizzMutation.mutate({
      id: quizz.id,
      data: { status: novoStatus }
    });
  };

  const resetForm = () => {
    setQuizzForm({
      titulo: '',
      descricao: '',
      data_inicio: '',
      data_fim: '',
    });
    setPerguntas([
      { pergunta: '', alternativa_a: '', alternativa_b: '', alternativa_c: '', alternativa_d: '', resposta_correta: '', ordem: 1 }
    ]);
    setEditingQuizzId(null);
  };

  const addPergunta = () => {
    setPerguntas([...perguntas, {
      pergunta: '',
      alternativa_a: '',
      alternativa_b: '',
      alternativa_c: '',
      alternativa_d: '',
      resposta_correta: '',
      ordem: perguntas.length + 1
    }]);
  };

  const removePergunta = (index) => {
    setPerguntas(perguntas.filter((_, i) => i !== index));
  };

  const updatePergunta = (index, field, value) => {
    const newPerguntas = [...perguntas];
    newPerguntas[index][field] = value;
    setPerguntas(newPerguntas);
  };

  const iniciarParticipacao = (quizz) => {
    // Verificar se já participou antes de iniciar
    if (jaParticipou(quizz.id)) {
      toast.error('Você já participou deste quizz!');
      return;
    }
    
    setSelectedQuizz(quizz);
    setViewMode('participate');
    setParticipacaoState({
      perguntaAtual: 0,
      respostas: [],
      tempoInicio: Date.now(),
    });
  };

  const responderPergunta = async (alternativa) => {
    const tempoResposta = (Date.now() - participacaoState.tempoInicio) / 1000;
    const perguntaAtual = perguntasQuizz[participacaoState.perguntaAtual];
    const correta = alternativa === perguntaAtual.resposta_correta;

    const analistaLogado = analistas.find(a => a.usuario_email === currentUser.email);

    await submeterRespostaMutation.mutateAsync({
      quizz_id: selectedQuizz.id,
      pergunta_id: perguntaAtual.id,
      analista_id: analistaLogado?.id || `usr_${currentUser.id}`,
      usuario_id: currentUser.id,
      resposta_selecionada: alternativa,
      correta,
      tempo_resposta_segundos: tempoResposta,
      data_hora_resposta: new Date().toISOString(),
    });

    const novasRespostas = [...participacaoState.respostas, { pergunta_id: perguntaAtual.id, correta, tempo: tempoResposta }];

    if (participacaoState.perguntaAtual < perguntasQuizz.length - 1) {
      setParticipacaoState({
        perguntaAtual: participacaoState.perguntaAtual + 1,
        respostas: novasRespostas,
        tempoInicio: Date.now(),
      });
    } else {
      // Invalidar queries para atualizar a verificação de participação
      await queryClient.invalidateQueries({ queryKey: ['todasRespostasQuizz'] });
      await queryClient.invalidateQueries({ queryKey: ['respostasQuizz'] });
      toast.success('Quizz concluído! Confira o ranking.');
      setViewMode('results');
    }
  };

  const visualizarResultados = (quizz) => {
    setSelectedQuizz(quizz);
    setViewMode('results');
  };

  const calcularRanking = () => {
    if (!respostasQuizz.length) return [];

    const rankingMap = {};

    respostasQuizz.forEach(resposta => {
      const chave = resposta.usuario_id;
      if (!rankingMap[chave]) {
        rankingMap[chave] = {
          analista_id: resposta.analista_id,
          usuario_id: resposta.usuario_id,
          acertos: 0,
          tempoTotal: 0,
          respostas: [],
        };
      }

      if (resposta.correta) {
        rankingMap[chave].acertos += 1;
      }
      rankingMap[chave].tempoTotal += resposta.tempo_resposta_segundos;
      rankingMap[chave].respostas.push(resposta);
    });

    const ranking = Object.values(rankingMap)
      .sort((a, b) => {
        if (b.acertos !== a.acertos) return b.acertos - a.acertos;
        return a.tempoTotal - b.tempoTotal;
      })
      .slice(0, 5);

    return ranking;
  };

  const getAnalistaNome = (analistaId, usuarioId) => {
    const usuario = usuarios.find(u => u.id === usuarioId);
    if (usuario?.nome_customizado) return usuario.nome_customizado;
    if (usuario?.full_name) return usuario.full_name;
    const analista = analistas.find(a => a.id === analistaId);
    return analista?.nome || 'Usuário';
  };

  const getStatusColor = (status) => {
    if (status === 'Ativo') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (status === 'Encerrado') return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const handleFileUploadIA = (e) => {
    const files = Array.from(e.target.files);
    
    if (arquivosIA.length + files.length > 5) {
      toast.error('Máximo de 5 arquivos permitidos');
      return;
    }

    const filesValidos = files.filter(file => {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`${file.name} excede 2MB`);
        return false;
      }
      return true;
    });

    setArquivosIA([...arquivosIA, ...filesValidos]);
  };

  const removerArquivoIA = (index) => {
    setArquivosIA(arquivosIA.filter((_, i) => i !== index));
  };

  const gerarPerguntaComIA = async () => {
    if (!contextoIA && arquivosIA.length === 0) {
      toast.error('Adicione contexto ou anexe arquivos');
      return;
    }

    setLoadingIA(true);
    try {
      let file_urls = [];
      
      for (const arquivo of arquivosIA) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: arquivo });
        file_urls.push(file_url);
      }

      const prompt = `Você é um especialista em criar questões rápidas sobre processos de suporte técnico N1.

Baseado no contexto fornecido, crie UMA questão de múltipla escolha com as seguintes características:
- 1 pergunta clara e objetiva sobre processos do setor
- 4 alternativas (A, B, C, D)
- Apenas 1 alternativa correta
- Questões sobre: processos, procedimentos, fluxos de trabalho, atendimento, sistemas
${categoriaIA ? `- Categoria específica: ${categoriaIA}` : ''}

Contexto fornecido pelo usuário:
${contextoIA || 'Use os arquivos anexados como referência'}

IMPORTANTE: Retorne APENAS um objeto JSON válido, sem markdown, sem explicações adicionais.

Formato esperado:
{
  "pergunta": "texto da pergunta aqui",
  "alternativa_a": "texto da alternativa A",
  "alternativa_b": "texto da alternativa B",
  "alternativa_c": "texto da alternativa C",
  "alternativa_d": "texto da alternativa D",
  "resposta_correta": "A" ou "B" ou "C" ou "D"
}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        file_urls: file_urls.length > 0 ? file_urls : null,
        response_json_schema: {
          type: 'object',
          properties: {
            pergunta: { type: 'string' },
            alternativa_a: { type: 'string' },
            alternativa_b: { type: 'string' },
            alternativa_c: { type: 'string' },
            alternativa_d: { type: 'string' },
            resposta_correta: { type: 'string', enum: ['A', 'B', 'C', 'D'] }
          }
        }
      });

      setPerguntaGeradaIA(response);
    } catch (error) {
      toast.error('Erro ao gerar pergunta: ' + error.message);
    } finally {
      setLoadingIA(false);
    }
  };

  const aprovarPerguntaIA = () => {
    if (!perguntaGeradaIA) return;
    
    const novaPergunta = {
      ...perguntaGeradaIA,
      ordem: perguntas.length + 1
    };
    
    setPerguntas([...perguntas, novaPergunta]);
    toast.success('Pergunta adicionada!');
    
    setPerguntaGeradaIA(null);
    setGerarComIA(false);
    setContextoIA('');
    setCategoriaIA('');
    setArquivosIA([]);
  };

  const recusarPerguntaIA = () => {
    setPerguntaGeradaIA(null);
    toast.info('Pergunta recusada. Tente gerar outra.');
  };

  const ranking = selectedQuizz ? calcularRanking() : [];

  const jaParticipou = (quizzId) => {
    if (!currentUser || !selectedQuizz || selectedQuizz.id !== quizzId) {
      // Se o quizz não foi carregado, assumir que não participou
      return false;
    }

    // Usar dados já carregados
    const perguntasCount = perguntasQuizz.length;
    if (perguntasCount === 0) return false;

    const respostasDoUsuario = respostasQuizz.filter(
      r => r.usuario_id === currentUser.id
    );

    return respostasDoUsuario.length >= perguntasCount;
  };

  return (
    <div className="space-y-6">
      <QuizzReiDoSuporteWidget />
      <QuizzCarrosselTop3 />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-yellow-400" />
            Quizz Relâmpago
          </h1>
          <p className="text-gray-400 mt-1">Teste seus conhecimentos com perguntas rápidas</p>
        </div>
        {isCoordOrSuper && viewMode === 'list' && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-600 hover:bg-yellow-700 gap-2">
                <Plus className="w-4 h-4" />
                Criar Quizz
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-4xl max-h-[85vh] overflow-y-auto">
               <DialogHeader>
                 <DialogTitle>{editingQuizzId ? 'Editar Quizz Relâmpago' : 'Criar Novo Quizz Relâmpago'}</DialogTitle>
               </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={quizzForm.titulo}
                    onChange={(e) => setQuizzForm({ ...quizzForm, titulo: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
                    placeholder="Ex: Processos de Atendimento"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={quizzForm.descricao}
                    onChange={(e) => setQuizzForm({ ...quizzForm, descricao: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
                    placeholder="Descreva o tema do quizz..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data/Hora Início</Label>
                    <Input
                      type="datetime-local"
                      value={quizzForm.data_inicio}
                      onChange={(e) => setQuizzForm({ ...quizzForm, data_inicio: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2 [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <Label>Data/Hora Fim</Label>
                    <Input
                      type="datetime-local"
                      value={quizzForm.data_fim}
                      onChange={(e) => setQuizzForm({ ...quizzForm, data_fim: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-700 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Perguntas</h3>
                    <div className="flex gap-2">
                      <Button onClick={() => setGerarComIA(true)} size="sm" className="bg-[#ADF802] hover:bg-[#9DE002] text-black">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Gerar com IA
                      </Button>
                      <Button onClick={addPergunta} size="sm" className="bg-yellow-600 hover:bg-yellow-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Manual
                      </Button>
                    </div>
                  </div>

                  {perguntas.map((pergunta, index) => (
                    <Card key={index} className="mb-4 bg-[#1a1a1a] border-gray-700">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Pergunta {index + 1}</CardTitle>
                          {perguntas.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePergunta(index)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label className="text-xs">Pergunta</Label>
                          <Textarea
                            value={pergunta.pergunta}
                            onChange={(e) => updatePergunta(index, 'pergunta', e.target.value)}
                            className="bg-[#0a0a0a] border-gray-600 mt-1"
                            placeholder="Digite a pergunta..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Alternativa A</Label>
                            <Input
                              value={pergunta.alternativa_a}
                              onChange={(e) => updatePergunta(index, 'alternativa_a', e.target.value)}
                              className="bg-[#0a0a0a] border-gray-600 mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Alternativa B</Label>
                            <Input
                              value={pergunta.alternativa_b}
                              onChange={(e) => updatePergunta(index, 'alternativa_b', e.target.value)}
                              className="bg-[#0a0a0a] border-gray-600 mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Alternativa C</Label>
                            <Input
                              value={pergunta.alternativa_c}
                              onChange={(e) => updatePergunta(index, 'alternativa_c', e.target.value)}
                              className="bg-[#0a0a0a] border-gray-600 mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Alternativa D</Label>
                            <Input
                              value={pergunta.alternativa_d}
                              onChange={(e) => updatePergunta(index, 'alternativa_d', e.target.value)}
                              className="bg-[#0a0a0a] border-gray-600 mt-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Resposta Correta</Label>
                          <Select
                            value={pergunta.resposta_correta}
                            onValueChange={(value) => updatePergunta(index, 'resposta_correta', value)}
                          >
                            <SelectTrigger className="bg-[#0a0a0a] border-gray-600 mt-1">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#242424] border-gray-700">
                              <SelectItem value="A">A</SelectItem>
                              <SelectItem value="B">B</SelectItem>
                              <SelectItem value="C">C</SelectItem>
                              <SelectItem value="D">D</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                   <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }} className="border-gray-700">
                     Cancelar
                   </Button>
                   <Button onClick={handleCreateQuizz} className="bg-yellow-600 hover:bg-yellow-700">
                     {editingQuizzId ? 'Salvar Alterações' : 'Criar Quizz'}
                   </Button>
                 </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {viewMode !== 'list' && (
          <Button onClick={() => { setViewMode('list'); setSelectedQuizz(null); }} variant="outline" className="border-gray-700">
            Voltar à Lista
          </Button>
        )}
      </div>

      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quizz) => (
            <Card key={quizz.id} className="bg-[#242424] border-gray-800 hover:border-yellow-500/50 transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      {quizz.titulo}
                    </CardTitle>
                    <CardDescription className="text-gray-400 mt-2">
                      {quizz.descricao}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                           <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(quizz.status)}`}>
                             {quizz.status}
                           </span>
                           {isCoordOrSuper && (
                               <Button
                                 size="sm"
                                 onClick={() => handleToggleStatus(quizz)}
                                 className={quizz.status === 'Ativo' ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs gap-1' : 'bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs gap-1'}
                               >
                                 {quizz.status === 'Ativo' ? '⊘ Inativar' : '✓ Reativar'}
                               </Button>
                             )}
                         </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(quizz.data_inicio), 'dd/MM/yyyy HH:mm')} - {format(new Date(quizz.data_fim), 'dd/MM/yyyy HH:mm')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <User className="w-4 h-4" />
                  <span>Criado por: {quizz.criador_nome}</span>
                </div>
                <div className="flex gap-2 pt-2">
                  {!isCoordOrSuper && quizz.status === 'Ativo' && !jaParticipou(quizz.id) && (
                    <Button onClick={() => iniciarParticipacao(quizz)} className="flex-1 bg-yellow-600 hover:bg-yellow-700">
                      <Play className="w-4 h-4 mr-2" />
                      Participar
                    </Button>
                  )}
                  {!isCoordOrSuper && jaParticipou(quizz.id) && (
                    <Button disabled className="flex-1 bg-gray-600 cursor-not-allowed">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Realizado
                    </Button>
                  )}
                  <Button onClick={() => visualizarResultados(quizz)} variant="outline" className="flex-1 border-gray-700">
                    <Trophy className="w-4 h-4 mr-2" />
                    Ver Ranking
                  </Button>
                  {isCoordOrSuper && (
                    <>
                      <Button onClick={() => handleEditarQuizz(quizz)} variant="outline" className="border-gray-700 gap-2">
                        <Pencil className="w-4 h-4" />
                        Editar
                      </Button>
                      <Button onClick={() => setDeleteQuizzId(quizz.id)} variant="ghost" className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewMode === 'participate' && perguntasQuizz.length > 0 && (
        <Card className="bg-[#242424] border-gray-800 max-w-3xl mx-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">
                Pergunta {participacaoState.perguntaAtual + 1} de {perguntasQuizz.length}
              </CardTitle>
              <div className="flex items-center gap-2 text-yellow-400">
                <Timer className="w-5 h-5" />
                <span className="text-sm font-mono">
                  {((Date.now() - participacaoState.tempoInicio) / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-[#1a1a1a] p-4 rounded-lg">
              <p className="text-white text-lg">{perguntasQuizz[participacaoState.perguntaAtual]?.pergunta}</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {['A', 'B', 'C', 'D'].map((letra) => (
                <Button
                  key={letra}
                  onClick={() => responderPergunta(letra)}
                  className="bg-[#1a1a1a] hover:bg-yellow-600 border border-gray-700 hover:border-yellow-500 text-left h-auto py-4 px-4 justify-start"
                >
                  <span className="font-bold text-yellow-400 mr-3">{letra}</span>
                  <span className="text-white">{perguntasQuizz[participacaoState.perguntaAtual]?.[`alternativa_${letra.toLowerCase()}`]}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'results' && (
        <div className="space-y-6">
          <Card className="bg-[#242424] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                Ranking Top 5 - {selectedQuizz?.titulo}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ranking.length > 0 ? (
                <div className="space-y-3">
                  {ranking.map((participante, index) => (
                   <div key={participante.analista_id} className={`flex items-center gap-4 p-4 rounded-lg border ${
                     index === 0 ? 'bg-yellow-500/10 border-yellow-500/30' :
                     index === 1 ? 'bg-gray-400/10 border-gray-400/30' :
                     index === 2 ? 'bg-amber-600/10 border-amber-600/30' :
                     'bg-[#1a1a1a] border-gray-700'
                   }`}>
                     <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#0a0a0a]">
                       {index === 0 && <Award className="w-6 h-6 text-yellow-400" />}
                       {index === 1 && <Award className="w-6 h-6 text-gray-400" />}
                       {index === 2 && <Award className="w-6 h-6 text-amber-600" />}
                       {index > 2 && <span className="text-gray-400 font-bold">{index + 1}º</span>}
                     </div>
                     <div className="flex-1">
                       <p className="text-white font-semibold">{getAnalistaNome(participante.analista_id, participante.usuario_id)}</p>
                       <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                         <span className="flex items-center gap-1">
                           <CheckCircle className="w-4 h-4 text-green-400" />
                           {participante.acertos} acertos
                         </span>
                         <span className="flex items-center gap-1">
                           <Clock className="w-4 h-4" />
                           {participante.tempoTotal.toFixed(1)}s
                         </span>
                       </div>
                     </div>
                     {isCoordOrSuper && (
                       <Button
                         variant="ghost"
                         size="icon"
                         onClick={() => setDeleteParticipanteData({
                           quizzId: selectedQuizz.id,
                           analistaId: participante.analista_id,
                           nome: getAnalistaNome(participante.analista_id, participante.usuario_id)
                         })}
                         className="text-red-400 hover:text-red-300"
                         title="Remover participação"
                       >
                         <Trash2 className="w-4 h-4" />
                       </Button>
                     )}
                   </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">Nenhuma participação ainda</p>
              )}
            </CardContent>
          </Card>

          {isCoordOrSuper && (
            <Card className="bg-[#242424] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Perguntas e Respostas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {perguntasQuizz.map((pergunta, index) => (
                  <div key={pergunta.id} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-700">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-white font-medium">
                        {index + 1}. {pergunta.pergunta}
                      </p>
                      {isCoordOrSuper && (
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => setDeletePerguntaId(pergunta.id)}
                         className="text-red-400 hover:text-red-300"
                       >
                         <Trash2 className="w-4 h-4" />
                       </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {['A', 'B', 'C', 'D'].map((letra) => (
                        <div
                          key={letra}
                          className={`p-2 rounded ${
                            pergunta.resposta_correta === letra
                              ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                              : 'bg-[#0a0a0a] text-gray-400'
                          }`}
                        >
                          <span className="font-bold">{letra})</span> {pergunta[`alternativa_${letra.toLowerCase()}`]}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteQuizzId} onOpenChange={() => setDeleteQuizzId(null)}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Excluir Quizz?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Esta ação excluirá o quizz, todas as perguntas e respostas. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteQuizzMutation.mutate(deleteQuizzId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePerguntaId} onOpenChange={() => setDeletePerguntaId(null)}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Excluir Pergunta?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Esta ação excluirá a pergunta e todas as respostas associadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePerguntaMutation.mutate(deletePerguntaId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteParticipanteData} onOpenChange={() => setDeleteParticipanteData(null)}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remover Participação?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Isso permitirá que <span className="font-semibold text-white">{deleteParticipanteData?.nome}</span> participe novamente deste quizz.
              Todas as respostas anteriores serão excluídas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteParticipanteMutation.mutate({
                quizzId: deleteParticipanteData?.quizzId,
                analistaId: deleteParticipanteData?.analistaId
              })}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover Participação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={gerarComIA} onOpenChange={setGerarComIA}>
        <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#ADF802]" />
              Gerar Pergunta com Inteligência Artificial
            </DialogTitle>
          </DialogHeader>

          {!perguntaGeradaIA ? (
            <div className="space-y-4">
              <div>
                <Label>Categoria (opcional)</Label>
                <Input
                  value={categoriaIA}
                  onChange={(e) => setCategoriaIA(e.target.value)}
                  className="bg-[#1a1a1a] border-gray-700 mt-2"
                  placeholder="Ex: Processos de Atendimento, Sistema..."
                />
              </div>

              <div>
                <Label>Contexto / Base de Conhecimento</Label>
                <Textarea
                  value={contextoIA}
                  onChange={(e) => setContextoIA(e.target.value)}
                  className="bg-[#1a1a1a] border-gray-700 mt-2 h-32"
                  placeholder="Cole aqui o texto base para a IA gerar a pergunta..."
                />
              </div>

              <div>
                <Label>Anexar Arquivos (Máx: 5 arquivos de 2MB cada)</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                    onChange={handleFileUploadIA}
                    className="hidden"
                    id="file-upload-ia"
                  />
                  <label htmlFor="file-upload-ia">
                    <Button type="button" variant="outline" className="border-gray-700 w-full" asChild>
                      <span className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Selecionar Arquivos ({arquivosIA.length}/5)
                      </span>
                    </Button>
                  </label>
                </div>
                {arquivosIA.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {arquivosIA.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-[#1a1a1a] p-2 rounded border border-gray-700">
                        <span className="text-sm text-gray-300 truncate">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removerArquivoIA(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                onClick={gerarPerguntaComIA}
                disabled={loadingIA}
                className="w-full bg-[#ADF802] hover:bg-[#9DE002] text-black font-bold"
              >
                {loadingIA ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando Pergunta...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Gerar Pergunta
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-[#ADF802]">Pergunta Gerada</span>
                </div>
                
                <p className="font-semibold text-white mb-4">{perguntaGeradaIA.pergunta}</p>
                
                <div className="space-y-2">
                  {['a', 'b', 'c', 'd'].map((letra) => (
                    <div
                      key={letra}
                      className={`p-3 rounded-lg border ${
                        perguntaGeradaIA.resposta_correta === letra.toUpperCase()
                          ? 'bg-green-500/20 border-green-500/50'
                          : 'bg-[#0a0a0a] border-gray-700'
                      }`}
                    >
                      <span className="font-bold text-[#ADF802]">{letra.toUpperCase()})</span>{' '}
                      <span className="text-gray-300">{perguntaGeradaIA[`alternativa_${letra}`]}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                  <span>Resposta Correta: {perguntaGeradaIA.resposta_correta}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={recusarPerguntaIA}
                  variant="outline"
                  className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                  <X className="w-4 h-4 mr-2" />
                  Recusar
                </Button>
                <Button
                  onClick={aprovarPerguntaIA}
                  className="flex-1 bg-[#ADF802] hover:bg-[#9DE002] text-black font-bold"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aprovar e Adicionar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}