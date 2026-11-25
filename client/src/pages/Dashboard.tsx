import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatting";
import { calculateInvoiceDates } from "@/data/competencyLogic";
import { monthRange, readViewMode, saveViewMode, type ViewMode } from "@/lib/transactionView";
import { buildTransactionsUrl, type LinkFilters } from "@/lib/transactionFilters";

type CardTotals = { total: number; paid: number; count: number; dueDate: Date | null };

export default function Dashboard() {
  const [, navigate] = useLocation();
  // Mesma visão da tela de lançamentos (a escolha é compartilhada), para os
  // valores daqui baterem com o que aparece ao clicar.
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);
  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    saveViewMode(mode);
  };

  const { data: currentCompetency, isLoading: competencyLoading } =
    trpc.competency.current.useQuery();
  const range =
    viewMode === "monthly" && currentCompetency
      ? monthRange(currentCompetency.year, currentCompetency.month)
      : null;

  const { data: transactions, isLoading: transactionsLoading } =
    trpc.transaction.list.useQuery(
      {
        competencyId: currentCompetency?.id || 0,
        startDate: range?.start,
        endDate: range?.end,
      },
      { enabled: !!currentCompetency }
    );

  const { data: creditCards } = trpc.creditCard.list.useQuery();
  const { data: invoices } = trpc.invoice.listAll.useQuery();
  const { data: competencies } = trpc.competency.list.useQuery();

  const goTo = (filters: LinkFilters) => navigate(buildTransactionsUrl({ ...filters, visao: viewMode }));

  /**
   * Fatura de cada cartão = soma das compras listadas no período (as mesmas da
   * tela de lançamentos). O pago vem das faturas (o pagamento é feito nelas).
   */
  const cardTotals = useMemo(() => {
    const byCard = new Map<number, CardTotals>();
    const groups = new Map<string, { cardId: number; competencyId: number; sum: number }>();
    for (const t of transactions ?? []) {
      if (t.type !== "credit_card" || !t.creditCardId) continue;
      const key = `${t.creditCardId}-${t.competencyId}`;
      const g = groups.get(key) ?? { cardId: t.creditCardId, competencyId: t.competencyId, sum: 0 };
      g.sum += parseFloat(t.amount) || 0;
      groups.set(key, g);
      const c = byCard.get(t.creditCardId) ?? { total: 0, paid: 0, count: 0, dueDate: null };
      c.total += parseFloat(t.amount) || 0;
      c.count += 1;
      byCard.set(t.creditCardId, c);
    }
    groups.forEach(g => {
      const c = byCard.get(g.cardId)!;
      const invoice = invoices?.find(i => i.creditCardId === g.cardId && i.competencyId === g.competencyId);
      c.paid += Math.min(Number(invoice?.paidAmount ?? 0), g.sum);
      let due: Date | null = invoice ? new Date(invoice.dueDate) : null;
      if (!due) {
        const card = creditCards?.find(x => x.id === g.cardId);
        const comp = competencies?.find(x => x.id === g.competencyId);
        if (card && comp) due = calculateInvoiceDates(card, comp.year, comp.month).dueDate;
      }
      if (due && (!c.dueDate || due > c.dueDate)) c.dueDate = due;
    });
    return byCard;
  }, [transactions, invoices, creditCards, competencies]);

  const summary = useMemo(() => {
    let income = 0, expense = 0, creditCard = 0, incomePaid = 0, expensePaid = 0;
    for (const t of transactions ?? []) {
      const amount = parseFloat(t.amount) || 0;
      if (t.type === "income") {
        income += amount;
        if (t.isPaid) incomePaid += amount;
      } else if (t.type === "expense") {
        expense += amount;
        if (t.isPaid) expensePaid += amount;
      } else {
        creditCard += amount;
      }
    }
    const creditCardPaid = Array.from(cardTotals.values()).reduce((s, c) => s + c.paid, 0);
    return {
      income, expense, creditCard,
      balance: income - expense - creditCard,
      incomePaid, expensePaid, creditCardPaid,
    };
  }, [transactions, cardTotals]);

  const transactionsByCategory = useMemo(() => {
    const grouped: Record<string, { total: number; count: number }> = {};
    for (const t of transactions ?? []) {
      const g = (grouped[t.category] ??= { total: 0, count: 0 });
      g.total += parseFloat(t.amount) || 0;
      g.count += 1;
    }
    return grouped;
  }, [transactions]);

  if (competencyLoading) {
    return (
      <DashboardLayoutCustom>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayoutCustom>
    );
  }

  return (
    <DashboardLayoutCustom title={`Dashboard - ${currentCompetency?.name}`}>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Clique em um card para ver os lançamentos correspondentes.
          </p>
          <div role="radiogroup" aria-label="Período do resumo" className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
            {([
              ["competency", "Competência"],
              ["monthly", "Mensal"],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={viewMode === mode}
                onClick={() => changeViewMode(mode)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === mode ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <SummaryCard
            title="Receitas"
            amount={summary.income}
            paid={{ label: "Recebido", value: summary.incomePaid }}
            open={{ label: "A receber", value: summary.income - summary.incomePaid }}
            onOpen={situacao => goTo({ tipo: "income", situacao })}
          />
          <SummaryCard
            title="Despesas"
            amount={summary.expense}
            paid={{ label: "Pago", value: summary.expensePaid }}
            open={{ label: "Em aberto", value: summary.expense - summary.expensePaid }}
            onOpen={situacao => goTo({ tipo: "expense", situacao })}
          />
          <SummaryCard
            title="Cartão de Crédito"
            amount={summary.creditCard}
            paid={{ label: "Pago", value: summary.creditCardPaid }}
            open={{ label: "Em aberto", value: summary.creditCard - summary.creditCardPaid }}
            onOpen={situacao => goTo({ tipo: "credit_card", situacao })}
          />
          <SummaryCard title="Saldo" amount={summary.balance} onOpen={() => goTo({})} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Lançamentos Recentes</h2>
              <button type="button" onClick={() => goTo({})} className="text-sm text-primary hover:underline">
                Ver todos
              </button>
            </div>
            {transactionsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{t.description || t.category}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(t.transactionDate).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <p
                      className={`font-semibold ${
                        t.type === "income" ? "text-green-600" : t.type === "expense" ? "text-red-600" : "text-blue-600"
                      }`}
                    >
                      {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Nenhum lançamento neste período</p>
            )}
          </Card>

          {/* Credit Cards */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Cartões de Crédito</h2>
            {creditCards && creditCards.length > 0 ? (
              <div className="space-y-3">
                {creditCards.map(card => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => goTo({ cartao: card.id })}
                    className="w-full text-left p-4 rounded-lg border border-border hover:bg-muted/60 hover:shadow-sm transition"
                    style={{ borderLeftColor: card.color || "#3B82F6", borderLeftWidth: "4px" }}
                    title={`Ver lançamentos do cartão ${card.name}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{card.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Corte: dia {card.cutoffDay} | Vencimento: dia {card.dueDay}
                        </p>
                      </div>
                      <CardInvoiceSummary
                        totals={cardTotals.get(card.id)}
                        label={viewMode === "monthly" ? "Fatura do mês" : "Fatura da competência"}
                      />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Nenhum cartão cadastrado</p>
            )}
          </Card>
        </div>

        {/* Category Breakdown */}
        {Object.keys(transactionsByCategory).length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Distribuição por Categoria</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(transactionsByCategory).map(([category, { total, count }]) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => goTo({ categoria: category })}
                  className="text-left p-4 bg-muted rounded-lg hover:bg-muted/70 hover:shadow-sm transition"
                  title={`Ver lançamentos de ${category}`}
                >
                  <p className="text-sm font-medium text-foreground mb-2">{category}</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {count} lançamento{count !== 1 ? "s" : ""}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayoutCustom>
  );
}

/**
 * Card de resumo clicável: o card leva aos lançamentos do tipo; "pago" e
 * "em aberto" levam aos lançamentos daquela situação.
 */
function SummaryCard({
  title,
  amount,
  paid,
  open,
  onOpen,
}: {
  title: string;
  amount: number;
  paid?: { label: string; value: number };
  open?: { label: string; value: number };
  onOpen: (situacao?: "pago" | "aberto") => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen()}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="p-6 cursor-pointer transition hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={`Ver lançamentos: ${title}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground mb-2">{title}</p>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="text-3xl font-bold text-foreground">{formatCurrency(amount)}</p>
      {paid && open && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { ...paid, situacao: "pago" as const, cls: "bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20" },
            { ...open, situacao: "aberto" as const, cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20" },
          ].map(item => (
            <button
              key={item.situacao}
              type="button"
              onClick={e => {
                e.stopPropagation();
                onOpen(item.situacao);
              }}
              onKeyDown={e => e.stopPropagation()}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${item.cls}`}
              title={`Ver lançamentos: ${title} · ${item.label.toLowerCase()}`}
            >
              {item.label}: {formatCurrency(Math.max(item.value, 0))}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Fatura do cartão no período: soma das compras listadas e situação do pagamento. */
function CardInvoiceSummary({ totals, label }: { totals: CardTotals | undefined; label: string }) {
  if (!totals || totals.count === 0) {
    return (
      <div className="text-right">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{formatCurrency(0)}</p>
        <p className="text-xs text-muted-foreground">sem compras</p>
      </div>
    );
  }
  const open = Math.max(totals.total - totals.paid, 0);
  const status =
    totals.paid <= 0
      ? { label: "Aberta", className: "text-muted-foreground" }
      : open < 0.005
        ? { label: "Paga", className: "text-green-600" }
        : { label: `Falta ${formatCurrency(open)}`, className: "text-amber-600" };
  return (
    <div className="text-right">
      <p className="text-xs text-muted-foreground">
        {label}
        {totals.dueDate &&
          ` · vence ${totals.dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`}
      </p>
      <p className="text-sm font-semibold text-foreground">{formatCurrency(totals.total)}</p>
      <p className="text-xs">
        <span className={status.className}>{status.label}</span>
        <span className="text-muted-foreground">
          {" "}· {totals.count} {totals.count === 1 ? "compra" : "compras"}
        </span>
      </p>
    </div>
  );
}
