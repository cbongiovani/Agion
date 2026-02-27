import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import {
  AlertTriangle,
  TrendingUp,
  Target,
  Users,
  ShieldCheck,
  Zap,
  Search,
  Filter,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react';

/**
 * DashboardOKR v2 (moderno + gestão de desempenho)
 *
 * ✅ Visão por OKR (Resultados-Chave)
 * ✅ Ênfase em performance por Supervisor (score + ranking)
 * ✅ Drilldown: Supervisor -> OKRs + Fechamentos + Atividades
 * ✅ Sem depender de schema novo (usa dados existentes e faz score por proxy)
 *
 * Observação:
 * - Score usa os OKRs agregados + Fechamentos (últimas semanas) como sinal.
 * - Se você tiver uma entidade própria de "AvaliacaoSupervisor", dá pra plugar aqui depois.
 */

/** helpers */
function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pct(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function fmtPct(n) {
  const p = pct(n);
  return `${p.toFixed(0)}%`;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function getLocalDateBR(v) {
  if (!v) return '-';
  const s = String(v);
  const iso = s.includes('T') ? s.split('T')[0] : s;
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

function statusBadgeClass(status) {
  const map = {
    'No Alvo': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    'Em Progresso': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    Risco: 'bg-red-500/15 text-red-300 border-red-500/30',
    'Concluído': 'bg-green-500/15 text-green-300 border-green-500/30',
  };
  return map[status] || map['Em Progresso'];
}

function gradeFromScore(score) {
  if (score >= 85) return { label: 'A', cls: 'bg-emerald-600 text-white' };
  if (score >= 70) return { label: 'B', cls: 'bg-sky-600 text-white' };
  if (score >= 55) return { label: 'C', cls: 'bg-yellow-600 text-white' };
  if (score >= 40) return { label: 'D', cls: 'bg-orange-600 text-white' };
  return { label: 'E', cls: 'bg-red-600 text-white' };
}

function trendIcon(delta) {
  if (delta > 0) return <ArrowUpRight className="w-4 h-4" />;
  if (delta < 0) return <ArrowDownRight className="w-4 h-4" />;
  return <BarChart3 className="w-4 h-4" />;
}

export default function DashboardOKR() {
  const [search, setSearch] = useState('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSupervisor, setDetailSupervisor] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // 🔹 dados base
  const { data: okrs = [], isLoading: loadingOKR } = useQuery({
    queryKey: ['okrs'],
    queryFn: async () => {
      const raw = await base44.entities.OKR.list('-created_date', 1200);
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!currentUser,
  });

  const { data: fechamentos = [], isLoading: loadingFech } = useQuery({
    queryKey: ['fechamentos_dashboard'],
    queryFn: async () => {
      const raw = await base44.entities.FechamentoSemanal.list('-created_date', 800);
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!currentUser,
  });

  const { data: supervisores = [], isLoading: loadingSup } = useQuery({
    queryKey: ['supervisores_dashboard'],
    queryFn: async () => {
      const raw = await base44.entities.Supervisor.list('-created_date', 500);
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!currentUser,
  });

  // (opcional) atividades como sinal de engajamento/qualidade
  const { data: atividades = [], isLoading: loadingAtv } = useQuery({
    queryKey: ['atividades_dashboard'],
    queryFn: async () => {
      const raw = await base44.entities.Atividade.list('-created_date', 1200);
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!currentUser,
  });

  // ✅ restrição (ajuste conforme sua regra)
  const canView = currentUser?.role === 'admin' || currentUser?.role === 'coordenacao';
  const loading = loadingOKR || loadingFech || loadingSup || loadingAtv;

  // ========= Normalização / filtros =========
  const searchNorm = search.trim().toLowerCase();

  const supervisoresFiltrados = useMemo(() => {
    let list = supervisores;

    if (searchNorm) {
      list = list.filter((s) => String(s?.nome || '').toLowerCase().includes(searchNorm));
    }

    return list;
  }, [supervisores, searchNorm]);

  // ========= KPIs gerais =========
  const okrsValidos = okrs.filter((o) => safeNumber(o?.meta_valor) > 0);
  const okrsEmRisco = okrsValidos.filter(
    (o) => o?.status === 'Risco' || (safeNumber(o?.valor_atual) / safeNumber(o?.meta_valor)) * 100 < 60
  );

  const progressoMedioGeral = useMemo(() => {
    if (okrsValidos.length === 0) return 0;
    const sum = okrsValidos.reduce((acc, o) => {
      const p = (safeNumber(o.valor_atual) / safeNumber(o.meta_valor)) * 100;
      return acc + pct(p);
    }, 0);
    return sum / okrsValidos.length;
  }, [okrsValidos]);

  // ========= Score por Supervisor (proxy) =========
  /**
   * Como calculo (sem schema novo):
   * - Fechamentos: soma de entregas (ligacoes/chamados/monitorias/feedbacks) nas últimas N entradas por supervisor
   * - Atividades: volume + qualidade (nota média se existir)
   * - OKR: se o OKR tiver supervisor_id, usa direto; se não tiver, fica como "geral"
   *
   * Você pode refinar facilmente depois se quiser atrelar OKR->supervisor.
   */
  const fechBySup = useMemo(() => {
    const m = new Map(); // supId -> fechamentos[]
    for (const f of fechamentos) {
      const supId = String(f?.supervisor_id || f?.supervisor || '').trim();
      if (!supId) continue;
      if (!m.has(supId)) m.set(supId, []);
      m.get(supId).push(f);
    }
    return m;
  }, [fechamentos]);

  const atvBySup = useMemo(() => {
    const m = new Map(); // supId -> atividades[]
    for (const a of atividades) {
      const supId = String(a?.supervisor_id || a?.supervisor || '').trim();
      if (!supId) continue;
      if (!m.has(supId)) m.set(supId, []);
      m.get(supId).push(a);
    }
    return m;
  }, [atividades]);

  const okrBySup = useMemo(() => {
    const m = new Map(); // supId -> okrs[]
    for (const o of okrsValidos) {
      const supId = String(o?.supervisor_id || o?.supervisor || '').trim();
      if (!supId) continue;
      if (!m.has(supId)) m.set(supId, []);
      m.get(supId).push(o);
    }
    return m;
  }, [okrsValidos]);

  const supervisorCards = useMemo(() => {
    const cards = supervisores.map((s) => {
      const supId = String(s?.id || '').trim();
      const supNome = s?.nome || 'Supervisor';

      // Fechamentos (pega últimas 4 semanas registradas para sinal)
      const fechList = (fechBySup.get(supId) || []).slice(0, 8);
      const sumLig = fechList.reduce((acc, f) => acc + safeNumber(f?.total_ligacoes_next_ip ?? f?.ligacoes_next_ip ?? f?.ligacoes), 0);
      const sumCham = fechList.reduce((acc, f) => acc + safeNumber(f?.total_chamados_verdana ?? f?.chamados_verdana ?? f?.chamados), 0);
      const sumMon = fechList.reduce((acc, f) => acc + safeNumber(f?.total_monitorias ?? f?.monitorias), 0);
      const sumFb = fechList.reduce((acc, f) => acc + safeNumber(f?.total_1_1 ?? f?.feedbacks_individuais ?? f?.feedbacks), 0);

      // Atividades (volume e nota média se houver)
      const atvList = (atvBySup.get(supId) || []).slice(0, 200);
      const atvCount = atvList.length;
      const notas = atvList.map((a) => safeNumber(a?.nota, NaN)).filter((n) => Number.isFinite(n));
      const notaMedia = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

      // OKRs por supervisor (se existir vínculo)
      const okrList = okrBySup.get(supId) || [];
      const okrAvg = okrList.length
        ? okrList.reduce((acc, o) => acc + pct((safeNumber(o.valor_atual) / safeNumber(o.meta_valor)) * 100), 0) / okrList.length
        : null;

      // Score final (proxy)
      // - 50% OKR (se tiver), senão usa progresso geral
      // - 30% Entrega (fechamentos)
      // - 20% Qualidade (nota média de atividades, se existir)
      const okrComponent = okrAvg ?? progressoMedioGeral;
      const entregaRaw = sumLig * 0.2 + sumCham * 0.35 + sumMon * 0.25 + sumFb * 0.2;
      const entregaComponent = clamp(entregaRaw / 20, 0, 100); // normaliza “na unha” (ajuste depois)
      const qualidadeComponent = notaMedia !== null ? clamp((notaMedia / 10) * 100, 0, 100) : 60; // fallback neutro

      const score = clamp(okrComponent * 0.5 + entregaComponent * 0.3 + qualidadeComponent * 0.2, 0, 100);

      // tendência simples: compara média OKR do sup vs geral
      const delta = (okrAvg ?? progressoMedioGeral) - progressoMedioGeral;

      const grade = gradeFromScore(score);

      return {
        id: supId,
        nome: supNome,
        score,
        grade,
        delta,
        okrAvg,
        entrega: { lig: sumLig, cham: sumCham, mon: sumMon, fb: sumFb },
        atividades: { count: atvCount, notaMedia },
        okrs: okrList,
        fechamentos: fechList,
      };
    });

    // filtro supervisor específico
    if (selectedSupervisorId && selectedSupervisorId !== 'all') {
      return cards.filter((c) => c.id === selectedSupervisorId);
    }

    // ranking por score
    return cards.sort((a, b) => b.score - a.score);
  }, [
    supervisores,
    fechBySup,
    atvBySup,
    okrBySup,
    progressoMedioGeral,
    selectedSupervisorId,
  ]);

  // ========= OKRs (lista moderna com foco em KR) =========
  const okrCards = useMemo(() => {
    let list = okrsValidos;

    if (selectedSupervisorId !== 'all') {
      list = list.filter((o) => String(o?.supervisor_id || o?.supervisor || '').trim() === selectedSupervisorId);
    }

    if (searchNorm) {
      list = list.filter((o) => {
        const blob = [o?.nome, o?.descricao, o?.categoria, o?.status].filter(Boolean).join(' ').toLowerCase();
        return blob.includes(searchNorm);
      });
    }

    return list
      .map((o) => {
        const prog = pct((safeNumber(o.valor_atual) / safeNumber(o.meta_valor)) * 100);
        const emRisco = o?.status === 'Risco' || prog < 60;
        return { ...o, progresso: prog, emRisco };
      })
      .sort((a, b) => Number(b.emRisco) - Number(a.emRisco) || b.progresso - a.progresso);
  }, [okrsValidos, selectedSupervisorId, searchNorm]);

  const topSupervisor = supervisorCards[0];

  if (!currentUser || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-400">Acesso restrito a Coordenadores</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#ADF802]" />
            <h1 className="text-2xl md:text-3xl font-bold text-white">Desempenho & OKRs</h1>
          </div>
          <p className="text-gray-400 mt-1">
            Visão executiva por resultados-chave, com avaliação por supervisor.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              className="bg-[#121212] border-gray-800 pl-9 w-[280px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar OKR / supervisor..."
            />
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-[#1a1a1a] border border-gray-700 hover:bg-[#242424] gap-2">
                <Filter className="w-4 h-4" />
                Filtro Supervisor
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#121212] border-gray-800 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle>Filtrar por Supervisor</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Label className="text-gray-300">Supervisor</Label>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="secondary"
                    className={`justify-start bg-[#1a1a1a] border border-gray-700 ${
                      selectedSupervisorId === 'all' ? 'border-[#ADF802]/50' : ''
                    }`}
                    onClick={() => setSelectedSupervisorId('all')}
                  >
                    <Users className="w-4 h-4 mr-2 text-[#ADF802]" />
                    Todos
                  </Button>

                  {supervisoresFiltrados.map((s) => (
                    <Button
                      key={s.id}
                      variant="secondary"
                      className={`justify-start bg-[#1a1a1a] border border-gray-700 ${
                        selectedSupervisorId === String(s.id) ? 'border-[#ADF802]/50' : ''
                      }`}
                      onClick={() => setSelectedSupervisorId(String(s.id))}
                    >
                      {s.nome}
                    </Button>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs topo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#0d0d0d] border-gray-800 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400">Progresso médio OKRs</p>
              <p className="text-2xl font-bold text-white mt-1">{fmtPct(progressoMedioGeral)}</p>
            </div>
            <Target className="w-5 h-5 text-[#ADF802]" />
          </div>
          <div className="mt-3 bg-black/40 rounded h-2">
            <div
              className="bg-[#ADF802] h-2 rounded transition-all"
              style={{ width: `${pct(progressoMedioGeral)}%` }}
            />
          </div>
        </Card>

        <Card className="bg-[#0d0d0d] border-gray-800 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400">OKRs em risco</p>
              <p className="text-2xl font-bold text-white mt-1">{okrsEmRisco.length}</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-xs text-gray-500 mt-3">Critério: status “Risco” ou &lt; 60%.</p>
        </Card>

        <Card className="bg-[#0d0d0d] border-gray-800 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400">Supervisores</p>
              <p className="text-2xl font-bold text-white mt-1">{supervisores.length}</p>
            </div>
            <Users className="w-5 h-5 text-sky-400" />
          </div>
          <p className="text-xs text-gray-500 mt-3">Ranking por score de desempenho.</p>
        </Card>

        <Card className="bg-[#0d0d0d] border-gray-800 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400">Top Supervisor</p>
              <p className="text-lg font-bold text-white mt-1">{topSupervisor?.nome || '-'}</p>
            </div>
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className={`px-2 py-0.5 rounded ${topSupervisor?.grade?.cls || 'bg-[#1a1a1a] text-gray-300'}`}>
              {topSupervisor?.grade?.label || '-'}
            </span>
            <span className="text-gray-400">
              Score: {topSupervisor ? topSupervisor.score.toFixed(0) : '-'}
            </span>
          </div>
        </Card>
      </div>

      {/* Alertas */}
      {okrsEmRisco.length > 0 && (
        <Card className="bg-red-500/10 border-red-500/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-300 mb-2">
                {okrsEmRisco.length} OKR(s) em Risco
              </h3>
              <div className="text-sm text-red-200/90 space-y-1">
                {okrsEmRisco.slice(0, 6).map((o) => (
                  <p key={o.id}>
                    • {o.nome}: {fmtPct((safeNumber(o.valor_atual) / safeNumber(o.meta_valor)) * 100)} do alvo
                  </p>
                ))}
                {okrsEmRisco.length > 6 && (
                  <p className="text-xs text-red-200/70">+ {okrsEmRisco.length - 6} outros</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Ranking Supervisores */}
      <Card className="bg-[#0d0d0d] border-gray-800 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#ADF802]" />
              Gestão de Desempenho (Supervisores)
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Score composto (OKR + entrega + qualidade). Clique para detalhes.
            </p>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            {selectedSupervisorId !== 'all' ? 'Filtrado' : 'Ranking'}
          </div>
        </div>

        <Separator className="my-4 bg-gray-800" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {supervisorCards.map((s, idx) => (
            <Dialog
              key={s.id}
              open={detailOpen && detailSupervisor?.id === s.id}
              onOpenChange={(open) => {
                setDetailOpen(open);
                setDetailSupervisor(open ? s : null);
              }}
            >
              <DialogTrigger asChild>
                <button className="text-left">
                  <Card className="bg-[#121212] border-gray-800 p-4 hover:border-[#ADF802]/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-500">#{idx + 1}</p>
                        <h3 className="text-white font-semibold mt-1">{s.nome}</h3>

                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${s.grade.cls}`}>
                            {s.grade.label}
                          </span>
                          <span className="text-sm text-gray-300 font-semibold">
                            {s.score.toFixed(0)}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            {trendIcon(s.delta)}
                            {s.delta >= 0 ? '+' : ''}
                            {s.delta.toFixed(0)}pp
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-500">OKR Médio</p>
                        <p className="text-white font-bold">
                          {s.okrAvg === null ? '—' : fmtPct(s.okrAvg)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="bg-black/40 rounded h-2">
                        <div
                          className="bg-[#ADF802] h-2 rounded"
                          style={{ width: `${pct(s.score)}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-3 text-xs text-gray-400">
                        <div className="bg-black/30 rounded p-2">
                          <p className="text-gray-500">Ligações</p>
                          <p className="text-white font-semibold">{s.entrega.lig}</p>
                        </div>
                        <div className="bg-black/30 rounded p-2">
                          <p className="text-gray-500">Chamados</p>
                          <p className="text-white font-semibold">{s.entrega.cham}</p>
                        </div>
                        <div className="bg-black/30 rounded p-2">
                          <p className="text-gray-500">Monitorias</p>
                          <p className="text-white font-semibold">{s.entrega.mon}</p>
                        </div>
                        <div className="bg-black/30 rounded p-2">
                          <p className="text-gray-500">Feedbacks</p>
                          <p className="text-white font-semibold">{s.entrega.fb}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                        <span>Atividades: <span className="text-gray-300">{s.atividades.count}</span></span>
                        <span>
                          Nota média:{' '}
                          <span className="text-gray-300">
                            {s.atividades.notaMedia === null ? '—' : s.atividades.notaMedia.toFixed(1)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </Card>
                </button>
              </DialogTrigger>

              <DialogContent className="bg-[#121212] border-gray-800 text-white max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Supervisor · {s.nome}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="bg-[#0d0d0d] border-gray-800 p-4">
                    <p className="text-xs text-gray-500">Score</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${s.grade.cls}`}>
                        {s.grade.label}
                      </span>
                      <p className="text-2xl font-bold text-white">{s.score.toFixed(0)}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      OKR: 50% · Entrega: 30% · Qualidade: 20%
                    </p>
                    <div className="mt-3 bg-black/40 rounded h-2">
                      <div className="bg-[#ADF802] h-2 rounded" style={{ width: `${pct(s.score)}%` }} />
                    </div>
                  </Card>

                  <Card className="bg-[#0d0d0d] border-gray-800 p-4">
                    <p className="text-xs text-gray-500">Entrega (Fechamentos)</p>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                      <div className="bg-black/30 rounded p-3">
                        <p className="text-xs text-gray-500">Ligações</p>
                        <p className="text-white font-bold">{s.entrega.lig}</p>
                      </div>
                      <div className="bg-black/30 rounded p-3">
                        <p className="text-xs text-gray-500">Chamados</p>
                        <p className="text-white font-bold">{s.entrega.cham}</p>
                      </div>
                      <div className="bg-black/30 rounded p-3">
                        <p className="text-xs text-gray-500">Monitorias</p>
                        <p className="text-white font-bold">{s.entrega.mon}</p>
                      </div>
                      <div className="bg-black/30 rounded p-3">
                        <p className="text-xs text-gray-500">Feedbacks</p>
                        <p className="text-white font-bold">{s.entrega.fb}</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="bg-[#0d0d0d] border-gray-800 p-4">
                    <p className="text-xs text-gray-500">Qualidade (Atividades)</p>
                    <div className="mt-3">
                      <p className="text-sm text-gray-300">
                        Volume recente: <span className="text-white font-semibold">{s.atividades.count}</span>
                      </p>
                      <p className="text-sm text-gray-300 mt-1">
                        Nota média: <span className="text-white font-semibold">
                          {s.atividades.notaMedia === null ? '—' : s.atividades.notaMedia.toFixed(1)}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-3">
                        (Se a nota não existir, o sistema usa um valor neutro.)
                      </p>
                    </div>
                  </Card>
                </div>

                <Separator className="my-4 bg-gray-800" />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="bg-[#0d0d0d] border-gray-800 p-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Target className="w-4 h-4 text-[#ADF802]" />
                      Resultados-Chave (OKRs do Supervisor)
                    </h3>

                    <div className="mt-3 space-y-2">
                      {s.okrs.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          Nenhum OKR vinculado ao supervisor (campo supervisor_id ausente).<br />
                          Se você quiser, eu ajusto seu schema para vincular OKR → supervisor.
                        </p>
                      ) : (
                        s.okrs.slice(0, 12).map((o) => {
                          const prog = pct((safeNumber(o.valor_atual) / safeNumber(o.meta_valor)) * 100);
                          const risk = o.status === 'Risco' || prog < 60;
                          return (
                            <div
                              key={o.id}
                              className={`rounded-lg border p-3 ${
                                risk ? 'border-red-500/30 bg-red-500/10' : 'border-gray-800 bg-[#121212]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-white font-semibold text-sm">{o.nome}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {o.categoria || '—'} · {o.unidade || ''}
                                  </p>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded border ${statusBadgeClass(o.status)}`}>
                                  {fmtPct(prog)}
                                </span>
                              </div>
                              <div className="mt-2 bg-black/40 rounded h-2">
                                <div className="bg-[#ADF802] h-2 rounded" style={{ width: `${prog}%` }} />
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                {safeNumber(o.valor_atual)} / {safeNumber(o.meta_valor)} {o.unidade || ''}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </Card>

                  <Card className="bg-[#0d0d0d] border-gray-800 p-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-sky-400" />
                      Últimos Fechamentos (sinal de entrega)
                    </h3>

                    <div className="mt-3 space-y-2">
                      {s.fechamentos.length === 0 ? (
                        <p className="text-sm text-gray-400">Nenhum fechamento encontrado para este supervisor.</p>
                      ) : (
                        s.fechamentos.slice(0, 10).map((f) => (
                          <div key={f.id} className="bg-[#121212] border border-gray-800 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-white font-semibold">
                                {getLocalDateBR(f.semana_inicio)} → {getLocalDateBR(f.semana_fim)}
                              </p>
                              <span className="text-xs text-gray-500">ID: {String(f.id).slice(0, 6)}...</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 mt-2 text-xs text-gray-400">
                              <div className="bg-black/30 rounded p-2">
                                <p className="text-gray-500">Lig</p>
                                <p className="text-white font-semibold">{safeNumber(f.total_ligacoes_next_ip ?? f.ligacoes_next_ip ?? f.ligacoes)}</p>
                              </div>
                              <div className="bg-black/30 rounded p-2">
                                <p className="text-gray-500">Cham</p>
                                <p className="text-white font-semibold">{safeNumber(f.total_chamados_verdana ?? f.chamados_verdana ?? f.chamados)}</p>
                              </div>
                              <div className="bg-black/30 rounded p-2">
                                <p className="text-gray-500">Mon</p>
                                <p className="text-white font-semibold">{safeNumber(f.total_monitorias ?? f.monitorias)}</p>
                              </div>
                              <div className="bg-black/30 rounded p-2">
                                <p className="text-gray-500">FB</p>
                                <p className="text-white font-semibold">{safeNumber(f.total_1_1 ?? f.feedbacks_individuais ?? f.feedbacks)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    className="bg-[#1a1a1a] border border-gray-700 hover:bg-[#242424]"
                    onClick={() => {
                      setDetailOpen(false);
                      setDetailSupervisor(null);
                    }}
                  >
                    Fechar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </Card>

      {/* OKRs (Resultados-Chave) */}
      <Card className="bg-[#0d0d0d] border-gray-800 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-[#ADF802]" />
              Resultados-Chave (OKRs)
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Ordenado por risco primeiro. Use busca e filtro para navegar.
            </p>
          </div>

          <div className="text-xs text-gray-500 flex items-center gap-2">
            Total: <span className="text-gray-300 font-semibold">{okrCards.length}</span>
          </div>
        </div>

        <Separator className="my-4 bg-gray-800" />

        {okrCards.length === 0 ? (
          <div className="text-center py-10">
            <Target className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Nenhum OKR encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {okrCards.map((okr) => (
              <Card
                key={okr.id}
                className={`bg-[#121212] border-gray-800 p-4 ${
                  okr.emRisco ? 'hover:border-red-500/40' : 'hover:border-[#ADF802]/30'
                } transition-colors`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500">{okr.categoria || '—'}</p>
                    <h3 className="text-white font-semibold mt-1">{okr.nome}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{okr.descricao || ''}</p>
                  </div>

                  <span className={`text-xs font-bold px-2 py-1 rounded border ${statusBadgeClass(okr.status)}`}>
                    {okr.status} · {fmtPct(okr.progresso)}
                  </span>
                </div>

                <div className="mt-3 bg-black/40 rounded h-2">
                  <div
                    className="bg-[#ADF802] h-2 rounded"
                    style={{ width: `${okr.progresso}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                  <span>
                    Atual: <span className="text-gray-300 font-semibold">{safeNumber(okr.valor_atual)}</span>
                  </span>
                  <span>
                    Meta: <span className="text-gray-300 font-semibold">{safeNumber(okr.meta_valor)}</span> {okr.unidade || ''}
                  </span>
                </div>

                {okr.emRisco ? (
                  <div className="mt-3 text-xs text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Ação recomendada (risco ou &lt; 60%).
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}