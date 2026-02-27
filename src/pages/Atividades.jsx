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
 * CONFIG: tópicos e perguntas
 * ========================= */
const OFFLINE_TOPICOS = [
  { id: "t1", label: "Saudação Padrão de Atendimento" },
  { id: "t2", label: "Validação da loja e colaborador em linha" },
  { id: "t3", label: "Domínio/conhecimento do problema" },
  { id: "t4", label: "Comunicação direta e objetiva" },
  { id: "t5", label: "Domínio na condução da ligação" },
  { id: "t6", label: "Tratou a loja com respeito" },
  { id: "t7", label: "Teve equilíbrio emocional" },
  // se você tiver mais, adicione aqui:
  // { id:"t8", label:"..." }
];

const ASSISTIDA_PERGUNTAS = [
  // exemplo — substitua pelo seu banco se quiser
  { id: "q1", label: "Atendimento se apresentou corretamente?" },
  { id: "q2", label: "Confirmou loja/caixa/usuário?" },
  { id: "q3", label: "Troubleshooting adequado?" },
  { id: "q4", label: "Encerramento correto (recap + próximos passos)?" },
  // ...
];

// opções do select (ex.: Certo/Errado/NA)
const OPCOES_ASSISTIDA = [
  { value: "correto", label: "Correto" },
  { value: "parcial", label: "Parcial" },
  { value: "incorreto", label: "Incorreto" },
  { value: "na", label: "N/A" },
];

/** helpers */
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

