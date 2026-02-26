import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

import { Loader2, Sparkles, RefreshCcw, ShieldAlert, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";

import PlanoAcaoIAWidget from "@/components/PlanoAcaoIAWidget";

function toArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (maybe && Array.isArray(maybe.items)) return maybe.items;
  return [];
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function dateISO(d) {
  // yyyy-mm-dd
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function withinRangeISO(dateStr, startISO, endISO) {
  if (!dateStr) return false;
  if (startISO && dateStr < startISO) return false;
  if (endISO && dateStr > endISO) return false;
  return true;
}

function trendIcon(kind) {
  if (kind === "up") return <TrendingUp className="w-4 h-4" />;
  if (kind === "down") return <TrendingDown className="w-4 h-4" />;
  return <Minus className="w-4 h-4" />;
}

function trendBadge(kind) {
  const base = "border text-xs";
  if (kind === "up") return <Badge className={`${base} bg-emerald-500/15 text-emerald-300 border-emerald-500/30`}>{trendIcon("up")} <span className="ml-1">Melhorando</span></Badge>;
  if (kind === "down") return <Badge className={`${base} bg-red-500/15 text-red-300 border-red-500/30`}>{trendIcon("down")} <span className="ml-1">Piorando</span></Badge>;
  return <Badge className={`${base} bg-gray-500/15 text-gray-200 border-gray-500/30`}>{trendIcon("stable")} <span className="ml-1">Estável</span></Badge>;
}

export default function Dashboard() {
  // ======== filtros ========
  const today = new Date();
  const defaultEnd = dateISO(today);
  const defaultStart = dateISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30));

  const [tab, setTab] = useState("kpi");
  const [supervisorFilter, setSupervisorFilter] = useState("all");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // ======== agente IA ========
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState("");
  const [aiExtraContext, setAiExtraContext] = useState("");

  const { data: currentUser, isLoading: loadingMe } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
    staleTime: 60_000,
  });

  const { data: supervisoresRaw = [], isLoading: loadingSup } = useQuery({
    queryKey: ["supervisores"],
    queryFn: () => base44.entities.Supervisor.list(),
    staleTime: 10 * 60_000,
  });
  const supervisores = toArray(supervisoresRaw);

  const { data: usuariosRaw = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => base44.entities.User.list(),
    staleTime: 10 * 60_000,
  });
  const usuarios = toArray(usuariosRaw);

  const { data: analistasRaw = [] } = useQuery({
    queryKey: ["analistas"],
    queryFn: () => base44.entities.Analista.list(),
    staleTime: 10 * 60_000,
  });
  const analistas = toArray(analistasRaw);

  const { data: atividadesRaw = [], isLoading: loadingAtividades } = useQuery({
    queryKey: ["atividadesDashboard"],
    queryFn: async () => {
      // pega tudo (você pode reduzir limite se quiser)
      const atividadesList = await base44.entities.Atividade.list("-created_date", 800);

      // só aprovados
      const aprovRaw = await base44.entities.AprovacaoAtividade.filter({ tipo: "atividade", status: "aprovado" });
      const aprovados = new Set(toArray(aprovRaw).map(a => a.atividade_id).filter(Boolean));

      return toArray(atividadesList).filter(a => aprovados.has(a.id));
    },
    staleTime: 15_000,
  });
  const atividades = toArray(atividadesRaw);

  const { data: fechamentosRaw = [], isLoading: loadingFech } = useQuery({
    queryKey: ["fechamentosDashboard"],
    queryFn: async () => {
      const todos = await base44.entities.FechamentoSemanal.list("-semana_inicio", 52);

      const aprovRaw = await base44.entities.AprovacaoAtividade.filter({ tipo: "fechamento", status: "aprovado" });
      const aprovados = new Set(toArray(aprovRaw).map(a => a.atividade_id).filter(Boolean));

      return toArray(todos).filter(f => aprovados.has(f.id));
    },
    staleTime: 60_000,
  });
  const fechamentos = toArray(fechamentosRaw);

  const { data: incidentesRaw = [], isLoading: loadingInc } = useQuery({
    queryKey: ["incidentesDashboard"],
    queryFn: async () => {
      const list = await base44.entities.Incidente.list("-created_date", 300);

      // se você quiser: também filtrar aprovados
      // const aprovRaw = await base44.entities.AprovacaoAtividade.filter({ tipo: "warroom", status: "aprovado" });
      // const aprovados = new Set(toArray(aprovRaw).map(a => a.atividade_id).filter(Boolean));
      // return toArray(list).filter(i => aprovados.has(i.id));

      return toArray(list);
    },
    staleTime: 30_000,
  });
  const incidentes = toArray(incidentesRaw);

  // ======== helpers de nomes ========
  const getUserNameByEmail = (email) => {
    const u = usuarios.find(x => x.email === email);
    return u?.nome_customizado || u?.full_name || email || "-";
  };

  const supervisorOptions = useMemo(() => {
    return supervisores.map(s => {
      const nome = getUserNameByEmail(s.usuario_email) || s.nome || "Supervisor";
      return { id: s.id, nome };
    });
  }, [supervisores, usuarios]);

  const getSupervisorNameById = (id) => {
    const found = supervisorOptions.find(s => s.id === id);
    return found?.nome || "-";
  };

  const getAnalistaNameById = (id) => {
    const a = analistas.find(x => x.id === id);
    const nome = getUserNameByEmail(a?.usuario_email);
    return nome || a?.nome || "-";
  };

  // ======== dataset filtrado (supervisor + período) ========
  const atividadesFiltradas = useMemo(() => {
    return atividades.filter(a => {
      if (supervisorFilter !== "all" && a.supervisor_id !== supervisorFilter) return false;
      // Atividade.data no seu sistema costuma ser yyyy-mm-dd
      if (!withinRangeISO(a.data, startDate, endDate)) return false;
      return true;
    });
  }, [atividades, supervisorFilter, startDate, endDate]);

  const fechamentosFiltrados = useMemo(() => {
    // Fechamento tem semana_inicio / semana_fim, usamos semana_inicio para filtro
    return fechamentos.filter(f => {
      if (!withinRangeISO(f.semana_inicio, startDate, endDate)) return false;
      return true;
    });
  }, [fechamentos, startDate, endDate]);

  const incidentesFiltrados = useMemo(() => {
    return incidentes.filter(i => {
      // se tiver campo data/criado, tenta usar created_date
      const d = (i.created_date || i.created_at || "").slice(0, 10);
      if (d && !withinRangeISO(d, startDate, endDate)) return false;
      return true;
    });
  }, [incidentes, startDate, endDate]);

  // ======== KPIs (operacionais + qualidade + governança) ========
  const kpis = useMemo(() => {
    const totalAtividades = atividadesFiltradas.length;
    const notaMedia = totalAtividades
      ? atividadesFiltradas.reduce((sum, a) => sum + safeNumber(a.nota), 0) / totalAtividades
      : 0;

    const concluidas = atividadesFiltradas.filter(a => a.status === "Concluído").length;
    const taxaConclusao = totalAtividades ? (concluidas / totalAtividades) * 100 : 0;

    // proxy de "produtividade" usando fechamentos
    const totalLigacoes = fechamentosFiltrados.reduce((sum, f) => sum + safeNumber(f.total_ligacoes_next_ip), 0);
    const totalChamados = fechamentosFiltrados.reduce((sum, f) => sum + safeNumber(f.total_chamados_verdana), 0);
    const totalMonitorias = fechamentosFiltrados.reduce((sum, f) => sum + safeNumber(f.total_monitorias), 0);

    // proxy "SLA/tempo" se você tiver "tempo_resolucao" na atividade (se não tiver, fica 0)
    const tempos = atividadesFiltradas.map(a => safeNumber(a.tempo_resolucao_horas || a.tempo_resolucao || 0)).filter(n => n > 0);
    const tma = tempos.length ? (tempos.reduce((s, n) => s + n, 0) / tempos.length) : 0;

    // incidentes críticos (severidade alta)
    const criticos = incidentesFiltrados.filter(i => String(i.severidade || "").toLowerCase().includes("alta") || String(i.severidade || "").includes("1")).length;

    // tendência simples comparando metade inicial vs metade final
    const half = Math.max(1, Math.floor(totalAtividades / 2));
    const firstHalf = atividadesFiltradas.slice(0, half);
    const secondHalf = atividadesFiltradas.slice(half);

    const avg1 = firstHalf.length ? firstHalf.reduce((s, a) => s + safeNumber(a.nota), 0) / firstHalf.length : notaMedia;
    const avg2 = secondHalf.length ? secondHalf.reduce((s, a) => s + safeNumber(a.nota), 0) / secondHalf.length : notaMedia;

    const qualityTrend = avg2 > avg1 + 0.15 ? "up" : avg2 < avg1 - 0.15 ? "down" : "stable";

    // metas sugeridas (você pode ajustar)
    const metas = {
      notaMedia: 8.5,
      taxaConclusao: 85,
      tma: 8, // horas (proxy)
      criticos: 0,
      produtividade: 100, // score proxy
    };

    // produtividade proxy (ligações + chamados) / (dias do período)
    const days = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)));
    const prodScore = ((totalLigacoes + totalChamados) / days) || 0;

    const prodTrend = prodScore >= metas.produtividade ? "up" : "down";

    return {
      totalAtividades,
      notaMedia,
      taxaConclusao,
      totalLigacoes,
      totalChamados,
      totalMonitorias,
      tma,
      criticos,
      trends: {
        quality: qualityTrend,
        prod: prodTrend,
      },
      metas,
      prodScore,
    };
  }, [atividadesFiltradas, fechamentosFiltrados, incidentesFiltrados, startDate, endDate]);

  // ======== OKRs (com progresso automático) ========
  const okrs = useMemo(() => {
    // Objetivo 1: Qualidade de Atendimento
    const kr1 = {
      nome: "Qualidade média (nota) ≥ 8.5",
      atual: kpis.notaMedia,
      meta: 8.5,
      unidade: "pts",
      progresso: clamp((kpis.notaMedia / 8.5) * 100, 0, 120),
    };

    const kr2 = {
      nome: "Taxa de conclusão ≥ 85%",
      atual: kpis.taxaConclusao,
      meta: 85,
      unidade: "%",
      progresso: clamp((kpis.taxaConclusao / 85) * 100, 0, 120),
    };

    // Objetivo 2: Eficiência Operacional
    const kr3 = {
      nome: "Produtividade (ligações + chamados/dia) ≥ 100",
      atual: kpis.prodScore,
      meta: 100,
      unidade: "/dia",
      progresso: clamp((kpis.prodScore / 100) * 100, 0, 120),
    };

    const kr4 = {
      nome: "TMA médio (proxy) ≤ 8h",
      atual: kpis.tma,
      meta: 8,
      unidade: "h",
      progresso: kpis.tma > 0 ? clamp((8 / kpis.tma) * 100, 0, 120) : 0,
    };

    // Objetivo 3: Resiliência / Incidentes
    const kr5 = {
      nome: "Incidentes críticos no período = 0",
      atual: kpis.criticos,
      meta: 0,
      unidade: "",
      progresso: kpis.criticos === 0 ? 100 : clamp(100 - kpis.criticos * 25, 0, 100),
    };

    const objetivos = [
      {
        objetivo: "Elevar a qualidade e consistência do atendimento do N1",
        owner: supervisorFilter === "all" ? "Coordenação" : getSupervisorNameById(supervisorFilter),
        krs: [kr1, kr2],
      },
      {
        objetivo: "Aumentar eficiência operacional e reduzir tempo de entrega",
        owner: supervisorFilter === "all" ? "Coordenação" : getSupervisorNameById(supervisorFilter),
        krs: [kr3, kr4],
      },
      {
        objetivo: "Reduzir impacto de incidentes e melhorar estabilidade",
        owner: "Redes + Sustentação",
        krs: [kr5],
      },
    ];

    // progresso por objetivo = média dos KRs (cap 100)
    const objetivosComProgresso = objetivos.map(o => {
      const avg = o.krs.length ? o.krs.reduce((s, k) => s + clamp(k.progresso, 0, 100), 0) / o.krs.length : 0;
      return { ...o, progresso: clamp(avg, 0, 100) };
    });

    return objetivosComProgresso;
  }, [kpis, supervisorFilter, supervisorOptions]);

  // ======== resumo por analista (ranking simples) ========
  const analistaResumo = useMemo(() => {
    const map = new Map();
    for (const a of atividadesFiltradas) {
      const id = a.analista_id || "unknown";
      const row = map.get(id) || { analista_id: id, qtd: 0, notaSum: 0, concluidas: 0 };
      row.qtd += 1;
      row.notaSum += safeNumber(a.nota);
      if (a.status === "Concluído") row.concluidas += 1;
      map.set(id, row);
    }

    const rows = Array.from(map.values()).map(r => ({
      ...r,
      nome: getAnalistaNameById(r.analista_id),
      notaMedia: r.qtd ? r.notaSum / r.qtd : 0,
      taxaConclusao: r.qtd ? (r.concluidas / r.qtd) * 100 : 0,
    }));

    rows.sort((a, b) => b.notaMedia - a.notaMedia);
    return rows.slice(0, 10);
  }, [atividadesFiltradas, analistas, usuarios]);

  const isLoading = loadingMe || loadingSup || loadingAtividades || loadingFech || loadingInc;

  async function gerarPlanoIA() {
    try {
      setAiLoading(true);
      setAiPlan("");

      const supervisorNome = supervisorFilter === "all" ? "TODOS OS SUPERVISORES" : getSupervisorNameById(supervisorFilter);

      // resumo objetivo para IA
      const resumo = {
        periodo: { inicio: startDate, fim: endDate },
        supervisor: supervisorNome,
        kpis: {
          totalAtividades: kpis.totalAtividades,
          notaMedia: Number(kpis.notaMedia.toFixed(2)),
          taxaConclusao: Number(kpis.taxaConclusao.toFixed(2)),
          ligacoes: kpis.totalLigacoes,
          chamados: kpis.totalChamados,
          monitorias: kpis.totalMonitorias,
          tma_horas_proxy: Number(kpis.tma.toFixed(2)),
          incidentes_criticos: kpis.criticos,
        },
        topAnalistas: analistaResumo.map(a => ({
          nome: a.nome,
          qtd: a.qtd,
          notaMedia: Number(a.notaMedia.toFixed(2)),
          taxaConclusao: Number(a.taxaConclusao.toFixed(0)),
        })),
        okrs: okrs.map(o => ({
          objetivo: o.objetivo,
          owner: o.owner,
          progresso: Number(o.progresso.toFixed(0)),
          krs: o.krs.map(k => ({
            nome: k.nome,
            atual: Number.isFinite(k.atual) ? Number(k.atual.toFixed ? k.atual.toFixed(2) : k.atual) : k.atual,
            meta: k.meta,
          })),
        })),
      };

      const prompt = `
Você é um Diretor de Operações de TI e Mentor de Sustentação N1.
Crie um PLANO DE AÇÃO EXECUTIVO (KPIs + OKRs) para o período informado, com foco em:
- qualidade (nota)
- eficiência (produtividade e tempo)
- governança (cadência de supervisão e rituais)
- redução de incidentes críticos

Regras do plano:
1) Estruture em: Diagnóstico -> Prioridades -> Plano 30/60/90 -> Rituais semanais -> Atribuições (Supervisor/Analistas) -> Riscos -> Métricas de acompanhamento.
2) Entregue ações claras com: responsável, prazo (D+7/D+15/D+30), evidência (o que comprova), e ferramenta (GLPI/NextIP/Base44).
3) Inclua um quadro "1:1 com supervisores" com pauta objetiva.
4) Inclua também "Ações rápidas (72h)".
5) Seja MUITO prático: bullets curtos e checklist.

Contexto adicional do coordenador:
${aiExtraContext || "(sem contexto adicional)"}

Dados do período (JSON):
${JSON.stringify(resumo, null, 2)}
`.trim();

      // ✅ Tentativa de IA nativa do Base44 (se existir)
      // Se sua instância não tiver, cairá no catch e eu deixo uma saída "manual"
      const result = await base44.ai.generateText({ prompt });

      const text =
        result?.text ||
        result?.output ||
        result?.message ||
        (typeof result === "string" ? result : null);

      if (!text) {
        throw new Error("IA respondeu sem texto (verifique o formato da resposta).");
      }

      setAiPlan(text);
      toast.success("Plano de ação gerado com IA!");
    } catch (err) {
      console.error(err);

      // fallback: gera um plano “semi-pronto” mesmo sem IA
      const supervisorNome = supervisorFilter === "all" ? "Coordenação (todos)" : getSupervisorNameById(supervisorFilter);
      const fallback = `
PLANO DE AÇÃO (modelo) — ${supervisorNome}
Período: ${startDate} a ${endDate}

DIAGNÓSTICO (base KPIs)
- Total atividades: ${kpis.totalAtividades}
- Nota média: ${kpis.notaMedia.toFixed(2)} (meta 8.5)
- Conclusão: ${kpis.taxaConclusao.toFixed(0)}% (meta 85%)
- Produtividade (ligações+chamados/dia): ${kpis.prodScore.toFixed(1)} (meta 100)
- TMA proxy: ${kpis.tma.toFixed(1)}h (meta <= 8h)
- Incidentes críticos: ${kpis.criticos}

AÇÕES RÁPIDAS (72h)
[ ] Padronizar checklist de monitoria (MO/MA) + nota mínima por tópico
[ ] Definir ritual diário (15 min) com supervisor: pendências, bloqueios, escalonamentos
[ ] Revisar 10 atendimentos aleatórios por supervisor (evidência: print + nota)
[ ] Rodar campanha “Fechamento de backlog”: 2h/dia, com script de priorização

PLANO 30/60/90
D+30:
- Implantar governança semanal: 1:1 supervisor, War Room de recorrências, revisão de TOP 10 falhas
- Treinar gaps top 3 por analista (evidência: quiz + atividade prática)

D+60:
- Reduzir TMA proxy com padronização de POP + base de conhecimento + triagem
- Aumentar produtividade com roteiros de atendimento e automações

D+90:
- Estabilizar meta de nota >= 8.5 e conclusão >= 85%
- Zero incidentes críticos recorrentes (RCA + ações preventivas)

RITUAIS
- Daily 15min (supervisor)
- Semanal 45min: OKR Review + 3 ações corretivas
- Quinzenal: calibração de qualidade (amostragem + feedback)

RESPONSÁVEIS
- Supervisor: conduzir rituais + coaching
- Analistas: executar plano e evidenciar
- Coordenação: remover bloqueios + cobrar evidência

OBS: Para IA automática, habilite o módulo de IA no Base44 (base44.ai.generateText).
`.trim();

      setAiPlan(fallback);
      toast.error("IA não disponível no Base44 agora — gerei um plano modelo pronto pra usar.");
    } finally {
      setAiLoading(false);
    }
  }

  const headerSubtitle = useMemo(() => {
    const sup = supervisorFilter === "all" ? "Todos os supervisores" : getSupervisorNameById(supervisorFilter);
    return `${sup} • ${startDate} → ${endDate}`;
  }, [supervisorFilter, startDate, endDate, supervisorOptions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#ADF802]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Painel Executivo (KPIs + OKRs)</h1>
          <p className="text-gray-400 mt-1">{headerSubtitle}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="border-gray-700"
            onClick={() => {
              // reset filtros
              setSupervisorFilter("all");
              setStartDate(defaultStart);
              setEndDate(defaultEnd);
              setAiPlan("");
              setAiExtraContext("");
              toast.success("Filtros resetados.");
            }}
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="bg-[#0d0d0d] border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg">Filtros</CardTitle>
          <CardDescription className="text-gray-400">Aplique filtros para ver KPIs e OKRs por supervisor e período</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-400">Supervisor</label>
            <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
              <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-[#242424] border-gray-700">
                <SelectItem value="all">Todos</SelectItem>
                {supervisorOptions.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-gray-400">Data início</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-1 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Data fim</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#1a1a1a] border-gray-700 mt-1 text-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="bg-[#1a1a1a] border border-gray-700">
          <TabsTrigger value="kpi">KPIs</TabsTrigger>
          <TabsTrigger value="okr">OKRs</TabsTrigger>
          <TabsTrigger value="agente">Agente IA</TabsTrigger>
        </TabsList>

        {/* KPIs */}
        <TabsContent value="kpi" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="bg-[#1a1a1a] border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">Qualidade Média</CardTitle>
                <CardDescription className="text-gray-400 text-xs">Meta: {kpis.metas.notaMedia}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-bold text-white">{kpis.notaMedia.toFixed(1)}</div>
                  {trendBadge(kpis.trends.quality)}
                </div>
                <Progress value={clamp((kpis.notaMedia / kpis.metas.notaMedia) * 100, 0, 120)} />
                <div className="text-xs text-gray-400">Base: {kpis.totalAtividades} atividades aprovadas</div>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">Conclusão</CardTitle>
                <CardDescription className="text-gray-400 text-xs">Meta: {kpis.metas.taxaConclusao}%</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-bold text-white">{kpis.taxaConclusao.toFixed(0)}%</div>
                  <Badge className="bg-blue-500/15 text-blue-300 border border-blue-500/30 text-xs">
                    Governança
                  </Badge>
                </div>
                <Progress value={clamp((kpis.taxaConclusao / kpis.metas.taxaConclusao) * 100, 0, 120)} />
                <div className="text-xs text-gray-400">Status “Concluído” nas atividades</div>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">Produtividade</CardTitle>
                <CardDescription className="text-gray-400 text-xs">Meta: {kpis.metas.produtividade} /dia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-bold text-white">{kpis.prodScore.toFixed(1)}</div>
                  {trendBadge(kpis.trends.prod)}
                </div>
                <Progress value={clamp((kpis.prodScore / kpis.metas.produtividade) * 100, 0, 120)} />
                <div className="text-xs text-gray-400">
                  Ligações: {kpis.totalLigacoes} • Chamados: {kpis.totalChamados}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">Incidentes Críticos</CardTitle>
                <CardDescription className="text-gray-400 text-xs">Meta: 0</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-bold text-white">{kpis.criticos}</div>
                  <Badge className={`text-xs border ${kpis.criticos === 0 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-red-500/15 text-red-300 border-red-500/30"}`}>
                    <ShieldAlert className="w-4 h-4 mr-1" />
                    Risco
                  </Badge>
                </div>
                <Progress value={kpis.criticos === 0 ? 100 : clamp(100 - kpis.criticos * 25, 0, 100)} />
                <div className="text-xs text-gray-400">Base: {incidentesFiltrados.length} incidentes no período</div>
              </CardContent>
            </Card>
          </div>

          {/* Top analistas */}
          <Card className="bg-[#0d0d0d] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Top 10 (Qualidade por Analista)</CardTitle>
              <CardDescription className="text-gray-400">
                Base: atividades aprovadas no período (filtradas)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analistaResumo.length === 0 ? (
                <p className="text-gray-400">Sem dados suficientes no período.</p>
              ) : (
                <div className="space-y-2">
                  {analistaResumo.map((a, idx) => (
                    <div key={a.analista_id} className="flex items-center justify-between bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#ADF802]/15 border border-[#ADF802]/30 flex items-center justify-center text-[#ADF802] font-bold">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-white font-medium">{a.nome}</div>
                          <div className="text-xs text-gray-400">Qtd: {a.qtd} • Conclusão: {a.taxaConclusao.toFixed(0)}%</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold">{a.notaMedia.toFixed(2)}</div>
                        <div className="text-xs text-gray-400">nota média</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OKRs */}
        <TabsContent value="okr" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {okrs.map((o, idx) => (
              <Card key={idx} className="bg-[#0d0d0d] border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">{o.objetivo}</CardTitle>
                  <CardDescription className="text-gray-400">Owner: {o.owner}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-gray-300 mb-2">
                      <span>Progresso</span>
                      <span className="text-white font-semibold">{o.progresso.toFixed(0)}%</span>
                    </div>
                    <Progress value={o.progresso} />
                  </div>

                  <div className="space-y-3">
                    {o.krs.map((k, i) => (
                      <div key={i} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
                        <div className="text-white text-sm font-medium">{k.nome}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          Atual: <span className="text-white font-semibold">{Number.isFinite(k.atual) ? k.atual.toFixed?.(2) ?? String(k.atual) : String(k.atual)}</span>{" "}
                          {k.unidade} • Meta: <span className="text-white font-semibold">{k.meta}</span> {k.unidade}
                        </div>
                        <div className="mt-2">
                          <Progress value={clamp(k.progresso, 0, 100)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-[#1a1a1a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Cadência recomendada (OKR Review)</CardTitle>
              <CardDescription className="text-gray-400">Ritual semanal com supervisores para “fechar o loop”</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-gray-300">
              <div className="bg-[#0d0d0d] border border-gray-800 rounded-lg p-3">
                <div className="text-white font-semibold mb-2">Agenda 45min (semanal)</div>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>5min — Status geral KPIs/OKRs (tendência e gap vs meta)</li>
                  <li>10min — Top 3 causas raiz (ex.: baixa nota / baixa conclusão / alto TMA)</li>
                  <li>15min — Ações da semana (responsável + prazo + evidência)</li>
                  <li>10min — Revisão de amostras (monitorias / casos / incidentes)</li>
                  <li>5min — Bloqueios e decisões (o que precisa de coordenação)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agente IA */}
        <TabsContent value="agente" className="space-y-4">
          <Card className="bg-[#0d0d0d] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#ADF802]" />
                Agente IA — Plano de Ação com Supervisores
              </CardTitle>
              <CardDescription className="text-gray-400">
                Gera um plano executivo com ações, responsáveis, prazos e evidências com base nos KPIs/OKRs do período.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400">Contexto extra (opcional)</label>
                  <Textarea
                    value={aiExtraContext}
                    onChange={(e) => setAiExtraContext(e.target.value)}
                    placeholder="Ex.: foco em reduzir reabertura; aumentar FCR; problema com loja X; nova política de monitoria..."
                    className="bg-[#1a1a1a] border-gray-700 text-white mt-1 min-h-[120px]"
                  />
                </div>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                  <div className="text-white font-semibold mb-2">Resumo do período (input da IA)</div>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div>Supervisor: <span className="text-white font-semibold">{supervisorFilter === "all" ? "Todos" : getSupervisorNameById(supervisorFilter)}</span></div>
                    <div>Atividades aprovadas: <span className="text-white font-semibold">{kpis.totalAtividades}</span></div>
                    <div>Nota média: <span className="text-white font-semibold">{kpis.notaMedia.toFixed(2)}</span></div>
                    <div>Conclusão: <span className="text-white font-semibold">{kpis.taxaConclusao.toFixed(0)}%</span></div>
                    <div>Produtividade: <span className="text-white font-semibold">{kpis.prodScore.toFixed(1)}/dia</span></div>
                    <div>Incidentes críticos: <span className="text-white font-semibold">{kpis.criticos}</span></div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={gerarPlanoIA}
                      disabled={aiLoading}
                      className="bg-[#ADF802] hover:bg-[#9fe200] text-black font-semibold"
                    >
                      {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Gerar Plano de Ação
                    </Button>

                    <Button
                      variant="outline"
                      className="border-gray-700"
                      onClick={() => {
                        setAiPlan("");
                        toast.success("Plano limpo.");
                      }}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400">Plano de ação gerado</label>
                <Textarea
                  value={aiPlan}
                  readOnly
                  placeholder="Aqui aparecerá o plano de ação gerado..."
                  className="bg-[#1a1a1a] border-gray-700 text-white mt-1 min-h-[260px]"
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    className="border-gray-700"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(aiPlan || "");
                        toast.success("Copiado!");
                      } catch {
                        toast.error("Não consegui copiar. Selecione e copie manualmente.");
                      }
                    }}
                    disabled={!aiPlan}
                  >
                    Copiar
                  </Button>
                </div>
              </div>

              {/* ✅ Widget existente (se você já usa isso no projeto) */}
              {currentUser?.role === "admin" && (
                <div className="pt-2">
                  <PlanoAcaoIAWidget currentUser={currentUser} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white text-lg">Como você usa isso com seus 3 supervisores</CardTitle>
              <CardDescription className="text-gray-400">Fluxo prático de reunião para “fechar o ciclo”</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-300">
              <div className="bg-[#0d0d0d] border border-gray-800 rounded-lg p-3">
                <div className="text-white font-semibold mb-1">Reunião 1:1 (30min) — cada supervisor</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>5min: Revisão KPIs (gap vs meta) + tendência</li>
                  <li>10min: 3 causas raiz e evidências (casos reais)</li>
                  <li>10min: ações da semana (D+7/D+15) com responsáveis</li>
                  <li>5min: bloqueios para coordenação</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}