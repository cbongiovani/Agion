import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Trash2, BookOpen, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export default function ManualSupervisor() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({ titulo: '', conteudo: '', ordem: 1 });

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['manual-supervisor'],
    queryFn: () => base44.entities.ManualSupervisor.list('ordem'),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.ManualSupervisor.create(data);
      const user = await base44.auth.me();
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Criou',
        entidade: 'ManualSupervisor',
        detalhes: `Adicionou seção "${data.titulo}" ao manual`,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-supervisor'] });
      toast.success('Seção adicionada com sucesso!');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const result = await base44.entities.ManualSupervisor.update(id, data);
      const user = await base44.auth.me();
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'ManualSupervisor',
        detalhes: `Atualizou seção "${data.titulo}" do manual`,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-supervisor'] });
      toast.success('Seção atualizada com sucesso!');
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const user = await base44.auth.me();
      await base44.entities.ManualSupervisor.delete(id);
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Excluiu',
        entidade: 'ManualSupervisor',
        detalhes: `Excluiu uma seção do manual`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-supervisor'] });
      toast.success('Seção excluída com sucesso!');
      setDeleteId(null);
    },
  });

  const initializeManualMutation = useMutation({
    mutationFn: async () => {
      const defaultSections = [
        {
          titulo: 'Registro de Atividades',
          conteudo: `### Chamados
Apoio em tempo real a qualquer momento que o analista solicitar, sendo avaliado se o analista cumpriu com o mínimo de atividades para a correção antes de acionar a supervisão.

### Ligações
Mesma situação do Chamados, porém a avaliação também se faz em cima da comunicação (avaliando ética, controle emocional, conhecimento técnico e saudação inicial e final).

### Monitoria Offline
Avaliação de gravação da ligação a qualquer momento e em qualquer dia para verificar a performance do analista (avaliando ética, controle emocional, conhecimento técnico e saudação inicial e final).

### Monitoria Assistida
Avaliação técnica gravada com 10 questões técnicas sobre o ambiente técnico do Grupo Avenida.

### Feedback Individual
Podendo ser positivo ou negativo, sem limites semanais, servindo como base de PDI para avaliar o comportamento e entrega do analista.`,
          ordem: 1,
        },
        {
          titulo: 'Fechamento Semanal',
          conteudo: `Cada supervisor fará o fechamento de sua equipe consolidando o resultado do seu analista individualmente.

**Período:** Sempre de sexta à sábado (independente do início ou final do mês).

**Objetivo:** Criar plano de ação para a próxima semana a fim de melhorar o resultado do analista.

### Dados do Fechamento:
- Quantidade de ligações da semana
- Quantidade de chamados da semana
- Quantidade de monitorias realizadas (somando offline e assistidas)
- Quantidade de feedbacks individuais (somando positivos e negativos)
- **Backlog:** Quantidade de tickets não solucionados no portal Resolve Aqui`,
          ordem: 2,
        },
        {
          titulo: 'War Room',
          conteudo: `Registrar todo incidente que gerou sala de guerra a fim de parametrizar causa raiz e tempo de mobilização de equipe.

**Importante:** Documentar todos os detalhes do incidente, ações tomadas e lições aprendidas para futura referência.`,
          ordem: 3,
        },
      ];

      for (const section of defaultSections) {
        await base44.entities.ManualSupervisor.create(section);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-supervisor'] });
      toast.success('Manual inicializado com conteúdo padrão!');
    },
  });

  const resetForm = () => {
    setFormData({ titulo: '', conteudo: '', ordem: 1 });
    setEditingSection(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSection) {
      updateMutation.mutate({ id: editingSection.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (section) => {
    setEditingSection(section);
    setFormData({
      titulo: section.titulo,
      conteudo: section.conteudo,
      ordem: section.ordem,
    });
    setIsDialogOpen(true);
  };

  const isAdmin = currentUser?.role === 'admin';

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
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Manual do Supervisor</h1>
          <p className="text-gray-400 mt-1">Guia de processos e procedimentos para supervisores</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {sections.length === 0 && (
              <Button
                onClick={() => initializeManualMutation.mutate()}
                disabled={initializeManualMutation.isPending}
                className="bg-[#ADF802] hover:bg-[#9DE002] text-black gap-2"
              >
                {initializeManualMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Inicializando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Criar Manual Padrão
                  </>
                )}
              </Button>
            )}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
              <DialogTrigger asChild>
                <Button className="bg-[#ADF802] hover:bg-[#9DE002] text-black gap-2">
                  <Plus className="w-4 h-4" />
                  Nova Seção
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingSection ? 'Editar Seção' : 'Nova Seção'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="titulo">Título</Label>
                    <Input
                      id="titulo"
                      value={formData.titulo}
                      onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="ordem">Ordem</Label>
                    <Input
                      id="ordem"
                      type="number"
                      value={formData.ordem}
                      onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="conteudo">Conteúdo (Markdown)</Label>
                    <Textarea
                      id="conteudo"
                      value={formData.conteudo}
                      onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                      className="bg-[#1a1a1a] border-gray-700 mt-2 h-64 font-mono text-sm"
                      placeholder="Use Markdown para formatar o conteúdo..."
                      required
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      Suporta Markdown: **negrito**, *itálico*, ### títulos, - listas, etc.
                    </p>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={resetForm} className="border-gray-700">
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-[#ADF802] hover:bg-[#9DE002] text-black">
                      {editingSection ? 'Atualizar' : 'Criar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {sections.length === 0 ? (
        <div className="text-center py-16 bg-[#242424] rounded-2xl border border-gray-800">
          <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-white mb-2">Manual ainda não criado</p>
          <p className="text-gray-400">
            {isAdmin ? 'Clique em "Criar Manual Padrão" para inicializar com o conteúdo padrão' : 'O manual será disponibilizado em breve'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <div
              key={section.id}
              className="bg-[#242424] rounded-2xl border border-gray-800 p-6 hover:border-[#ADF802]/30 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#ADF802]/20 flex items-center justify-center">
                    <span className="text-[#ADF802] font-bold">{section.ordem}</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">{section.titulo}</h2>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(section)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(section.id)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    h3: ({ children }) => <h3 className="text-lg font-semibold text-[#ADF802] mt-4 mb-2">{children}</h3>,
                    h2: ({ children }) => <h2 className="text-xl font-bold text-[#ADF802] mt-4 mb-2">{children}</h2>,
                    p: ({ children }) => <p className="text-gray-300 mb-3 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 text-gray-300 mb-3">{children}</ul>,
                    li: ({ children }) => <li className="text-gray-300">{children}</li>,
                    strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  }}
                >
                  {section.conteudo}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir esta seção? Esta ação não pode ser desfeita.
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
    </div>
  );
}