function sumNotas(obj) {
  return Object.values(obj || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** badge */
function Pill({ children }) {
  return (
    <span className="px-2 py-1 rounded-md text-xs border border-gray-700 bg-[#1a1a1a] text-gray-200">
      {children}
    </span>
  );
}

/** =========================
 * PAGE
 * ========================= */
export default function AtividadesPage() {
  const queryClient = useQueryClient();

  // filtros
  const [search, setSearch] = useState("");

  // modal "Nova Atividade"
  const [openNew, setOpenNew] = useState(false);

  // form state
  const [tipoAtividade, setTipoAtividade] = useState("monitoria_offline"); // monitoria_offline | monitoria_assistida | (outros)
  const [analistaId, setAnalistaId] = useState("");
  const [supervisorNome, setSupervisorNome] = useState(""); // exibido
  const [supervisorId, setSupervisorId] = useState(""); // salvo
  const [protocoloGravacao, setProtocoloGravacao] = useState("");

  // offline: notas 1-5 por tópico
  const [notasOffline, setNotasOffline] = useState({}); // { t1: 5, t2: 4 ... }

  // assistida: perguntas (select) + placar 1-5 geral
  const [respostasAssistida, setRespostasAssistida] = useState({}); // { q1:"correto", ... }
  const [notaAssistida, setNotaAssistida] = useState(0); // 1..5

  const [comentario, setComentario] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  // ✅ regra de permissão correta: supervisor pode classificar
  const canRate =
    currentUser?.role === "supervisor" ||
    currentUser?.role === "coordenacao" ||
    currentUser?.role === "admin";

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

  // atividades list (exemplo)
  const { data: atividades = [], isLoading: loadingAtividades } = useQuery({
    queryKey: ["atividades_list"],
    queryFn: async () => {
      const raw = await base44.entities.Atividade.list("-created_date", 500);
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
        t?.created_by,
        t?.registrado_por,
        t?.ticket,
        t?.comentario,
        t?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(s);
    });
  }, [atividades, search]);

  /** ao escolher analista, definir supervisor automaticamente se você tiver essa relação */
  function handleSelectAnalista(id) {
    setAnalistaId(id);
    const a = analistaMap[idStr(id)];
    // ajuste conforme seu schema real:
    const supId = idStr(a?.supervisor_id || a?.supervisor || "");
    if (supId && supervisorMap[supId]) {
      setSupervisorId(supId);
      setSupervisorNome(
        supervisorMap[supId]?.nome || supervisorMap[supId]?.nome_supervisor || ""
      );
    } else {
      // fallback: se não tem relação, deixa em branco
      setSupervisorId("");
      setSupervisorNome("");
    }
  }

  function resetForm() {
    setTipoAtividade("monitoria_offline");
    setAnalistaId("");
    setSupervisorId("");
    setSupervisorNome("");
    setProtocoloGravacao("");
    setNotasOffline({});
    setRespostasAssistida({});
    setNotaAssistida(0);
    setComentario("");
  }

  const criarMutation = useMutation({
    mutationFn: async () => {
      // validação mínima
      if (!analistaId) throw new Error("Selecione o analista.");
      if (tipoAtividade === "monitoria_offline") {
        // garante que todos os tópicos têm nota (opcional)
        // aqui não obrigo 100%, mas você pode obrigar:
        // for (const t of OFFLINE_TOPICOS) if (!notasOffline[t.id]) throw new Error(`Defina nota para: ${t.label}`);
      }
      if (tipoAtividade === "monitoria_assistida") {
        // exemplo: pode exigir nota geral
        // if (!notaAssistida) throw new Error("Defina nota geral (1 a 5).");
      }

      // payload padronizado
      const payload = {
        tipo: tipoAtividade,
        analista_id: analistaId,
        supervisor_id: supervisorId || null,
        supervisor_nome: supervisorNome || null,
        protocolo_gravacao: protocoloGravacao || null,
        comentario: comentario || null,

        // offline:
        notas_offline: tipoAtividade === "monitoria_offline" ? notasOffline : null,
        nota_total_offline:
          tipoAtividade === "monitoria_offline"
            ? sumNotas(notasOffline)
            : null,

        // assistida:
        respostas_assistida:
          tipoAtividade === "monitoria_assistida" ? respostasAssistida : null,
        nota_assistida: tipoAtividade === "monitoria_assistida" ? notaAssistida : null,
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

  /** =========================
   * UI pieces
   * ========================= */
  function Nota5({ value, onChange, disabled }) {
    // ✅ SEMPRE clicável quando não disabled, sem pointer-events-none em wrappers
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = Number(value) === n;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              className={[
                "h-8 w-8 rounded-md border text-xs font-semibold transition",
                active
                  ? "bg-green-700/70 border-green-500 text-white"
                  : "bg-[#121212] border-gray-700 text-gray-200",
                disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-gray-500",
              ].join(" ")}
            >
              {n}
            </button>
          );
        })}
      </div>
    );
  }

  function CompactBlock({ title, children, right }) {
    return (
      <div className="rounded-lg border border-gray-800 bg-[#0f0f0f]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
          <div className="text-sm font-semibold text-white">{title}</div>
          {right}
        </div>
        <div className="p-3">{children}</div>
      </div>
    );
  }

  /** =========================
   * Render
   * ========================= */
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Atividades</h1>
          <p className="text-gray-400">Registre e gerencie atividades do suporte</p>
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

          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setOpenNew(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Atividade
          </Button>
        </div>
      </div>

      {/* filtros */}
      <div className="bg-[#121212] border border-gray-800 rounded p-4 space-y-2">
        <Label>Buscar</Label>
        <Input
          className="bg-[#1a1a1a] border-gray-700"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, ID, tipo, e-mail, ticket..."
        />
      </div>

      {/* tabela */}
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
                  <th className="text-left py-2 pr-2">Criado por</th>
                </tr>
              </thead>
              <tbody className="text-gray-100">
                {rows.map((t) => {
                  const a = analistaMap[idStr(t?.analista_id)] || null;
                  const s = supervisorMap[idStr(t?.supervisor_id)] || null;

                  return (
                    <tr key={t.id} className="border-b border-gray-800/60">
                      <td className="py-2 pr-2">{fmtDateOnlyBR(t?.created_date || t?.data)}</td>
                      <td className="py-2 pr-2">
                        <Pill>{t?.tipo || "-"}</Pill>
                      </td>
                      <td className="py-2 pr-2">{a?.nome || t?.analista_nome || "-"}</td>
                      <td className="py-2 pr-2">
                        {s?.nome || t?.supervisor_nome || "-"}
                      </td>
                      <td className="py-2 pr-2">{t?.registrado_por || t?.created_by || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================
          MODAL NOVA ATIVIDADE (FULLSCREEN, SEM SCROLL)
          ========================= */}
      <Dialog
        open={openNew}
        onOpenChange={(open) => {
          setOpenNew(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent
          // ✅ fullscreen e sem rolagem interna
          className="
            bg-[#121212] border border-gray-800 text-gray-100
            w-[calc(100vw-32px)] max-w-none
            h-[calc(100vh-32px)] max-h-none
            overflow-hidden
            p-0
          "
        >
          <DialogHeader className="px-5 py-4 border-b border-gray-800">
            <DialogTitle>Nova Atividade</DialogTitle>
            <DialogDescription className="text-gray-400">
              A data será registrada automaticamente como {fmtDateOnlyBR(new Date().toISOString())}
            </DialogDescription>
          </DialogHeader>

          {/* corpo: 2 colunas, sem scroll */}
          <div className="h-[calc(100vh-32px-72px)] grid grid-cols-12 gap-4 p-5 overflow-hidden">
            {/* COLUNA ESQUERDA: dados */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-3 overflow-hidden">
              <CompactBlock title="Dados da Atividade">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo de Atividade</Label>
                    <Select value={tipoAtividade} onValueChange={setTipoAtividade}>
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monitoria_offline">Monitoria Offline</SelectItem>
                        <SelectItem value="monitoria_assistida">Monitoria Assistida</SelectItem>
                        {/* adicione outros tipos se existir */}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Analista</Label>
                    <Select value={analistaId} onValueChange={handleSelectAnalista}>
                      <SelectTrigger className="bg-[#1a1a1a] border-gray-700">
                        <SelectValue placeholder="Selecione o analista..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(analistas || []).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a?.nome || a?.email || a.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Supervisor Responsável</Label>
                    <div className="h-10 flex items-center px-3 rounded-md bg-[#1a1a1a] border border-gray-700 text-gray-100">
                      {supervisorNome || "—"}
                    </div>
                    {!!supervisorId ? (
                      <div className="text-[11px] text-gray-500">ID: {supervisorId}</div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>Protocolo da Gravação</Label>
                    <Input
                      className="bg-[#1a1a1a] border-gray-700"
                      value={protocoloGravacao}
                      onChange={(e) => setProtocoloGravacao(e.target.value)}
                      placeholder="Digite o protocolo"
                    />
                  </div>
                </div>
              </CompactBlock>

              <CompactBlock title="Comentário (opcional)">
                <Textarea
                  className="bg-[#1a1a1a] border-gray-700 min-h-[120px]"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Detalhes adicionais..."
                />
              </CompactBlock>

              <div className="mt-auto flex justify-end gap-2">
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

              {!canRate ? (
                <div className="text-xs text-yellow-500">
                  ⚠ Seu perfil ({currentUser?.role || "visitante"}) não pode classificar notas.
                </div>
              ) : null}
            </div>

            {/* COLUNA DIREITA: avaliação (sem scroll) */}
            <div className="col-span-12 lg:col-span-8 overflow-hidden flex flex-col gap-3">
              {tipoAtividade === "monitoria_offline" ? (
                <>
                  <CompactBlock
                    title="Tópicos de Avaliação (Offline)"
                    right={
                      <div className="text-xs text-gray-400">
                        Total:{" "}
                        <span className="text-green-400 font-semibold">
                          {sumNotas(notasOffline)}
                        </span>
                      </div>
                    }
                  >
                    {/* ✅ Sem scroll: grid em 2 colunas, bem compacto */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                      {OFFLINE_TOPICOS.map((t, idx) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-gray-800 bg-[#0c0c0c] px-3 py-2"
                        >
                          <div className="text-xs text-gray-200">
                            <span className="text-gray-400 mr-2">{idx + 1} -</span>
                            {t.label}
                          </div>

                          <Nota5
                            value={notasOffline[t.id] || 0}
                            disabled={!canRate}
                            onChange={(n) =>
                              setNotasOffline((prev) => ({ ...prev, [t.id]: n }))
                            }
                          />
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 text-[11px] text-gray-500">
                      Dica: se quiser obrigar todas as notas antes de salvar, eu ajusto a validação.
                    </div>
                  </CompactBlock>

                  <CompactBlock title="Resumo">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md border border-gray-800 bg-[#0c0c0c] p-3">
                        <div className="text-xs text-gray-400">Itens avaliados</div>
                        <div className="text-lg font-semibold text-white">
                          {OFFLINE_TOPICOS.length}
                        </div>
                      </div>
                      <div className="rounded-md border border-gray-800 bg-[#0c0c0c] p-3">
                        <div className="text-xs text-gray-400">Nota total</div>
                        <div className="text-lg font-semibold text-green-400">
                          {sumNotas(notasOffline)}
                        </div>
                      </div>
                    </div>
                  </CompactBlock>
                </>
              ) : (
                <>
                  <CompactBlock
                    title="Perguntas (Assistida)"
                    right={
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-400">Nota geral:</div>
                        <Nota5
                          value={notaAssistida || 0}
                          disabled={!canRate}
                          onChange={(n) => setNotaAssistida(n)}
                        />
                      </div>
                    }
                  >
                    {/* ✅ Sem scroll: grid em 2 colunas compactas */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                      {ASSISTIDA_PERGUNTAS.map((q, idx) => (
                        <div
                          key={q.id}
                          className="rounded-md border border-gray-800 bg-[#0c0c0c] px-3 py-2"
                        >
                          <div className="text-xs text-gray-200 mb-2">
                            <span className="text-gray-400 mr-2">{idx + 1} -</span>
                            {q.label}
                          </div>

                          <Select
                            value={String(respostasAssistida[q.id] ?? "")}
                            onValueChange={(v) =>
                              setRespostasAssistida((prev) => ({ ...prev, [q.id]: v }))
                            }
                            disabled={!canRate}
                          >
                            <SelectTrigger className="bg-[#121212] border-gray-700 h-9">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {OPCOES_ASSISTIDA.map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                  {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </CompactBlock>

                  <CompactBlock title="Resumo">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-md border border-gray-800 bg-[#0c0c0c] p-3">
                        <div className="text-xs text-gray-400">Perguntas</div>
                        <div className="text-lg font-semibold text-white">
                          {ASSISTIDA_PERGUNTAS.length}
                        </div>
                      </div>
                      <div className="rounded-md border border-gray-800 bg-[#0c0c0c] p-3">
                        <div className="text-xs text-gray-400">Respondidas</div>
                        <div className="text-lg font-semibold text-white">
                          {Object.values(respostasAssistida || {}).filter(Boolean).length}
                        </div>
                      </div>
                      <div className="rounded-md border border-gray-800 bg-[#0c0c0c] p-3">
                        <div className="text-xs text-gray-400">Nota geral</div>
                        <div className="text-lg font-semibold text-green-400">
                          {notaAssistida || 0}
                        </div>
                      </div>
                    </div>
                  </CompactBlock>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}