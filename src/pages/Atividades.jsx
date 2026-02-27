import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { toast } from "sonner";
import { Plus, Loader2, RefreshCw } from "lucide-react";

/** =========================
 * HELPERS
 * ========================= */
function idStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function fmtDateOnlyBR(v) {
  if (!v) return "-";
  const s = String(v);
  const iso = s.includes("T") ? s.split("T")[0] : s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("pt-BR");
  } catch {
    return s;
  }
}

/** =========================
 * COMPONENTS
 * ========================= */
function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-gray-300">{label}</Label>
      {children}
    </div>
  );
}

// ✅ placar 1–5 com clique garantido
function Rating5({ value, onChange, disabled }) {
  const v = Number(value) || 0;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = v === n;
        return (
          <button
            key={n}
            type="button" // ✅ CRÍTICO (não vira submit)
            disabled={disabled}
            onClick={() => onChange(n)}
            className={[
              "h-8 w-8 rounded-md border text-xs font-semibold transition",
              active
                ? "bg-green-700/70 border-green-500 text-white"
                : "bg-[#121212] border-gray-700 text-gray-200",
              disabled
                ? "opacity-60 cursor-not-allowed"
                : "cursor-pointer hover:border-gray-500",
            ].join(" ")}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="px-2 py-1 rounded-md text-xs border border-gray-700 bg-[#1a1a1a] text-gray-200">
      {children}
    </span>
  );
}

/** =========================
 * CONFIG (ajuste se quiser)
 * ========================= */
const TIPOS = [
  { value: "chamado", label: "Chamado" },
  { value: "ligacao", label: "Ligação" },
  { value: "monitoria_offline", label: "Monitoria Offline" },
  { value: "monitoria_assistida", label: "Monitoria Assistida" },
  { value: "feedback", label: "Feedback" },
];

// Offline (tópicos do placar 1–5)
const OFFLINE_TOPICOS = [
  { id: "t1", label: "Saudação Padrão de Atendimento" },
  { id: "t2", label: "Validação da loja e colaborador em linha" },
  { id: "t3", label: "Domínio/conhecimento do problema" },
  { id: "t4", label: "Comunicação direta e objetiva" },
  { id: "t5", label: "Domínio na condução da ligação" },
  { id: "t6", label: "Tratou a loja com respeito" },
  { id: "t7", label: "Teve equilíbrio emocional" },
];

// Assistida (perguntas com Select + nota geral 1–5)
const ASSISTIDA_PERGUNTAS = [
  { id: "q1", label: "Apresentação e abordagem inicial" },
  { id: "q2", label: "Validação de loja/usuário/caixa" },
  { id: "q3", label: "Diagnóstico e condução técnica" },
  { id: "q4", label: "Comunicação clara e objetiva" },
  { id: "q5", label: "Encerramento correto (recap + próximos passos)" },
];

const ASSISTIDA_OPCOES = [
  { value: "correto", label: "Correto" },
  { value: "parcial", label: "Parcial" },
  { value: "incorreto", label: "Incorreto" },
  { value: "na", label: "N/A" },
];

