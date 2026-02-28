import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Zap, Plus, Trophy, Clock, CheckCircle, Pencil, Trash2, Play, Calendar, User, Award, Timer, Sparkles, Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import QuizzReiDoSuporteWidget from '@/components/QuizzReiDoSuporteWidget';
import QuizzCarrosselTop3 from '@/components/QuizzCarrosselTop3';
import { notificarCoordenadores } from '@/components/notificationHelper';

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function getStatusByDate(data_inicio) {
  const inicio = new Date(data_inicio);
  return inicio <= new Date() ? 'Ativo' : 'Agendado';
}

export default function QuizzRelampago() {
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedQuizz, setSelectedQuizz] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'participate', 'results'
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
    tempoInicio: null,
  });

  const [nowTick, setNowTick] = useState(Date.now());
  const [isAnswering, setIsAnswering] = useState(false);

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

  const role = useMemo(() => normalizeRole(currentUser?.role), [currentUser?.role]);

  // ✅ Defina aqui quem cria/edita e quem participa
  const isAdmin = role === 'admin';
  const isSupervisor = role === 'supervisor';
  const isNoc = role === 'noc';
  const canManageQuiz = isAdmin || isSupervisor || isNoc;

  // Se no seu sistema o analista pode vir como "analista" OU "analyst", suportamos ambos:
  const isAnalyst = role === 'analista' || role === 'analyst';

  const { data: quizzes = [], isLoading: loadingQuizzes } = useQuery({
    queryKey: ['quizzRelampago'],
    queryFn: async () => {
      const todosQuizzes = await base44.entities.QuizzRelampago.list('-created_date', 50);

      // Admin/supervisor/noc veem tudo
      if (canManageQuiz) return todosQuizzes;

      // Analistas veem apenas quizzes aprovados e ativos
      const aprovacoes = await base44.entities.AprovacaoAtividade.filter({ tipo: 'quizz', status: 'aprovado' });
      const aprovados = new Set(aprovacoes.map(a => a.atividade_id));

      return todosQuizzes.filter(q => aprovados.has(q.id) && q.status === 'Ativo');
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Só admin/supervisor/noc pode listar usuários/analistas
const { data: analistas = [] } = useQuery({
  queryKey: ['analistas'],
  queryFn: () => base44.entities.Analista.list(),
  staleTime: 10 * 60 * 1000,
  enabled: canManageQuiz, // <-- ADICIONE ISSO
});

const { data: usuarios = [] } = useQuery({
  queryKey: ['usuarios'],
  queryFn: () => base44.entities.User.list(),
  staleTime: 10 * 60 * 1000,
  enabled: canManageQuiz, // <-- ADICIONE ISSO
});

  const { data: perguntasQuizz = [], isLoading: loadingPerguntas } = useQuery({
    queryKey: ['perguntasQuizz', selectedQuizz?.id],
    queryFn: () => base44.entities.PerguntaQuizz.filter({ quizz_id: selectedQuizz.id }, 'ordem'),
    enabled: !!selectedQuizz,
  });

  const { data: respostasQuizz = [] } = useQuery({
  queryKey: ['respostasQuizz', selectedQuizz?.id],
  queryFn: () => base44.entities.RespostaQuizz.filter({ quizz_id: selectedQuizz.id }),
  enabled: !!selectedQuizz,
  staleTime: 5 * 60 * 1000,
});

// 🔹 Para ANALISTA (somente as próprias respostas)
const { data: minhasRespostasQuizz = [] } = useQuery({
  queryKey: ['minhasRespostasQuizz', currentUser?.id],
  enabled: !!currentUser && !canManageQuiz,
  queryFn: async () => {
    return await base44.entities.RespostaQuizz.filter({ usuario_id: currentUser.id });
  },
  staleTime: 2 * 60 * 1000,
});

// 🔹 Para ADMIN / SUPERVISOR / NOC (todas respostas)
const { data: todasRespostasQuizz = [] } = useQuery({
  queryKey: ['todasRespostasQuizz'],
  enabled: !!currentUser && canManageQuiz,
  queryFn: () => base44.entities.RespostaQuizz.list(),
  staleTime: 5 * 60 * 1000,
});

  // ✅ Timer “de verdade” (re-render enquanto participa)
  useEffect(() => {
    if (viewMode !== 'participate') return;
    const id = setInterval(() => setNowTick(Date.now()), 100);
    return () => clearInterval(id);
  }, [viewMode]);

  const createQuizzMutation = useMutation({
    mutationFn: async (data) => {
      const quizz = await base44.entities.QuizzRelampago.create(data.quizz);

      await base44.entities.AprovacaoAtividade.create({
        atividade_id: quizz.id,
        tipo: 'quizz',
        status: 'pendente'
      });

      const perguntasData = data.perguntas.map((p, idx) => ({
        ...p,
        quizz_id: quizz.id,
        ordem: idx + 1,
      }));

      await base44.entities.PerguntaQuizz.bulkCreate(perguntasData);

      await notificarCoordenadores(
        'novo_quizz',
        'Novo Quizz Criado',
        `${currentUser?.full_name || 'Usuário'} criou um novo quizz: ${data.quizz.titulo} - Aguardando aprovação`,
        'Aprovacao'
      );

      return quizz;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzRelampago'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] });
      toast.success('Quizz enviado para aprovação!');
      resetForm();
      setIsCreateDialogOpen(false);
    },
    onError: (e) => toast.error(e?.message || 'Erro ao criar quizz'),
  });

  // ✅ Editar quizz + perguntas (substitui perguntas)
  const updateQuizzFullMutation = useMutation({
    mutationFn: async ({ id, data, perguntas }) => {
      await base44.entities.QuizzRelampago.update(id, data);

      // Substitui perguntas (simples e estável)
      const existentes = await base44.entities.PerguntaQuizz.filter({ quizz_id: id });
      for (const p of existentes) {
        await base44.entities.PerguntaQuizz.delete(p.id);
      }

      const novas = perguntas.map((p, idx) => ({
        ...p,
        quizz_id: id,
        ordem: idx + 1,
      }));

      await base44.entities.PerguntaQuizz.bulkCreate(novas);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzRelampago'] });
      if (selectedQuizz?.id) queryClient.invalidateQueries({ queryKey: ['perguntasQuizz', selectedQuizz.id] });
      toast.success('Quizz atualizado!');
      setEditingQuizzId(null);
      resetForm();
      setIsCreateDialogOpen(false);
    },
    onError: (e) => toast.error(e?.message || 'Erro ao atualizar quizz'),
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
    onError: (e) => toast.error(e?.message || 'Erro ao excluir quizz'),
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
      queryClient.invalidateQueries({ queryKey: ['perguntasQuizz', selectedQuizz?.id] });
      toast.success('Pergunta excluída!');
      setDeletePerguntaId(null);
    },
    onError: (e) => toast.error(e?.message || 'Erro ao excluir pergunta'),
  });

  const submeterRespostaMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.RespostaQuizz.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['respostasQuizz', selectedQuizz?.id] });
      queryClient.invalidateQueries({ queryKey: ['todasRespostasQuizz'] });
    },
    onError: (e) => toast.error(e?.message || 'Erro ao enviar resposta'),
  });

  const deleteParticipanteMutation = useMutation({
    mutationFn: async ({ quizzId, usuarioId }) => {
      if (!isAdmin) throw new Error('Apenas Administrador pode remover participações');

      const respostas = await base44.entities.RespostaQuizz.filter({
        quizz_id: quizzId,
        usuario_id: usuarioId
      });

      for (const resposta of respostas) {
        await base44.entities.RespostaQuizz.delete(resposta.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['respostasQuizz', selectedQuizz?.id] });
      queryClient.invalidateQueries({ queryKey: ['todasRespostasQuizz'] });
      toast.success('Participação removida! O analista pode participar novamente.');
      setDeleteParticipanteData(null);
    },
    onError: (error) => toast.error(error.message || 'Erro ao remover participação'),
  });

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
    setPerguntaGeradaIA(null);
    setGerarComIA(false);
    setArquivosIA([]);
    setContextoIA('');
    setCategoriaIA('');
  };

  const handleCreateOrUpdate = () => {
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

    const status = getStatusByDate(quizzForm.data_inicio);

    if (editingQuizzId) {
      updateQuizzFullMutation.mutate({
        id: editingQuizzId,
        data: { ...quizzForm, status },
        perguntas,
      });
    } else {
      createQuizzMutation.mutate({
        quizz: {
          ...quizzForm,
          criado_por: currentUser.email,
          criador_nome: currentUser.full_name,
          status,
        },
        perguntas,
      });
    }
  };

  const handleEditarQuizz = async (quizz) => {
    try {
      setEditingQuizzId(quizz.id);
      setQuizzForm({
        titulo: quizz.titulo,
        descricao: quizz.descricao,
        data_inicio: quizz.data_inicio,
        data_fim: quizz.data_fim,
      });

      // ✅ Carregar perguntas no form
      const qs = await base44.entities.PerguntaQuizz.filter({ quizz_id: quizz.id }, 'ordem');
      setPerguntas(
        (qs?.length ? qs : [{ pergunta: '', alternativa_a: '', alternativa_b: '', alternativa_c: '', alternativa_d: '', resposta_correta: '', ordem: 1 }])
          .map((p, idx) => ({
            pergunta: p.pergunta || '',
            alternativa_a: p.alternativa_a || '',
            alternativa_b: p.alternativa_b || '',
            alternativa_c: p.alternativa_c || '',
            alternativa_d: p.alternativa_d || '',
            resposta_correta: p.resposta_correta || '',
            ordem: idx + 1,
          }))
      );

      setIsCreateDialogOpen(true);
    } catch (e) {
      toast.error(e?.message || 'Erro ao carregar perguntas para edição');
    }
  };

  const updatePergunta = (index, field, value) => {
    setPerguntas((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addPergunta = () => {
    setPerguntas((prev) => [
      ...prev,
      { pergunta: '', alternativa_a: '', alternativa_b: '', alternativa_c: '', alternativa_d: '', resposta_correta: '', ordem: prev.length + 1 }
    ]);
  };

  const removePergunta = (index) => {
    setPerguntas((prev) => prev.filter((_, i) => i !== index).map((p, idx) => ({ ...p, ordem: idx + 1 })));
  };

  const getStatusColor = (status) => {
    if (status === 'Ativo') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (status === 'Encerrado') return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const getAnalistaNome = (analistaId, usuarioId) => {
  // Se não tem permissão para listar usuários, mostra algo seguro
  if (!canManageQuiz) {
    // se for o próprio usuário logado, mostra o nome dele
    if (usuarioId === currentUser?.id) {
      return currentUser?.nome_customizado || currentUser?.full_name || currentUser?.email || 'Você';
    }
    return 'Participante';
  }

  const usuario = usuarios.find(u => u.id === usuarioId);
  if (usuario?.nome_customizado) return usuario.nome_customizado;
  if (usuario?.full_name) return usuario.full_name;

  const analista = analistas.find(a => a.id === analistaId);
  return analista?.nome || 'Usuário';
};

  const jaParticipou = useCallback((quizzId) => {
  if (!currentUser) return false;

  // Se pode gerenciar, usa o "todasRespostasQuizz"
  // Se é analista, usa só as "minhasRespostasQuizz"
  const fonte = canManageQuiz ? todasRespostasQuizz : minhasRespostasQuizz;

  return fonte.some(r => r.quizz_id === quizzId && r.usuario_id === currentUser.id);
}, [todasRespostasQuizz, minhasRespostasQuizz, currentUser, canManageQuiz]);

  const iniciarParticipacao = (quizz) => {
    if (!isAnalyst) {
      toast.error('Apenas analistas podem participar.');
      return;
    }
    if (jaParticipou(quizz.id)) {
      toast.error('Você já participou deste quizz!');
      return;
    }

    setSelectedQuizz(quizz);
    setViewMode('participate');
    setParticipacaoState({
      perguntaAtual: 0,
      tempoInicio: Date.now(),
    });
    setIsAnswering(false);
  };

  const responderPergunta = async (alternativa) => {
    if (isAnswering) return; // trava spam
    if (!selectedQuizz) return;
    const perguntaAtual = perguntasQuizz[participacaoState.perguntaAtual];
    if (!perguntaAtual) return;

    setIsAnswering(true);
    try {
      const tempoResposta = ((Date.now() - participacaoState.tempoInicio) / 1000);

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

      if (participacaoState.perguntaAtual < perguntasQuizz.length - 1) {
        setParticipacaoState((prev) => ({
          perguntaAtual: prev.perguntaAtual + 1,
          tempoInicio: Date.now(),
        }));
      } else {
        await queryClient.invalidateQueries({ queryKey: ['todasRespostasQuizz'] });
        await queryClient.invalidateQueries({ queryKey: ['respostasQuizz', selectedQuizz.id] });
        toast.success('Quizz concluído! Confira o ranking.');
        setViewMode('results');
      }
    } finally {
      setIsAnswering(false);
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
        };
      }

      if (resposta.correta) rankingMap[chave].acertos += 1;
      rankingMap[chave].tempoTotal += resposta.tempo_resposta_segundos;
    });

    return Object.values(rankingMap)
      .sort((a, b) => (b.acertos !== a.acertos ? b.acertos - a.acertos : a.tempoTotal - b.tempoTotal))
      .slice(0, 5);
  };

  const ranking = selectedQuizz ? calcularRanking() : [];

  const handleToggleStatus = (quizz) => {
    const novoStatus = quizz.status === 'Ativo' ? 'Encerrado' : 'Ativo';
    base44.entities.QuizzRelampago.update(quizz.id, { status: novoStatus })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['quizzRelampago'] });
        toast.success('Status atualizado!');
      })
      .catch((e) => toast.error(e?.message || 'Erro ao alterar status'));
  };

  const handleFileUploadIA = (e) => {
    const files = Array.from(e.target.files || []);

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

    setArquivosIA(prev => [...prev, ...filesValidos]);
  };

  const removerArquivoIA = (index) => {
    setArquivosIA(prev => prev.filter((_, i) => i !== index));
  };

  const gerarPerguntaComIA = async () => {
    if (!contextoIA && arquivosIA.length === 0) {
      toast.error('Adicione contexto ou anexe arquivos');
      return;
    }

    setLoadingIA(true);
    try {
      const file_urls = [];
      for (const arquivo of arquivosIA) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: arquivo });
        file_urls.push(file_url);
      }

      const prompt = `Você é um especialista em criar questões rápidas sobre processos de suporte técnico N1.

Baseado no contexto fornecido, crie UMA questão de múltipla escolha com:
- 1 pergunta clara
- 4 alternativas (A, B, C, D)
- Apenas 1 correta
${categoriaIA ? `- Categoria: ${categoriaIA}` : ''}

Contexto:
${contextoIA || 'Use os arquivos anexados como referência'}

Retorne APENAS um objeto JSON válido, sem markdown.`;

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
      toast.error('Erro ao gerar pergunta: ' + (error?.message || ''));
    } finally {
      setLoadingIA(false);
    }
  };

  const aprovarPerguntaIA = () => {
    if (!perguntaGeradaIA) return;

    setPerguntas(prev => [
      ...prev,
      { ...perguntaGeradaIA, ordem: prev.length + 1 }
    ]);

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

  if (loadingQuizzes) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  const elapsedSeconds =
    viewMode === 'participate' && participacaoState.tempoInicio
      ? ((nowTick - participacaoState.tempoInicio) / 1000).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {canManageQuiz && <QuizzReiDoSuporteWidget />}
      {canManageQuiz && <QuizzCarrosselTop3 />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-yellow-400" />
            Quizz Relâmpago
          </h1>
          <p className="text-gray-400 mt-1">Teste seus conhecimentos com perguntas rápidas</p>
        </div>

        {canManageQuiz && viewMode === 'list' && (
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
                          {['a', 'b', 'c', 'd'].map((letra) => (
                            <div key={letra}>
                              <Label className="text-xs">Alternativa {letra.toUpperCase()}</Label>
                              <Input
                                value={pergunta[`alternativa_${letra}`]}
                                onChange={(e) => updatePergunta(index, `alternativa_${letra}`, e.target.value)}
                                className="bg-[#0a0a0a] border-gray-600 mt-1"
                              />
                            </div>
                          ))}
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
                  <Button
                    variant="outline"
                    onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}
                    className="border-gray-700"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreateOrUpdate}
                    className="bg-yellow-600 hover:bg-yellow-700"
                    disabled={createQuizzMutation.isPending || updateQuizzFullMutation.isPending}
                  >
                    {(createQuizzMutation.isPending || updateQuizzFullMutation.isPending) ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando...
                      </span>
                    ) : (
                      editingQuizzId ? 'Salvar Alterações' : 'Criar Quizz'
                    )}
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

      {/* LISTA */}
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
                    <CardDescription className="text-gray-400 mt-2">{quizz.descricao}</CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(quizz.status)}`}>
                      {quizz.status}
                    </span>
                    {canManageQuiz && (
                      <Button
                        size="sm"
                        onClick={() => handleToggleStatus(quizz)}
                        className={quizz.status === 'Ativo'
                          ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs gap-1'
                          : 'bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs gap-1'}
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

                <div className="flex gap-2 pt-2 flex-wrap">
                  {isAnalyst && quizz.status === 'Ativo' && !jaParticipou(quizz.id) && (
                    <Button onClick={() => iniciarParticipacao(quizz)} className="flex-1 bg-yellow-600 hover:bg-yellow-700">
                      <Play className="w-4 h-4 mr-2" />
                      Participar
                    </Button>
                  )}

                  {isAnalyst && jaParticipou(quizz.id) && (
                    <Button disabled className="flex-1 bg-gray-600 cursor-not-allowed">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Realizado
                    </Button>
                  )}

                  <Button onClick={() => visualizarResultados(quizz)} variant="outline" className="flex-1 border-gray-700">
                    <Trophy className="w-4 h-4 mr-2" />
                    Ver Ranking
                  </Button>

                  {canManageQuiz && (
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

      {/* PARTICIPAR */}
      {viewMode === 'participate' && (
        <Card className="bg-[#242424] border-gray-800 max-w-3xl mx-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">
                {loadingPerguntas ? 'Carregando...' : `Pergunta ${participacaoState.perguntaAtual + 1} de ${perguntasQuizz.length}`}
              </CardTitle>
              <div className="flex items-center gap-2 text-yellow-400">
                <Timer className="w-5 h-5" />
                <span className="text-sm font-mono">{elapsedSeconds}s</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {loadingPerguntas ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
              </div>
            ) : perguntasQuizz.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Nenhuma pergunta cadastrada para este quizz.</p>
            ) : (
              <>
                <div className="bg-[#1a1a1a] p-4 rounded-lg">
                  <p className="text-white text-lg">{perguntasQuizz[participacaoState.perguntaAtual]?.pergunta}</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {['A', 'B', 'C', 'D'].map((letra) => (
                    <Button
                      key={letra}
                      onClick={() => responderPergunta(letra)}
                      disabled={isAnswering || submeterRespostaMutation.isPending}
                      className="bg-[#1a1a1a] hover:bg-yellow-600 border border-gray-700 hover:border-yellow-500 text-left h-auto py-4 px-4 justify-start"
                    >
                      <span className="font-bold text-yellow-400 mr-3">{letra}</span>
                      <span className="text-white">
                        {perguntasQuizz[participacaoState.perguntaAtual]?.[`alternativa_${letra.toLowerCase()}`]}
                      </span>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* RESULTADOS */}
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
                    <div
                      key={`${participante.usuario_id}-${index}`}
                      className={`flex items-center gap-4 p-4 rounded-lg border ${
                        index === 0 ? 'bg-yellow-500/10 border-yellow-500/30' :
                        index === 1 ? 'bg-gray-400/10 border-gray-400/30' :
                        index === 2 ? 'bg-amber-600/10 border-amber-600/30' :
                        'bg-[#1a1a1a] border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#0a0a0a]">
                        {index <= 2 ? <Award className={`w-6 h-6 ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-400' : 'text-amber-600'}`} /> : <span className="text-gray-400 font-bold">{index + 1}º</span>}
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

                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteParticipanteData({
                            quizzId: selectedQuizz.id,
                            usuarioId: participante.usuario_id,
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

          {canManageQuiz && (
            <Card className="bg-[#242424] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Perguntas e Respostas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {perguntasQuizz.map((pergunta, index) => (
                  <div key={pergunta.id} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-700">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-white font-medium">{index + 1}. {pergunta.pergunta}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletePerguntaId(pergunta.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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

      {/* ALERTS */}
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
              Isso permitirá que <span className="font-semibold text-white">{deleteParticipanteData?.nome}</span> participe novamente.
              Todas as respostas anteriores serão excluídas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteParticipanteMutation.mutate({
                quizzId: deleteParticipanteData?.quizzId,
                usuarioId: deleteParticipanteData?.usuarioId
              })}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover Participação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* IA */}
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
                  placeholder="Cole aqui o texto base..."
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
                <div className="mt-4 text-xs text-gray-400">
                  Resposta Correta: {perguntaGeradaIA.resposta_correta}
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