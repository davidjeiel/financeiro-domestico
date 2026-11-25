import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Repeat, Shuffle, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/formatting";
import { buildTransactionsUrl } from "@/lib/transactionFilters";

/**
 * Cores das duas séries (categórica, slots 1 e 2 da paleta validada):
 * azul = fixas, laranja = variáveis — com passos próprios para o tema escuro.
 */
const SERIES = {
  light: { fixed: "#257de0", variable: "#f47230" },
  dark: { fixed: "#338ced", variable: "#e76624" },
};

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** Comparativo de despesas fixas (recorrentes) × variáveis. */
export function FixedVsVariableSection({ year, month, name }: { year: number; month: number; name: string }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const colors = SERIES[useIsDark() ? "dark" : "light"];

  const { data, isLoading } = trpc.report.fixedVsVariable.useQuery({ year, month, months: 6 });
  const { data: suggestions = [] } = trpc.report.recurringSuggestions.useQuery();
  const setRecurrence = trpc.transaction.setRecurrence.useMutation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set(suggestions.map(s => s.key))), [suggestions]);

  const open = (natureza: "fixa" | "variavel", categoria?: string) =>
    navigate(buildTransactionsUrl({ natureza, categoria, visao: "competency" }));

  const chartData = useMemo(
    () => (data?.months ?? []).map(m => ({ ...m, total: m.fixed + m.variable })),
    [data]
  );

  const markSuggestions = async () => {
    const chosen = suggestions.filter(s => selected.has(s.key));
    try {
      // Cada série vira um grupo próprio.
      for (const s of chosen) await setRecurrence.mutateAsync({ ids: s.ids, frequency: "monthly" });
      await Promise.all([utils.report.invalidate(), utils.transaction.invalidate()]);
      toast.success(`${chosen.length} ${chosen.length === 1 ? "série marcada" : "séries marcadas"} como fixas.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível marcar");
    }
  };

  if (isLoading || !data) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Calculando despesas fixas e variáveis…
        </p>
      </Card>
    );
  }

  const { current, byCategory, fixedItems } = data;
  const total = current.fixed + current.variable;

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Despesas fixas × variáveis</h3>
        <p className="text-sm text-muted-foreground">
          {name} · fixas são os lançamentos recorrentes; inclui despesas e compras no cartão.
        </p>
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="w-4 h-4 text-primary" />
            {suggestions.length === 1
              ? "1 despesa se repete todo mês mas não está marcada como fixa"
              : `${suggestions.length} despesas se repetem todo mês mas não estão marcadas como fixas`}
          </p>
          <p className="text-xs text-muted-foreground">
            Lançamentos recorrentes criados antes desta versão não guardavam a marca. Confira e marque os que são fixos:
          </p>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {suggestions.map(s => (
              <li key={s.key}>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(s.key)}
                    onChange={e =>
                      setSelected(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(s.key);
                        else next.delete(s.key);
                        return next;
                      })
                    }
                  />
                  <span className="flex-1 truncate">
                    {s.description} <span className="text-muted-foreground">· {s.category}</span>
                  </span>
                  <span className="whitespace-nowrap tabular-nums">{formatCurrency(s.amount)}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">em {s.months} meses</span>
                </label>
              </li>
            ))}
          </ul>
          <Button size="sm" onClick={markSuggestions} disabled={selected.size === 0 || setRecurrence.isPending}>
            {setRecurrence.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Marcar {selected.size} como fixas
          </Button>
        </div>
      )}

      {/* Números do mês */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => open("fixa")}
          className="text-left rounded-lg border border-border p-4 hover:bg-muted/50 transition"
          title="Ver despesas fixas"
        >
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: colors.fixed }} />
            <Repeat className="w-3.5 h-3.5" /> Fixas
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{formatCurrency(current.fixed)}</p>
          <p className="text-xs text-muted-foreground">{pct(current.fixed, total)}% das despesas</p>
        </button>
        <button
          type="button"
          onClick={() => open("variavel")}
          className="text-left rounded-lg border border-border p-4 hover:bg-muted/50 transition"
          title="Ver despesas variáveis"
        >
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: colors.variable }} />
            <Shuffle className="w-3.5 h-3.5" /> Variáveis
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{formatCurrency(current.variable)}</p>
          <p className="text-xs text-muted-foreground">{pct(current.variable, total)}% das despesas</p>
        </button>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Fixas sobre a receita</p>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
            {current.income > 0 ? `${pct(current.fixed, current.income)}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {current.income > 0
              ? `de ${formatCurrency(current.income)} recebidos no mês já estão comprometidos`
              : "sem receitas lançadas no mês"}
          </p>
        </div>
      </div>

      {/* Evolução */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-2">Últimos 6 meses</h4>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              width={64}
              tickFormatter={v => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(v))}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof chartData)[number];
                return (
                  <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md space-y-1">
                    <p className="font-medium text-foreground">{label}</p>
                    <p className="flex items-center gap-2 text-foreground">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors.fixed }} />
                      Fixas <span className="ml-auto tabular-nums">{formatCurrency(row.fixed)}</span>
                    </p>
                    <p className="flex items-center gap-2 text-foreground">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors.variable }} />
                      Variáveis <span className="ml-auto tabular-nums">{formatCurrency(row.variable)}</span>
                    </p>
                    <p className="flex justify-between gap-4 border-t border-border pt-1 text-muted-foreground">
                      Total <span className="tabular-nums">{formatCurrency(row.total)}</span>
                    </p>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              iconType="square"
              formatter={value => <span className="text-xs text-foreground">{value}</span>}
            />
            <Bar dataKey="fixed" name="Fixas" stackId="d" fill={colors.fixed} stroke="var(--card)" strokeWidth={2} maxBarSize={48} />
            <Bar dataKey="variable" name="Variáveis" stackId="d" fill={colors.variable} stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Por categoria (também é a visão em tabela do gráfico) */}
      {byCategory.length > 0 && (
        <div className="overflow-x-auto">
          <h4 className="text-sm font-medium text-foreground mb-2">Por categoria em {name}</h4>
          <table className="w-full text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left py-2 px-3 font-medium">Categoria</th>
                <th className="text-right py-2 px-3 font-medium">Fixas</th>
                <th className="text-right py-2 px-3 font-medium">Variáveis</th>
                <th className="text-right py-2 px-3 font-medium">Total</th>
                <th className="text-left py-2 px-3 font-medium w-40">Composição</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map(row => {
                const rowTotal = row.fixed + row.variable;
                return (
                  <tr key={row.category} className="border-b border-border">
                    <td className="py-2 px-3 text-foreground">{row.category}</td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {row.fixed > 0 ? (
                        <button type="button" className="hover:underline" onClick={() => open("fixa", row.category)}>
                          {formatCurrency(row.fixed)}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {row.variable > 0 ? (
                        <button type="button" className="hover:underline" onClick={() => open("variavel", row.category)}>
                          {formatCurrency(row.variable)}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium">{formatCurrency(rowTotal)}</td>
                    <td className="py-2 px-3">
                      <div
                        className="flex h-2 w-full overflow-hidden rounded-full bg-muted gap-[2px]"
                        title={`${pct(row.fixed, rowTotal)}% fixa`}
                      >
                        {row.fixed > 0 && <div style={{ width: `${pct(row.fixed, rowTotal)}%`, backgroundColor: colors.fixed }} />}
                        {row.variable > 0 && <div className="flex-1" style={{ backgroundColor: colors.variable }} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lista das fixas do mês */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-2">Despesas fixas em {name}</h4>
        {fixedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma despesa fixa neste mês. Crie lançamentos como <strong>Recorrente</strong> ou marque-os como fixos na edição.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {fixedItems.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">
                  {item.description}
                  <span className="text-muted-foreground"> · {item.category}{item.type === "credit_card" ? " · cartão" : ""}</span>
                </span>
                <span className="tabular-nums whitespace-nowrap">{formatCurrency(item.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