function sumNotas(notasObj) {
  return Object.values(notasObj || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
}

/** =========================
 * PAGE
 * ========================= */
export default function Atividades() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");

  // modal criar
  const [openNew, setOpenNew] = useState(false);

  // form
  const [tipo, setTipo] = useState("chamado");
  const [analistaId, setAnalistaId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [protocolo, setProtocolo] = useState("");

  // campos por tipo
  const [ticket, setTicket] = useState(""); // chamado/ligacao
  const [duracao, setDuracao] = useState(""); // ligacao
  const [comentario, setComentario] = useState(""); // todos

  // monitoria offline
  const [notasOffline, setNotasOffline] = useState({}); // {t1:1..5}

  // monitoria assistida
  const [respostasAssistida, setRespostasAssistida] = useState({}); // {q1: "correto"...}
  const [notaAssistida, setNotaAssistida] = useState(0); // 1..5

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  // ✅ supervisor consegue classificar (corrige “sem interação” por disabled)
  const canRate =
    currentUser?.role === "admin" ||
    currentUser?.role === "coordenacao" ||
    currentUser?.role === "supervisor";

  // listas base
  const { data: analistas = [], isLoading: loadingAnalistas } = useQuery({
    queryKey: ["analistas_list"],
    queryFn: async () => {
      const raw = await base44.entities.Analista.list("-created_date", 900);
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!currentUser,
  });

  const { data: supervisores = [], isLoading: loadingSupervisores } = useQuery({
    queryKey: ["supervisores_list"],
    queryFn: async () => {
      const raw = await base44.entities.Supervisor.list("-created_date", 300);
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!currentUser,
  });

  const analistaMap = useMemo(() => {
    const m = {};
    for (const a of analistas) m[idStr(a?.id)] = a;
    return m;
  }, [analistas]);

  const supervisorMap = useMemo(() => {
    const m = {};
    for (const s of supervisores) m[idStr(s?.id)] = s;
    return m;
  }, [supervisores]);

  // listagem de atividades
  const { data: atividades = [], isLoading: loadingAtividades } = useQuery({
    queryKey: ["atividades_list"],
    queryFn: async () => {
      const raw = await base44.entities.Atividade.list("-created_date", 600);
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!currentUser,
  });

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return atividades;

    return (atividades || []).filter((t) => {
      const blob = [
        t?.id,
        t?.codigo_atividade,
        t?.tipo,
        t?.ticket,
        t?.protocolo_gravacao,
        t?.comentario,
        t?.registrado_por,
        t?.created_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(s);
    });
  }, [atividades, search]);

  function resetForm() {
    setTipo("chamado");
    setAnalistaId("");
    setSupervisorId("");
    setProtocolo("");
    setTicket("");
    setDuracao("");
    setComentario("");
    setNotasOffline({});
    setRespostasAssistida({});
    setNotaAssistida(0);
  }

  // auto-supervisor (se o analista tiver supervisor_id)
  function handleAnalistaChange(id) {
    setAnalistaId(id);
    const a = analistaMap[idStr(id)];
    const sup = idStr(a?.supervisor_id || a?.supervisor || "");
    if (sup) setSupervisorId(sup);
  }

  const criarMutation = useMutation({
    mutationFn: async () => {
      if (!tipo) throw new Error("Selecione o tipo.");
      if (!analistaId) throw new Error("Selecione o analista.");

      // validações específicas
      if ((tipo === "chamado" || tipo === "ligacao") && !ticket?.trim()) {
        throw new Error("Informe o ticket/protocolo do chamado/ligação.");
      }

      if (tipo === "monitoria_offline" && !canRate) {
        throw new Error("Seu perfil não pode classificar monitoria offline.");
      }

      if (tipo === "monitoria_assistida" && !canRate) {
        throw new Error("Seu perfil não pode classificar monitoria assistida.");
      }

      // payload base
      const payload = {
        tipo,
        analista_id: analistaId,
        analista_nome: analistaMap[idStr(analistaId)]?.nome || null,
        supervisor_id: supervisorId || null,
        supervisor_nome: supervisorMap[idStr(supervisorId)]?.nome || null,

        ticket: ticket || null,
        duracao: duracao || null,

        protocolo_gravacao: protocolo || null,
        comentario: comentario || null,

        // monitorias
        notas_offline: tipo === "monitoria_offline" ? notasOffline : null,
        nota_total_offline: tipo === "monitoria_offline" ? sumNotas(notasOffline) : null,

        respostas_assistida: tipo === "monitoria_assistida" ? respostasAssistida : null,
        nota_assistida: tipo === "monitoria_assistida" ? (notaAssistida || null) : null,
      };

      return await base44.entities.Atividade.create(payload);
    },
    onSuccess: async () => {
      toast.success("✅ Atividade criada");
      setOpenNew(false);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["atividades_list"] });
    },
    onError: (e) => {
      toast.error("Erro ao criar", { description: e?.message || "Falha inesperada" });
    },
  });

  const supervisorLabel = useMemo(() => {
    const s = supervisorMap[idStr(supervisorId)];
    return s?.nome || s?.nome_supervisor || (supervisorId ? supervisorId : "—");
  }, [supervisorId, supervisorMap]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Atividades</h1>
          <p className="text-gray-400">Registre e gerencie as atividades do Suporte</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="bg-[#1a1a1a] border border-gray-700"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["atividades_list"] })}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>

          <Button className="bg-green-600 hover:bg-green-700" onClick={() => setOpenNew(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Atividade
          </Button>
        </div>
      </div>

      {/* Buscar */}
      <div className="bg-[#121212] border border-gray-800 rounded p-4 space-y-2">
        <Label>Buscar</Label>
        <Input
          className="bg-[#1a1a1a] border-gray-700"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, tipo, ticket, protocolo..."
        />
      </div>

      {/* Lista */}
      <div className="bg-[#121212] border border-gray-800 rounded p-4">
        {(loadingAtividades || loadingAnalistas || loadingSupervisores) ? (
          <div className="text-gray-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : rows.length === 0 ? (
          <div className="text-gray-400">Nenhuma atividade encontrada.</div>
        ) : (
          <div className="w-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-400">
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 pr-2">Data</th>
                  <th className="text-left py-2 pr-2">Tipo</th>
                  <th className="text-left py-2 pr-2">Analista</th>
                  <th className="text-left py-2 pr-2">Supervisor</th>
                  <th className="text-left py-2 pr-2">Ticket/Protocolo</th>
                  <th className="text-left py-2 pr-2">Criado por</th>
                </tr>
              </thead>
              <tbody className="text-gray-100">
                {rows.map((t) => {
                  const a = analistaMap[idStr(t?.analista_id)];
                  const s = supervisorMap[idStr(t?.supervisor_id)];
                  return (
                    <tr key={t.id} className="border-b border-gray-800/60">
                      <td className="py-2 pr-2">{fmtDateOnlyBR(t?.created_date || t?.data)}</td>
                      <td className="py-2 pr-2">
                        <Pill>{t?.tipo || "-"}</Pill>
                      </td>
                      <td className="py-2 pr-2">{a?.nome || t?.analista_nome || "-"}</td>
                      <td className="py-2 pr-2">{s?.nome || t?.supervisor_nome || "-"}</td>
                      <td className="py-2 pr-2">{t?.ticket || t?.protocolo_gravacao || "-"}</td>
                      <td className="py-2 pr-2">{t?.registrado_por || t?.created_by || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL NOVA ATIVIDADE */}
      <Dialog
        open={openNew}
        onOpenChange={(open) => {
          setOpenNew(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="bg-[#121212] border border-gray-800 text-gray-100 max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nova Atividade</DialogTitle>
            <DialogDescription className="text-gray-400">
              A data será registrada automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field label="Tipo de Atividade">
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="bg-[#1a1a1a] border-gray-700">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Analista">
              <Select value={analistaId} onValueChange={handleAnalistaChange}>
                <SelectTrigger className="bg-[#1a1a1a] border-gray-700">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {analistas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a?.nome || a?.email || a.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Supervisor Responsável">
              <Select value={supervisorId} onValueChange={setSupervisorId}>
                <SelectTrigger className="bg-[#1a1a1a] border-gray-700">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {supervisores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s?.nome || s?.nome_supervisor || s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500 mt-1">Selecionado: {supervisorLabel}</div>
            </Field>

            {/* Campos específicos por tipo */}
            {(tipo === "chamado" || tipo === "ligacao") ? (
              <>
                <Field label="Ticket / Protocolo do Chamado">
                  <Input
                    className="bg-[#1a1a1a] border-gray-700"
                    value={ticket}
                    onChange={(e) => setTicket(e.target.value)}
                    placeholder="Ex.: CH00001"
                  />
                </Field>

                {tipo === "ligacao" ? (
                  <Field label="Duração da Ligação (opcional)">
                    <Input
                      className="bg-[#1a1a1a] border-gray-700"
                      value={duracao}
                      onChange={(e) => setDuracao(e.target.value)}
                      placeholder="Ex.: 00:08:32"
                    />
                  </Field>
                ) : (
                  <div />
                )}
              </>
            ) : null}

            {(tipo === "monitoria_offline" || tipo === "monitoria_assistida") ? (
              <Field label="Protocolo da Gravação">
                <Input
                  className="bg-[#1a1a1a] border-gray-700"
                  value={protocolo}
                  onChange={(e) => setProtocolo(e.target.value)}
                  placeholder="Digite o protocolo"
                />
              </Field>
            ) : (
              <div />
            )}

            {/* MONITORIA OFFLINE */}
            {tipo === "monitoria_offline" ? (
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-white font-semibold">Tópicos de Avaliação</div>
                  <div className="text-gray-300 text-sm">
                    Total: <span className="text-green-400 font-semibold">{sumNotas(notasOffline)}</span>
                  </div>
                </div>

                {/* ✅ NADA de pointer-events-none aqui.
                    Apenas desabilita via disabled do Rating5 quando não pode */}
                <div className="space-y-2">
                  {OFFLINE_TOPICOS.map((t, idx) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-gray-800 bg-[#0f0f0f] px-3 py-2"
                    >
                      <div className="text-gray-200 text-xs">
                        <span className="text-gray-400 mr-2">{idx + 1} -</span>
                        {t.label}
                      </div>

                      <Rating5
                        value={notasOffline[t.id] || 0}
                        disabled={!canRate}
                        onChange={(n) =>
                          setNotasOffline((prev) => ({ ...prev, [t.id]: n }))
                        }
                      />
                    </div>
                  ))}
                </div>

                {!canRate ? (
                  <div className="text-xs text-yellow-500">
                    ⚠ Seu perfil ({currentUser?.role || "visitante"}) não pode classificar monitoria.
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* MONITORIA ASSISTIDA */}
            {tipo === "monitoria_assistida" ? (
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-white font-semibold">Perguntas (Monitoria Assistida)</div>
                  <div className="flex items-center gap-2">
                    <div className="text-gray-400 text-xs">Nota (1–5):</div>
                    <Rating5
                      value={notaAssistida || 0}
                      disabled={!canRate}
                      onChange={(n) => setNotaAssistida(n)}
                    />
                  </div>
                </div>

                {/* ✅ Select controlado corretamente (value + onValueChange) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ASSISTIDA_PERGUNTAS.map((q, idx) => (
                    <div
                      key={q.id}
                      className="rounded-md border border-gray-800 bg-[#0f0f0f] px-3 py-2"
                    >
                      <div className="text-xs text-gray-200 mb-2">
                        <span className="text-gray-400 mr-2">{idx + 1} -</span>
                        {q.label}
                      </div>

                      <Select
                        value={String(respostasAssistida[q.id] ?? "")} // ✅ nunca undefined
                        onValueChange={(v) =>
                          setRespostasAssistida((prev) => ({ ...prev, [q.id]: v }))
                        }
                        disabled={!canRate}
                      >
                        <SelectTrigger className="bg-[#1a1a1a] border-gray-700 h-9">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSISTIDA_OPCOES.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                {!canRate ? (
                  <div className="text-xs text-yellow-500">
                    ⚠ Seu perfil ({currentUser?.role || "visitante"}) não pode classificar monitoria.
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* FEEDBACK */}
            {tipo === "feedback" ? (
              <div className="md:col-span-2 text-gray-400 text-xs">
                Feedback: use o campo Comentário abaixo para registrar.
              </div>
            ) : null}

            <div className="md:col-span-2 space-y-2">
              <Label>Comentário</Label>
              <Textarea
                className="bg-[#1a1a1a] border-gray-700 min-h-[110px]"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Detalhes adicionais..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              className="bg-[#1a1a1a] border border-gray-700"
              onClick={() => setOpenNew(false)}
              disabled={criarMutation.isPending}
            >
              Fechar
            </Button>

            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => criarMutation.mutate()}
              disabled={criarMutation.isPending}
            >
              {criarMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}