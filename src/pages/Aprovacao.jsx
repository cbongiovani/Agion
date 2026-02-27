// src/pages/Aprovacao.jsx
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

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

function idStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function extractUsefulError(err) {
  const status = err?.status || err?.response?.status;
  const msg =
    err?.message ||
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    'Falha inesperada.';
  const details =
    err?.response?.data?.details ||
    err?.response?.data?.errors ||
    err?.data?.errors;

  return {
    status,
    message: msg,
    details: typeof details === 'string' ? details : details ? JSON.stringify(details) : '',
  };
}

export default function Aprovacao() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // atividade selecionada (obj)
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [confirmApproveId, setConfirmApproveId] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // 1) Buscar aprovações pendentes do tipo "atividade"
  const { data: aprovacoesPendentes = [], isLoading: loadingAprov } = useQuery({
    queryKey: ['aprovacoesPendentes'],
    queryFn: async () => {
      const list = await base44.entities.AprovacaoAtividade.filter({
        tipo: 'atividade',
        status: 'pendente',
      });
      return Array.isArray(list) ? list : [];
    },
    enabled: !!currentUser,
    staleTime: 5 * 1000,
  });

  // 2) Buscar todas as atividades e filtrar pelas pendentes (CORRIGIDO string/number)
  const { data: atividadesPendentes = [], isLoading: loadingAtiv } = useQuery({
    queryKey: ['atividadesPendentes', aprovacoesPendentes.length],
    queryFn: async () => {
      const ids = aprovacoesPendentes.map((a) => idStr(a.atividade_id)).filter(Boolean);
      const set = new Set(ids); // SET DE STRING

      // Busca um volume razoável (ajuste se seu ambiente tiver mais de 800)
      const raw = await base44.entities.Atividade.list('-created_date', 800);
      const arr = Array.isArray(raw) ? raw : [];

      // Mantém apenas as que têm aprovação pendente
      return arr.filter((at) => set.has(idStr(at.id)));
    },
    enabled: !!currentUser && aprovacoesPendentes.length > 0,
    staleTime: 5 * 1000,
  });

  // Map pra buscar a aprovação pendente de uma atividade rapidamente (CORRIGIDO)
  const aprovacaoPorAtividade = useMemo(() => {
    const m = new Map();
    for (const a of aprovacoesPendentes) {
      const key = idStr(a.atividade_id);
      if (!key) continue;
      if (!m.has(key)) m.set(key, a);
    }
    return m;
  }, [aprovacoesPendentes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return atividadesPendentes;

    return atividadesPendentes.filter((a) => {
      const cod = String(a.codigo_atividade || '').toLowerCase();
      const id = String(a.id || '').toLowerCase();
      const tipo = String(a.tipo || '').toLowerCase();
      return cod.includes(q) || id.includes(q) || tipo.includes(q);
    });
  }, [atividadesPendentes, search]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] });
    queryClient.invalidateQueries({ queryKey: ['aprovacoesAtividadeMap'] });
    queryClient.invalidateQueries({ queryKey: ['atividades'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  // === Aprovar ===
  const aprovarMutation = useMutation({
    mutationFn: async (atividadeId) => {
      const key = idStr(atividadeId);
      const aprov = aprovacaoPorAtividade.get(key);
      if (!aprov?.id) throw new Error('Aprovação pendente não encontrada para esta atividade.');

      return await base44.entities.AprovacaoAtividade.update(aprov.id, {
        status: 'aprovado',
        motivo_rejeicao: '',
        data_aprovacao: new Date().toISOString(),
        aprovado_por: currentUser?.email || '',
      });
    },
    onSuccess: () => {
      toast.success('✅ Atividade aprovada');
      setConfirmApproveId(null);
      invalidateAll();
    },
    onError: (err) => {
      const e = extractUsefulError(err);
      toast.error('❌ Erro ao aprovar', {
        description: `${e.status ? `HTTP ${e.status} — ` : ''}${e.message}${e.details ? `\n${e.details}` : ''}`,
      });
    },
  });

  // === Rejeitar ===
  const rejeitarMutation = useMutation({
    mutationFn: async ({ atividadeId, motivo }) => {
      const key = idStr(atividadeId);
      const aprov = aprovacaoPorAtividade.get(key);
      if (!aprov?.id) throw new Error('Aprovação pendente não encontrada para esta atividade.');

      return await base44.entities.AprovacaoAtividade.update(aprov.id, {
        status: 'rejeitado',
        motivo_rejeicao: motivo,
        data_aprovacao: new Date().toISOString(),
        aprovado_por: currentUser?.email || '',
      });
    },
    onSuccess: () => {
      toast.success('✅ Atividade rejeitada');
      setRejectOpen(false);
      setRejectMotivo('');
      setSelected(null);
      invalidateAll();
    },
    onError: (err) => {
      const e = extractUsefulError(err);
      toast.error('❌ Erro ao rejeitar', {
        description: `${e.status ? `HTTP ${e.status} — ` : ''}${e.message}${e.details ? `\n${e.details}` : ''}`,
      });
    },
  });

  const openReject = (atividade) => {
    setSelected(atividade);
    setRejectMotivo('');
    setRejectOpen(true);
  };

  const doReject = async () => {
    if (!selected?.id) return;
    const motivo = rejectMotivo.trim();
    if (!motivo) {
      toast.error('Informe o motivo da rejeição.');
      return;
    }
    await rejeitarMutation.mutateAsync({ atividadeId: selected.id, motivo });
  };

  const isBusy = loadingAprov || loadingAtiv;

  return (
    <div className="p-6 text-gray-100">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Aprovação</h1>
          <p className="text-gray-400 mt-1">Atividades pendentes aguardando validação</p>
        </div>

        <Button
          variant="secondary"
          className="bg-[#1a1a1a] border border-gray-700 gap-2"
          onClick={invalidateAll}
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      <div className="bg-[#121212] border border-gray-800 rounded p-4 mb-6">
        <Label>Buscar</Label>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1a1a1a] border-gray-700 mt-2"
          placeholder="CH00001 / ID / Tipo..."
        />
      </div>

      <div className="bg-[#121212] border border-gray-800 rounded overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="text-sm text-gray-300">
            Pendentes: <span className="text-gray-100 font-semibold">{filtered.length}</span>
          </div>
        </div>

        {isBusy ? (
          <div className="p-6 flex items-center gap-2 text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-gray-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Nenhuma atividade pendente encontrada.
          </div>
        ) : (
          <div className="w-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0f0f0f] text-gray-300">
                <tr>
                  <th className="text-left p-3">Código</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Criada por</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const aprov = aprovacaoPorAtividade.get(idStr(a.id));
                  return (
                    <tr key={a.id} className="border-t border-gray-800 hover:bg-[#141414]">
                      <td className="p-3 text-gray-100 font-medium">
                        {a.codigo_atividade || a.id}
                      </td>
                      <td className="p-3 text-gray-200">{a.tipo || '-'}</td>
                      <td className="p-3 text-gray-200">{aprov?.status || 'pendente'}</td>
                      <td className="p-3 text-gray-300">{a.registrado_por || a.created_by || '-'}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            className="bg-[#1a1a1a] border border-gray-700 gap-2"
                            onClick={() => setConfirmApproveId(a.id)}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Aprovar
                          </Button>

                          <Button
                            variant="destructive"
                            className="gap-2"
                            onClick={() => openReject(a)}
                          >
                            <XCircle className="w-4 h-4" />
                            Rejeitar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Approve */}
      <AlertDialog open={!!confirmApproveId} onOpenChange={(open) => !open && setConfirmApproveId(null)}>
        <AlertDialogContent className="bg-[#121212] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar atividade?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Essa ação libera a atividade para visualização geral.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1a1a] border border-gray-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => confirmApproveId && aprovarMutation.mutate(confirmApproveId)}
              disabled={aprovarMutation.isPending}
            >
              {aprovarMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Aprovando...
                </span>
              ) : (
                'Aprovar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject modal */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="bg-[#121212] border-gray-800 text-gray-100 max-w-xl">
          <DialogHeader>
            <DialogTitle>Rejeitar atividade</DialogTitle>
          </DialogHeader>

          <div className="text-sm text-gray-400">
            Informe o motivo da rejeição para a atividade{' '}
            <span className="text-gray-200 font-semibold">
              {selected?.codigo_atividade || selected?.id || '-'}
            </span>
            .
          </div>

          <div className="mt-4">
            <Label>Motivo</Label>
            <Textarea
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-2"
              placeholder="Ex.: informações incompletas / dados inválidos / precisa ajustar..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              className="bg-[#1a1a1a] border border-gray-700"
              onClick={() => setRejectOpen(false)}
              disabled={rejeitarMutation.isPending}
            >
              Cancelar
            </Button>

            <Button
              variant="destructive"
              onClick={doReject}
              disabled={rejeitarMutation.isPending}
            >
              {rejeitarMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Rejeitando...
                </span>
              ) : (
                'Rejeitar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}