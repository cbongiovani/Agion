import React, { useMemo, useState } from 'react';
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
  DialogDescription,
} from '@/components/ui/dialog';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

import { Eye, CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/** helpers */
function idStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function fmtDateOnlyBR(v) {
  if (!v) return '-';
  const s = String(v);
  const iso = s.includes('T') ? s.split('T')[0] : s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return s;
  }
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

/** UI field */
function Field({ label, value }) {
  return (
    <div className="space-y-1">
      <div className="text-gray-400 text-xs">{label}</div>
      <div className="text-gray-100 font-medium break-words">{value ?? '-'}</div>
    </div>
  );
}

export default function Aprovacao() {
  const queryClient = useQueryClient();

  // busca global
  const [search, setSearch] = useState('');

  // rejeição
  const [selected, setSelected] = useState(null); // registro de aprovacao
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState('');

  // view modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTipo, setViewTipo] = useState(null); // 'atividade' | 'fechamento'
  const [viewRegistro, setViewRegistro] = useState(null); // Atividade | FechamentoSemanal
  const [viewAprovacao, setViewAprovacao] = useState(null); // AprovacaoAtividade

  // nomes resolvidos (reaproveitar pros dois)
  const [viewSupervisorNome, setViewSupervisorNome] = useState('');
  const [viewAnalistaNome, setViewAnalistaNome] = useState('');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // ===== 1) buscar aprovações pendentes (todas) =====
  const {
    data: aprovacoesPendentes = [],
    isLoading: loadingAprov,
  } = useQuery({
    queryKey: ['aprovacoesPendentes'],
    queryFn: async () => {
      const list = await base44.entities.AprovacaoAtividade.filter({ status: 'pendente' });
      return Array.isArray(list) ? list : [];
    },
    enabled: !!currentUser,
    staleTime: 5 * 1000,
  });

  // separar por tipo
  const aprovacoesAtividade = useMemo(
    () => aprovacoesPendentes.filter((a) => a?.tipo === 'atividade'),
    [aprovacoesPendentes]
  );
  const aprovacoesFechamento = useMemo(
    () => aprovacoesPendentes.filter((a) => a?.tipo === 'fechamento'),
    [aprovacoesPendentes]
  );

  // ===== 2) carregar listas base para "ver" =====
  const { data: atividades = [], isLoading: loadingAtividades } = useQuery({
    queryKey: ['atividades_for_aprovacao', aprovacoesAtividade.length],
    queryFn: async () => {
      const raw = await base44.entities.Atividade.list('-created_date', 800);
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!currentUser,
  });

  const { data: fechamentos = [], isLoading: loadingFechamentos } = useQuery({
    queryKey: ['fechamentos_for_aprovacao', aprovacoesFechamento.length],
    queryFn: async () => {
      const raw = await base44.entities.FechamentoSemanal.list('-created_date', 400);
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!currentUser,
  });

  // ===== 2.1) LISTAS DE NOMES (para tabela + fallback rápido) =====
  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores_list'],
    queryFn: async () => {
      const raw = await base44.entities.Supervisor.list('-created_date', 300);
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!currentUser,
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas_list'],
    queryFn: async () => {
      const raw = await base44.entities.Analista.list('-created_date', 900);
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!currentUser,
  });

  const supervisorMap = useMemo(() => {
    const m = {};
    for (const s of supervisores) {
      const id = idStr(s?.id);
      if (!id) continue;
      m[id] = s?.nome || s?.nome_supervisor || '';
    }
    return m;
  }, [supervisores]);

  const analistaMap = useMemo(() => {
    const m = {};
    for (const a of analistas) {
      const id = idStr(a?.id);
      if (!id) continue;
      m[id] = a?.nome || '';
    }
    return m;
  }, [analistas]);

  function resolveSupervisorNameFromRecord(rec) {
    const supId = idStr(rec?.supervisor_id || rec?.supervisor);
    const direct = rec?.supervisor_nome;
    const mapped = supId ? supervisorMap[supId] : '';
    return direct || mapped || (supId ? supId : '-');
  }

  function resolveAnalistaNameFromRecord(rec) {
    const anaId = idStr(rec?.analista_id || rec?.analista);
    const direct = rec?.analista_nome;
    const mapped = anaId ? analistaMap[anaId] : '';
    return direct || mapped || (anaId ? anaId : '-');
  }

  // ===== 3) construir linhas exibidas (com busca) =====
  const searchNorm = search.trim().toLowerCase();

  const rowsAtividades = useMemo(() => {
    const ids = new Set(aprovacoesAtividade.map((a) => idStr(a?.atividade_id)).filter(Boolean));
    const pend = atividades.filter((t) => ids.has(idStr(t?.id)));

    if (!searchNorm) return pend;

    return pend.filter((t) => {
      const blob = [
        t?.codigo_atividade,
        t?.id,
        t?.tipo,
        t?.registrado_por,
        t?.created_by,
        t?.ticket,
        t?.comentario,
        t?.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(searchNorm);
    });
  }, [aprovacoesAtividade, atividades, searchNorm]);

  const rowsFechamentos = useMemo(() => {
    const ids = new Set(aprovacoesFechamento.map((a) => idStr(a?.atividade_id)).filter(Boolean));
    const pend = fechamentos.filter((f) => ids.has(idStr(f?.id)));

    if (!searchNorm) return pend;

    return pend.filter((f) => {
      const blob = [
        f?.id,
        f?.created_by,
        f?.registrado_por,
        f?.semana_inicio,
        f?.semana_fim,
        f?.analista_nome,
        f?.supervisor_nome,
        f?.observacoes,
        f?.destaques,
        f?.pontos_criticos,
        f?.plano_acao,
        // também deixa buscável pelos nomes resolvidos via map:
        supervisorMap[idStr(f?.supervisor_id || f?.supervisor)],
        analistaMap[idStr(f?.analista_id || f?.analista)],
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(searchNorm);
    });
  }, [aprovacoesFechamento, fechamentos, searchNorm, supervisorMap, analistaMap]);

  // ===== 4) mutations aprovar/rejeitar =====
  const aprovarMutation = useMutation({
    mutationFn: async ({ aprovacaoId }) => {
      return await base44.entities.AprovacaoAtividade.update(aprovacaoId, { status: 'aprovado' });
    },
    onSuccess: async () => {
      toast.success('✅ Aprovado');
      await queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] });
      await queryClient.invalidateQueries({ queryKey: ['atividades_for_aprovacao'] });
      await queryClient.invalidateQueries({ queryKey: ['fechamentos_for_aprovacao'] });
    },
    onError: (e) => {
      const info = extractUsefulError(e);
      toast.error('Erro ao aprovar', { description: info.message });
    },
  });

  const rejeitarMutation = useMutation({
    mutationFn: async ({ aprovacaoId, motivo }) => {
      return await base44.entities.AprovacaoAtividade.update(aprovacaoId, {
        status: 'rejeitado',
        motivo_rejeicao: motivo || 'Rejeitado',
      });
    },
    onSuccess: async () => {
      toast.success('❌ Rejeitado');
      setRejectOpen(false);
      setRejectMotivo('');
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] });
      await queryClient.invalidateQueries({ queryKey: ['atividades_for_aprovacao'] });
      await queryClient.invalidateQueries({ queryKey: ['fechamentos_for_aprovacao'] });
    },
    onError: (e) => {
      const info = extractUsefulError(e);
      toast.error('Erro ao rejeitar', { description: info.message });
    },
  });

  // ===== 5) helpers para abrir "ver" =====
  const findAprovacaoByTarget = (tipo, targetId) => {
    const id = idStr(targetId);
    return aprovacoesPendentes.find(
      (a) => a?.tipo === tipo && idStr(a?.atividade_id) === id && a?.status === 'pendente'
    );
  };

  const resolveNamesByIds = async (supIdRaw, anaIdRaw) => {
    const supId = idStr(supIdRaw);
    const anaId = idStr(anaIdRaw);

    // reset
    setViewSupervisorNome('');
    setViewAnalistaNome('');

    // tenta map primeiro (rápido)
    let supNome = supId ? supervisorMap[supId] : '';
    let anaNome = anaId ? analistaMap[anaId] : '';

    // se não achou no map, faz get (padrão do seu openViewAtividade)
    if (supId && !supNome) {
      try {
        const s = await base44.entities.Supervisor.get(supId);
        supNome = s?.nome || s?.nome_supervisor || '';
      } catch {}
    }

    if (anaId && !anaNome) {
      try {
        const a = await base44.entities.Analista.get(anaId);
        anaNome = a?.nome || '';
      } catch {}
    }

    setViewSupervisorNome(supNome || '');
    setViewAnalistaNome(anaNome || '');
  };

  const openViewAtividade = async (atividade) => {
    const aprov = findAprovacaoByTarget('atividade', atividade?.id);
    setViewTipo('atividade');
    setViewAprovacao(aprov || null);

    try {
      const full = await base44.entities.Atividade.get(atividade.id);

      const supId = full?.supervisor_id || full?.supervisor || '';
      const anaId = full?.analista_id || full?.analista || '';

      await resolveNamesByIds(supId, anaId);

      setViewRegistro(full || atividade);
    } catch {
      setViewSupervisorNome('');
      setViewAnalistaNome('');
      setViewRegistro(atividade);
    }

    setViewOpen(true);
  };

  // ✅ AQUI está a correção principal do FECHAMENTO:
  const openViewFechamento = async (fechamento) => {
    const aprov = findAprovacaoByTarget('fechamento', fechamento?.id);
    setViewTipo('fechamento');
    setViewAprovacao(aprov || null);

    try {
      const full = await base44.entities.FechamentoSemanal.get(fechamento.id);

      const supId = full?.supervisor_id || full?.supervisor || '';
      const anaId = full?.analista_id || full?.analista || '';

      await resolveNamesByIds(supId, anaId);

      setViewRegistro(full || fechamento);
    } catch {
      // fallback: tenta resolver com o que tem no list
      const supId = fechamento?.supervisor_id || fechamento?.supervisor || '';
      const anaId = fechamento?.analista_id || fechamento?.analista || '';
      await resolveNamesByIds(supId, anaId);

      setViewRegistro(fechamento);
    }

    setViewOpen(true);
  };

  const doReject = () => {
    if (!selected?.id) return;
    rejeitarMutation.mutate({ aprovacaoId: selected.id, motivo: rejectMotivo });
  };

  // ✅ deixa “travado por role” de verdade
  const canDecide =
    currentUser?.role === 'admin' || currentUser?.role === 'coordenacao';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Aprovação</h1>
          <p className="text-gray-400">Pendências aguardando validação</p>
        </div>

        <Button
          variant="secondary"
          className="bg-[#1a1a1a] border border-gray-700"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['aprovacoesPendentes'] })}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Buscar */}
      <div className="bg-[#121212] border border-gray-800 rounded p-4 space-y-2">
        <Label>Buscar</Label>
        <Input
          className="bg-[#1a1a1a] border-gray-700"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="CH00001 / FECH / ID / Tipo / e-mail..."
        />
      </div>

      {/* Seção 1: Atividades */}
      <div className="bg-[#121212] border border-gray-800 rounded p-4">
        <div className="flex items-center justify-between">
          <div className="text-white font-semibold">Aprovar atividades</div>
          <div className="text-gray-400 text-sm">
            Pendentes: {rowsAtividades.length}
          </div>
        </div>

        <div className="mt-3 border-t border-gray-800 pt-3">
          {(loadingAprov || loadingAtividades) ? (
            <div className="text-gray-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : rowsAtividades.length === 0 ? (
            <div className="text-gray-400 flex items-center gap-2">
              <span className="text-yellow-500">⚠</span> Nenhuma atividade pendente encontrada.
            </div>
          ) : (
            <div className="w-full overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 pr-2">Código</th>
                    <th className="text-left py-2 pr-2">Tipo</th>
                    <th className="text-left py-2 pr-2">Status</th>
                    <th className="text-left py-2 pr-2">Criada por</th>
                    <th className="text-right py-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-gray-100">
                  {rowsAtividades.map((t) => {
                    const aprov = findAprovacaoByTarget('atividade', t?.id);
                    return (
                      <tr key={t.id} className="border-b border-gray-800/60">
                        <td className="py-2 pr-2 font-medium">
                          {t?.codigo_atividade || t?.id}
                        </td>
                        <td className="py-2 pr-2">{t?.tipo || '-'}</td>
                        <td className="py-2 pr-2">{aprov?.status || 'pendente'}</td>
                        <td className="py-2 pr-2">
                          {t?.registrado_por || t?.created_by || '-'}
                        </td>
                        <td className="py-2 text-right space-x-2">
                          <Button
                            variant="secondary"
                            className="bg-[#1a1a1a] border border-gray-700"
                            onClick={() => openViewAtividade(t)}
                          >
                            <Eye className="w-4 h-4 mr-2" /> Ver
                          </Button>

                          <Button
                            variant="secondary"
                            className="bg-[#1a1a1a] border border-gray-700"
                            disabled={!canDecide || aprovarMutation.isPending}
                            onClick={() => aprov?.id && aprovarMutation.mutate({ aprovacaoId: aprov.id })}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Aprovar
                          </Button>

                          <Button
                            variant="destructive"
                            disabled={!canDecide || rejeitarMutation.isPending}
                            onClick={() => {
                              setSelected(aprov);
                              setRejectMotivo('');
                              setRejectOpen(true);
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Rejeitar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!canDecide ? (
                <div className="text-xs text-yellow-500 mt-3">
                  ⚠ Você está como {currentUser?.role || 'visitante'} e não pode aprovar/rejeitar.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Seção 2: Fechamento Semanal */}
      <div className="bg-[#121212] border border-gray-800 rounded p-4">
        <div className="flex items-center justify-between">
          <div className="text-white font-semibold">Aprovar fechamentos semanais</div>
          <div className="text-gray-400 text-sm">
            Pendentes: {rowsFechamentos.length}
          </div>
        </div>

        <div className="mt-3 border-t border-gray-800 pt-3">
          {(loadingAprov || loadingFechamentos) ? (
            <div className="text-gray-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : rowsFechamentos.length === 0 ? (
            <div className="text-gray-400 flex items-center gap-2">
              <span className="text-yellow-500">⚠</span> Nenhum fechamento semanal pendente encontrado.
            </div>
          ) : (
            <div className="w-full overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 pr-2">Semana</th>
                    <th className="text-left py-2 pr-2">Supervisor</th>
                    <th className="text-left py-2 pr-2">Analista</th>
                    <th className="text-left py-2 pr-2">Status</th>
                    <th className="text-left py-2 pr-2">Criado por</th>
                    <th className="text-right py-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-gray-100">
                  {rowsFechamentos.map((f) => {
                    const aprov = findAprovacaoByTarget('fechamento', f?.id);
                    const semana =
                      (f?.semana_inicio || f?.semana_fim)
                        ? `${fmtDateOnlyBR(f?.semana_inicio)} → ${fmtDateOnlyBR(f?.semana_fim)}`
                        : '-';

                    const supervisorNomeTabela = resolveSupervisorNameFromRecord(f);
                    const analistaNomeTabela = resolveAnalistaNameFromRecord(f);

                    return (
                      <tr key={f.id} className="border-b border-gray-800/60">
                        <td className="py-2 pr-2 font-medium">{semana}</td>
                        <td className="py-2 pr-2">{supervisorNomeTabela}</td>
                        <td className="py-2 pr-2">{analistaNomeTabela}</td>
                        <td className="py-2 pr-2">{aprov?.status || 'pendente'}</td>
                        <td className="py-2 pr-2">
                          {f?.registrado_por || f?.created_by || '-'}
                        </td>
                        <td className="py-2 text-right space-x-2">
                          <Button
                            variant="secondary"
                            className="bg-[#1a1a1a] border border-gray-700"
                            onClick={() => openViewFechamento(f)}
                          >
                            <Eye className="w-4 h-4 mr-2" /> Ver
                          </Button>

                          <Button
                            variant="secondary"
                            className="bg-[#1a1a1a] border border-gray-700"
                            disabled={!canDecide || aprovarMutation.isPending}
                            onClick={() => aprov?.id && aprovarMutation.mutate({ aprovacaoId: aprov.id })}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Aprovar
                          </Button>

                          <Button
                            variant="destructive"
                            disabled={!canDecide || rejeitarMutation.isPending}
                            onClick={() => {
                              setSelected(aprov);
                              setRejectMotivo('');
                              setRejectOpen(true);
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Rejeitar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!canDecide ? (
                <div className="text-xs text-yellow-500 mt-3">
                  ⚠ Você está como {currentUser?.role || 'visitante'} e não pode aprovar/rejeitar.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Modal VER (Atividade ou Fechamento) */}
      <Dialog
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) {
            setViewTipo(null);
            setViewRegistro(null);
            setViewAprovacao(null);
            setViewSupervisorNome('');
            setViewAnalistaNome('');
          }
        }}
      >
        <DialogContent className="bg-[#121212] border border-gray-800 text-gray-100 max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Visualizar {viewTipo === 'fechamento' ? 'fechamento semanal' : 'atividade'}
            </DialogTitle>

            {/* ✅ remove warning: Missing Description / aria-describedby */}
            <DialogDescription className="sr-only">
              Detalhes do registro para aprovação.
            </DialogDescription>
          </DialogHeader>

          {!viewRegistro ? (
            <div className="text-gray-400">Nenhum registro selecionado.</div>
          ) : viewTipo === 'fechamento' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Field label="Semana início" value={fmtDateOnlyBR(viewRegistro?.semana_inicio)} />
              <Field label="Semana fim" value={fmtDateOnlyBR(viewRegistro?.semana_fim)} />

              {/* ✅ NOME RESOLVIDO */}
              <Field
                label="Supervisor"
                value={
                  viewSupervisorNome ||
                  resolveSupervisorNameFromRecord(viewRegistro)
                }
              />
              <Field
                label="Analista"
                value={
                  viewAnalistaNome ||
                  resolveAnalistaNameFromRecord(viewRegistro)
                }
              />

              <Field label="Ligações Next IP" value={viewRegistro?.ligacoes_next_ip ?? viewRegistro?.ligacoes ?? '-'} />
              <Field label="Chamados Verdana" value={viewRegistro?.chamados_verdana ?? viewRegistro?.chamados ?? '-'} />
              <Field label="Monitorias" value={viewRegistro?.monitorias ?? '-'} />
              <Field label="Feedbacks Individuais" value={viewRegistro?.feedbacks_individuais ?? viewRegistro?.feedbacks ?? '-'} />

              <div className="md:col-span-2 space-y-1">
                <div className="text-gray-400 text-xs">Backlog final</div>
                <div className="text-gray-100 bg-[#1a1a1a] border border-gray-700 rounded p-3 whitespace-pre-wrap">
                  {viewRegistro?.backlog_final ?? '-'}
                </div>
              </div>

              <div className="md:col-span-2 space-y-1">
                <div className="text-gray-400 text-xs">Destaques</div>
                <div className="text-gray-100 bg-[#1a1a1a] border border-gray-700 rounded p-3 whitespace-pre-wrap">
                  {viewRegistro?.destaques ?? '-'}
                </div>
              </div>

              <div className="md:col-span-2 space-y-1">
                <div className="text-gray-400 text-xs">Pontos críticos</div>
                <div className="text-gray-100 bg-[#1a1a1a] border border-gray-700 rounded p-3 whitespace-pre-wrap">
                  {viewRegistro?.pontos_criticos ?? '-'}
                </div>
              </div>

              <div className="md:col-span-2 space-y-1">
                <div className="text-gray-400 text-xs">Plano de ação</div>
                <div className="text-gray-100 bg-[#1a1a1a] border border-gray-700 rounded p-3 whitespace-pre-wrap">
                  {viewRegistro?.plano_acao ?? '-'}
                </div>
              </div>

              <div className="md:col-span-2 space-y-1">
                <div className="text-gray-400 text-xs">Observações gerais</div>
                <div className="text-gray-100 bg-[#1a1a1a] border border-gray-700 rounded p-3 whitespace-pre-wrap">
                  {viewRegistro?.observacoes_gerais ?? viewRegistro?.observacoes ?? '-'}
                </div>
              </div>

              <div className="md:col-span-2 text-xs text-gray-500">
                Criado por: {viewRegistro?.registrado_por || viewRegistro?.created_by || '-'} · ID: {idStr(viewRegistro?.id) || '-'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Field label="Código" value={viewRegistro?.codigo_atividade || viewRegistro?.id} />
              <Field label="Tipo" value={viewRegistro?.tipo || '-'} />

              <Field
                label="Supervisor"
                value={
                  viewSupervisorNome ||
                  viewRegistro?.supervisor_nome ||
                  viewRegistro?.supervisor ||
                  viewRegistro?.supervisor_id ||
                  '-'
                }
              />
              <Field
                label="Analista"
                value={
                  viewAnalistaNome ||
                  viewRegistro?.analista_nome ||
                  viewRegistro?.analista ||
                  viewRegistro?.analista_id ||
                  '-'
                }
              />

              <Field label="Ticket" value={viewRegistro?.ticket || '-'} />
              <Field label="Status" value={viewRegistro?.status || '-'} />
              <Field label="Nota (0-10)" value={viewRegistro?.nota ?? '-'} />
              <Field label="Data" value={fmtDateOnlyBR(viewRegistro?.data)} />

              <div className="md:col-span-2 space-y-1">
                <div className="text-gray-400 text-xs">Comentário</div>
                <div className="text-gray-100 bg-[#1a1a1a] border border-gray-700 rounded p-3 whitespace-pre-wrap">
                  {viewRegistro?.comentario || '-'}
                </div>
              </div>

              <div className="md:col-span-2 text-xs text-gray-500">
                Criada por: {viewRegistro?.registrado_por || viewRegistro?.created_by || '-'} · ID: {idStr(viewRegistro?.id) || '-'} · Request ID: {viewRegistro?.request_id || '-'}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {viewAprovacao?.id ? (
              <>
                <Button
                  variant="secondary"
                  className="bg-[#1a1a1a] border border-gray-700"
                  disabled={!canDecide || aprovarMutation.isPending}
                  onClick={() => aprovarMutation.mutate({ aprovacaoId: viewAprovacao.id })}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Aprovar
                </Button>

                <Button
                  variant="destructive"
                  disabled={!canDecide || rejeitarMutation.isPending}
                  onClick={() => {
                    setSelected(viewAprovacao);
                    setRejectMotivo('');
                    setRejectOpen(true);
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Rejeitar
                </Button>
              </>
            ) : null}

            <Button
              variant="secondary"
              className="bg-[#1a1a1a] border border-gray-700"
              onClick={() => setViewOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejeição (motivo) */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent className="bg-[#121212] border border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da rejeição (opcional, mas recomendado).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea
              className="bg-[#1a1a1a] border-gray-700"
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
              placeholder="Ex.: registro incompleto, dados inconsistentes..."
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1a1a] border border-gray-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={doReject}
              disabled={!selected?.id || rejeitarMutation.isPending}
            >
              {rejeitarMutation.isPending ? 'Rejeitando...' : 'Rejeitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}