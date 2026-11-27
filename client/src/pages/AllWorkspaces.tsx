import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ExternalLink, Layers, Loader2, Search, User, Users } from "lucide-react";
import { toast } from "sonner";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PeriodToolbar } from "@/components/PeriodToolbar";
import { PaymentStatusIcon, paymentStatusOf } from "@/components/PaymentStatusIcon";
import { useSwitchWorkspace } from "@/components/workspace/useWorkspaces";
import { usePeriodNavigation } from "@/hooks/usePeriodNavigation";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/formatting";
import { matchesDescription } from "@/lib/filterCriteria";
import { CARD_ROW_CLASS, cardRowStyle } from "@/lib/cardTint";

/** Cor de cada área (marcador na lista). */
const AREA_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EC4899", "#06B6D4", "#8B5CF6", "#EF4444", "#84CC16"];
const TYPE_LABELS = { income: "Receita", expense: "Despesa", credit_card: "Cartão" } as const;
type TxType = keyof typeof TYPE_LABELS;

/**
 * Movimentações de todas as áreas de trabalho num só lugar (só leitura). Para
 * editar, "Abrir" troca para a área e vai para Lançamentos.
 */
export default function AllWorkspaces() {
  const [, navigate] = useLocation();
  const period = usePeriodNavigation("allWorkspacesViewMode");
  const { switchTo, isSwitching } = useSwitchWorkspace();
  const { data, isLoading, isFetching, error } = trpc.workspace.allTransactions.useQuery(
    { year: period.year ?? 0, month: period.month ?? 1, mode: period.viewMode },
    { enabled: period.year !== null, staleTime: 60_000, placeholderData: prev => prev }
  );

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TxType | "all">("all");

  const areas = data?.workspaces ?? [];
  const colorOf = useMemo(
    () => new Map(areas.map((w, i) => [w.id, AREA_COLORS[i % AREA_COLORS.length]])),
    [areas]
  );
  const nameOf = new Map(areas.map(w => [w.id, w.name]));

  const rows = useMemo(
    () =>
      areas
        .filter(w => !hidden.has(w.id))
        .flatMap(w => w.rows)
        .filter(r => (type === "all" || r.type === type) && matchesDescription(r.description, query))
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()),
    [areas, hidden, type, query]
  );

  const totals = rows.reduce(
    (acc, r) => {
      if (r.type === "income") acc.income += r.amount;
      else if (r.type === "expense") acc.expense += r.amount;
      else acc.creditCard += r.amount;
      return acc;
    },
    { income: 0, expense: 0, creditCard: 0 }
  );
  const balance = totals.income - totals.expense - totals.creditCard;

  const toggleArea = (id: string) =>
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openArea = async (id: string, isActive: boolean) => {
    try {
      if (!isActive) await switchTo(id);
      navigate("/lancamentos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir a área");
    }
  };

  const statusOf = (r: (typeof rows)[number]) =>
    r.invoiceStatus
      ? r.invoiceStatus === "paid"
        ? "paid"
        : r.invoiceStatus === "partial"
          ? "partial"
          : paymentStatusOf(false, r.dueDate)
      : paymentStatusOf(r.isPaid, r.type === "expense" ? r.dueDate : null);

  return (
    <DashboardLayoutCustom title="Todas as áreas">
      <div className="space-y-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PeriodToolbar
            viewMode={period.viewMode}
            onViewModeChange={period.setViewMode}
            title={period.title}
            subtitle={
              period.viewMode === "competency"
                ? "competência de cada área"
                : "mês do calendário"
            }
            onPrev={period.goPrev}
            onNext={period.goNext}
            onCurrent={period.goCurrent}
          />
          {isFetching && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Lendo as áreas…
            </span>
          )}
        </div>

        {/* Totais (das áreas e filtros visíveis) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["Receitas", totals.income, "text-green-500"],
            ["Despesas", totals.expense, "text-red-500"],
            ["Cartão", totals.creditCard, "text-sky-500"],
            ["Saldo", balance, balance >= 0 ? "text-green-500" : "text-red-500"],
          ].map(([label, value, color]) => (
            <Card key={label as string} className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{formatCurrency(value as number)}</p>
            </Card>
          ))}
        </div>

        {/* Áreas: liga/desliga, totais e abrir */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Áreas de trabalho</h2>
            <span className="text-xs text-muted-foreground">clique para mostrar ou esconder</span>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : error ? (
            <p className="text-sm text-red-500">{error.message}</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {areas.map(w => {
                const off = hidden.has(w.id);
                const color = colorOf.get(w.id);
                return (
                  <div
                    key={w.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-opacity ${
                      off ? "opacity-50 border-border" : "border-border bg-muted/30"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleArea(w.id)}
                      aria-pressed={!off}
                      className="flex flex-1 items-start gap-2 text-left min-w-0"
                      title={off ? "Mostrar esta área" : "Esconder esta área"}
                    >
                      <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium">
                          {w.kind === "shared" ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                          <span className="truncate">{w.name}</span>
                          {w.isActive && <span className="text-[10px] uppercase text-primary">ativa</span>}
                        </span>
                        {w.error ? (
                          <span className="flex items-start gap-1 text-xs text-amber-500">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w.error}
                          </span>
                        ) : w.totals ? (
                          <span className="block text-xs text-muted-foreground">
                            {w.rows.length} {w.rows.length === 1 ? "lançamento" : "lançamentos"} · saldo{" "}
                            <span className={w.totals.balance >= 0 ? "text-green-500" : "text-red-500"}>
                              {formatCurrency(w.totals.balance)}
                            </span>
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSwitching || !!w.error}
                      onClick={() => openArea(w.id, w.isActive)}
                      title="Abrir esta área em Lançamentos"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Lista consolidada */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por descrição…"
                className="pl-8 h-9"
              />
            </div>
            <div role="radiogroup" aria-label="Tipo" className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
              {(["all", "income", "expense", "credit_card"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => setType(t)}
                  className={`px-3 py-1 text-sm rounded ${
                    type === t ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "all" ? "Todos" : TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {isLoading ? "Carregando…" : "Nenhuma movimentação neste período."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Área</th>
                    <th className="py-2 px-3 font-semibold">Data</th>
                    <th className="py-2 px-3 font-semibold">Descrição</th>
                    <th className="py-2 px-3 font-semibold">Categoria</th>
                    <th className="py-2 px-3 font-semibold">Tipo</th>
                    <th className="py-2 px-3 font-semibold text-right">Valor</th>
                    <th className="py-2 px-3 font-semibold">Responsável</th>
                    <th className="py-2 px-3 font-semibold text-center">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr
                      key={r.key}
                      className={`border-b border-border ${r.card ? CARD_ROW_CLASS : "hover:bg-muted/50"}`}
                      style={r.card ? cardRowStyle(r.card.color, "purchase") : undefined}
                    >
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf.get(r.workspaceId) }} />
                          {nameOf.get(r.workspaceId)}
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {new Date(r.transactionDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 px-3">
                        {r.description}
                        {r.recurring && (
                          <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
                            fixa
                          </span>
                        )}
                        {r.card && <span className="ml-2 text-xs text-muted-foreground">· {r.card.name}</span>}
                      </td>
                      <td className="py-2 px-3">{r.category}</td>
                      <td className="py-2 px-3">{TYPE_LABELS[r.type as TxType]}</td>
                      <td
                        className={`py-2 px-3 text-right font-semibold whitespace-nowrap ${
                          r.type === "income" ? "text-green-500" : "text-red-500"
                        } ${r.isEstimated ? "italic opacity-80" : ""}`}
                        title={r.isEstimated ? "Valor estimado pela recorrência" : undefined}
                      >
                        {r.isEstimated && "≈ "}
                        {r.type === "income" ? "+" : "-"}
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{r.responsible ?? "—"}</td>
                      <td className="py-2 px-3 text-center">
                        <PaymentStatusIcon
                          status={statusOf(r)}
                          kind={r.type === "income" ? "income" : "expense"}
                          hint={r.card ? "situação da fatura" : "para alterar, abra a área"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayoutCustom>
  );
}
