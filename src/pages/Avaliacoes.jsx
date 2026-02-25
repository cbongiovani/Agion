import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  FileText, Upload, Sparkles, Check, X, Plus, Loader2, 
  BookOpen, ClipboardCheck, AlertCircle, Trash2, Eye 
} from 'lucide-react';

export default function Avaliacoes() {
  const queryClient = useQueryClient();
  const [isGerarQuestaoOpen, setIsGerarQuestaoOpen] = useState(false);
  const [isGerarProvaOpen, setIsGerarProvaOpen] = useState(false);
  const [arquivos, setArquivos] = useState([]);
  const [contexto, setContexto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [questaoGerada, setQuestaoGerada] = useState(null);
  const [loadingIA, setLoadingIA] = useState(false);
  const [periodoSelecionado, setPeriodoSelecionado] = useState('AT1');
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: questoes = [], isLoading } = useQuery({
    queryKey: ['questoes'],
    queryFn: () => base44.entities.Questao.list('-created_date'),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ['avaliacoes'],
    queryFn: () => base44.entities.Avaliacao.list('-created_date'),
  });

  const salvarQuestaoMutation = useMutation({
    mutationFn: (data) => base44.entities.Questao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questoes'] });
      toast.success('Questão salva com sucesso!');
      setQuestaoGerada(null);
      setIsGerarQuestaoOpen(false);
      resetForm();
    },
  });

  const aprovarQuestaoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Questao.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questoes'] });
      toast.success('Questão aprovada!');
    },
  });

  const deletarQuestaoMutation = useMutation({
    mutationFn: (id) => base44.entities.Questao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questoes'] });
      toast.success('Questão deletada!');
    },
  });

  const gerarProvasMutation = useMutation({
    mutationFn: async ({ periodo, ano }) => {
      const questoesAprovadas = questoes.filter(q => q.status === 'Aprovada');
      
      if (questoesAprovadas.length < 20) {
        throw new Error('É necessário ter no mínimo 20 questões aprovadas na base de conhecimento');
      }

      const provasCriadas = [];
      
      for (const analista of analistas) {
        const questoesShuffled = [...questoesAprovadas].sort(() => Math.random() - 0.5);
        const questoesSelecionadas = questoesShuffled.slice(0, 20).map(q => q.id);
        
        const prova = await base44.entities.Avaliacao.create({
          titulo: `Avaliação ${periodo} - ${ano}`,
          periodo,
          ano,
          analista_id: analista.id,
          questoes: questoesSelecionadas,
          data_inicio: new Date().toISOString(),
          data_fim: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'Pendente',
          criado_por: currentUser?.email
        });
        
        provasCriadas.push(prova);
      }
      
      return provasCriadas;
    },
    onSuccess: (provas) => {
      queryClient.invalidateQueries({ queryKey: ['avaliacoes'] });
      toast.success(`${provas.length} provas geradas com sucesso!`);
      setIsGerarProvaOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao gerar provas');
    }
  });

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    
    if (arquivos.length + files.length > 5) {
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

    setArquivos([...arquivos, ...filesValidos]);
  };

  const removerArquivo = (index) => {
    setArquivos(arquivos.filter((_, i) => i !== index));
  };

  const gerarQuestaoComIA = async () => {
    if (!contexto && arquivos.length === 0) {
      toast.error('Adicione contexto ou anexe arquivos');
      return;
    }

    setLoadingIA(true);
    try {
      let file_urls = [];
      
      for (const arquivo of arquivos) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: arquivo });
        file_urls.push(file_url);
      }

      const prompt = `Você é um especialista em criar questões de avaliação técnica para analistas de suporte N1.

Baseado no contexto fornecido, crie UMA questão de múltipla escolha com as seguintes características:
- 1 enunciado claro e objetivo
- 4 alternativas (A, B, C, D)
- Apenas 1 alternativa correta
- Questões sobre: sistemas operacionais, hardware, redes, troubleshooting, atendimento ao cliente
${categoria ? `- Categoria específica: ${categoria}` : ''}

Contexto fornecido pelo usuário:
${contexto || 'Use os arquivos anexados como referência'}

IMPORTANTE: Retorne APENAS um objeto JSON válido, sem markdown, sem explicações adicionais.

Formato esperado:
{
  "enunciado": "texto da questão aqui",
  "alternativa_a": "texto da alternativa A",
  "alternativa_b": "texto da alternativa B",
  "alternativa_c": "texto da alternativa C",
  "alternativa_d": "texto da alternativa D",
  "resposta_correta": "A" ou "B" ou "C" ou "D",
  "categoria": "nome da categoria",
  "dificuldade": "Fácil" ou "Média" ou "Difícil",
  "fonte": "descrição da fonte ou 'Gerado por IA'"
}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        file_urls: file_urls.length > 0 ? file_urls : null,
        response_json_schema: {
          type: 'object',
          properties: {
            enunciado: { type: 'string' },
            alternativa_a: { type: 'string' },
            alternativa_b: { type: 'string' },
            alternativa_c: { type: 'string' },
            alternativa_d: { type: 'string' },
            resposta_correta: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
            categoria: { type: 'string' },
            dificuldade: { type: 'string', enum: ['Fácil', 'Média', 'Difícil'] },
            fonte: { type: 'string' }
          }
        }
      });

      setQuestaoGerada({
        ...response,
        status: 'Pendente',
        criado_por: currentUser?.email
      });
    } catch (error) {
      toast.error('Erro ao gerar questão: ' + error.message);
    } finally {
      setLoadingIA(false);
    }
  };

  const aprovarQuestao = () => {
    if (!questaoGerada) return;
    salvarQuestaoMutation.mutate({ ...questaoGerada, status: 'Aprovada' });
  };

  const recusarQuestao = () => {
    setQuestaoGerada(null);
    toast.info('Questão recusada. Tente gerar outra.');
  };

  const resetForm = () => {
    setContexto('');
    setCategoria('');
    setArquivos([]);
  };

  const questoesAprovadas = questoes.filter(q => q.status === 'Aprovada').length;
  const questoesPendentes = questoes.filter(q => q.status === 'Pendente').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#ADF802]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Avaliações</h1>
          <p className="text-gray-400 mt-1">Crie questões com IA e gere provas personalizadas</p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isGerarQuestaoOpen} onOpenChange={setIsGerarQuestaoOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#ADF802] hover:bg-[#9DE002] text-black font-bold gap-2">
                <Sparkles className="w-4 h-4" />
                Gerar Questão com IA
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d0d0d] border-gray-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#ADF802]" />
                  Gerar Questão com Inteligência Artificial
                </DialogTitle>
              </DialogHeader>

              {!questaoGerada ? (
                <div className="space-y-4">
                  <div>
                    <Label>Categoria (opcional)</Label>
                    <Input
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                      placeholder="Ex: Sistema Operacional, Hardware, Rede..."
                    />
                  </div>

                  <div>
                    <Label>Contexto / Base de Conhecimento</Label>
                    <Textarea
                      value={contexto}
                      onChange={(e) => setContexto(e.target.value)}
                      className="bg-[#1a1a1a] border-gray-700 mt-2 h-32"
                      placeholder="Cole aqui o texto base para a IA gerar a questão..."
                    />
                  </div>

                  <div>
                    <Label>Anexar Arquivos (Máx: 5 arquivos de 2MB cada)</Label>
                    <div className="mt-2">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload">
                        <Button type="button" variant="outline" className="border-gray-700 w-full" asChild>
                          <span className="cursor-pointer">
                            <Upload className="w-4 h-4 mr-2" />
                            Selecionar Arquivos ({arquivos.length}/5)
                          </span>
                        </Button>
                      </label>
                    </div>
                    {arquivos.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {arquivos.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-[#1a1a1a] p-2 rounded border border-gray-700">
                            <span className="text-sm text-gray-300 truncate">{file.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removerArquivo(index)}
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
                    onClick={gerarQuestaoComIA}
                    disabled={loadingIA}
                    className="w-full bg-[#ADF802] hover:bg-[#9DE002] text-black font-bold"
                  >
                    {loadingIA ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Gerando Questão...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Gerar Questão
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-[#ADF802]">Questão Gerada</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        questaoGerada.dificuldade === 'Fácil' ? 'bg-green-500/20 text-green-400' :
                        questaoGerada.dificuldade === 'Média' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {questaoGerada.dificuldade}
                      </span>
                    </div>
                    
                    <p className="font-semibold text-white mb-4">{questaoGerada.enunciado}</p>
                    
                    <div className="space-y-2">
                      {['a', 'b', 'c', 'd'].map((letra) => (
                        <div
                          key={letra}
                          className={`p-3 rounded-lg border ${
                            questaoGerada.resposta_correta === letra.toUpperCase()
                              ? 'bg-green-500/20 border-green-500/50'
                              : 'bg-[#0a0a0a] border-gray-700'
                          }`}
                        >
                          <span className="font-bold text-[#ADF802]">{letra.toUpperCase()})</span>{' '}
                          <span className="text-gray-300">{questaoGerada[`alternativa_${letra}`]}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                      <span>Categoria: {questaoGerada.categoria}</span>
                      <span>•</span>
                      <span>Resposta: {questaoGerada.resposta_correta}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={recusarQuestao}
                      variant="outline"
                      className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Recusar
                    </Button>
                    <Button
                      onClick={aprovarQuestao}
                      disabled={salvarQuestaoMutation.isPending}
                      className="flex-1 bg-[#ADF802] hover:bg-[#9DE002] text-black font-bold"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Aprovar e Salvar
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isGerarProvaOpen} onOpenChange={setIsGerarProvaOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Gerar Provas
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d0d0d] border-gray-800 text-white">
              <DialogHeader>
                <DialogTitle>Gerar Provas para Analistas</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-700">
                  <p className="text-sm text-gray-300 mb-2">
                    Serão geradas provas personalizadas com 20 questões aleatórias para cada analista.
                  </p>
                  <p className="text-xs text-gray-400">
                    Questões aprovadas disponíveis: <span className="font-bold text-[#ADF802]">{questoesAprovadas}</span>
                  </p>
                </div>

                <div>
                  <Label>Período da Avaliação</Label>
                  <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
                    <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#242424] border-gray-700">
                      <SelectItem value="AT1">AT1 - Março</SelectItem>
                      <SelectItem value="AT2">AT2 - Junho</SelectItem>
                      <SelectItem value="AT3">AT3 - Setembro</SelectItem>
                      <SelectItem value="AT4">AT4 - Dezembro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Ano</Label>
                  <Input
                    type="number"
                    value={anoSelecionado}
                    onChange={(e) => setAnoSelecionado(parseInt(e.target.value))}
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
                  />
                </div>

                <Button
                  onClick={() => gerarProvasMutation.mutate({ periodo: periodoSelecionado, ano: anoSelecionado })}
                  disabled={gerarProvasMutation.isPending || questoesAprovadas < 20}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {gerarProvasMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando Provas...
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="w-4 h-4 mr-2" />
                      Gerar Provas para {analistas.length} Analistas
                    </>
                  )}
                </Button>

                {questoesAprovadas < 20 && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <p className="text-xs text-red-400">
                      Você precisa ter no mínimo 20 questões aprovadas para gerar provas.
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#0d0d0d] border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400">Base de Conhecimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-white">{questoesAprovadas}</p>
                <p className="text-xs text-gray-500">de 100 questões aprovadas</p>
              </div>
              <BookOpen className="w-8 h-8 text-[#ADF802]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0d0d0d] border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400">Questões Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-yellow-400">{questoesPendentes}</p>
                <p className="text-xs text-gray-500">aguardando aprovação</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0d0d0d] border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400">Provas Geradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-emerald-400">{avaliacoes.length}</p>
                <p className="text-xs text-gray-500">total de avaliações</p>
              </div>
              <ClipboardCheck className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Questões */}
      <div className="bg-[#0d0d0d] rounded-2xl border border-gray-800 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#ADF802]" />
          Base de Conhecimento ({questoes.length} questões)
        </h2>
        
        {questoes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhuma questão cadastrada ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questoes.map((questao, index) => (
              <div key={questao.id} className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-[#ADF802]">#{index + 1}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        questao.status === 'Aprovada' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        questao.status === 'Pendente' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {questao.status}
                      </span>
                      <span className="text-xs text-gray-500">{questao.categoria}</span>
                    </div>
                    <p className="text-white font-medium mb-2">{questao.enunciado}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Resposta: {questao.resposta_correta}</span>
                      <span>•</span>
                      <span>{questao.dificuldade}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    {questao.status === 'Pendente' && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => aprovarQuestaoMutation.mutate({ id: questao.id, data: { status: 'Aprovada' } })}
                          className="text-green-400 hover:text-green-300"
                          title="Aprovar"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => aprovarQuestaoMutation.mutate({ id: questao.id, data: { status: 'Recusada' } })}
                          className="text-red-400 hover:text-red-300"
                          title="Recusar"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletarQuestaoMutation.mutate(questao.id)}
                      className="text-gray-400 hover:text-red-400"
                      title="Deletar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}