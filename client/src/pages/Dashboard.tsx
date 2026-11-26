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
import { startOfMonth } from "date-fns";
import { dailyTotals, dateKey, periodRanges, yearsFor } from "@/lib/periodTotals";
import { PeriodTotalsCards } from "@/components/dashboard/PeriodTotalsCards";
import { TransactionsCalendar } from "@/components/dashboard/TransactionsCalendar";

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

  // Totais por dia (calendário e cards de hoje/semana/mês/ano), pela data do
  // lançamento. Carrega o ano corrente, o vizinho se a semana virar o ano e o
  // ano exibido no calendário.
  const now = useMemo(() => new Date(), []);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(now));
  const [selectedDay, setSelectedDay] = useState(now);
  const years = useMemo(() => {
    const set = new Set(yearsFor(periodRanges(now)));
    set.add(calendarMonth.getFullYear());
    return Array.from(set).sort((a, b) => a - b);
  }, [now, calendarMonth]);
  const yearQueries = trpc.useQueries(t => years.map(year => t.calendar.eventsForYear({ year })));
  const yearsLoading = yearQueries.some(q => q.isLoading);
  const yearsVersion = yearQueries.map(q => q.dataUpdatedAt).join(",");
  const yearTransactions = useMemo(
    () => yearQueries.flatMap(q => q.data?.transactions ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yearsVersion, years.join(",")]
  );
  const byDay = useMemo(() => dailyTotals(yearTransactions), [yearTransactions]);
  const selectedDayTransactions = useMemo(() => {
    const key = dateKey(selectedDay);
    return yearTransactions
      .filter(t => dateKey(new Date(t.transactionDate)) === key)
      .sort((a, b) => (a.type === "income" ? -1 : 0) - (b.type === "income" ? -1 : 0));
  }, [yearTransactions, selectedDay]);

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
      <div className="space-y-5 sm:space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="hidden sm:block text-sm text-muted-foreground">
            Clique em um card para ver os lançamentos correspondentes.
          </p>
          <div role="radiogroup" aria-label="Período do resumo" className="glass inline-flex rounded-lg p-0.5 ml-auto">
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
                  viewMode === mode ? "bg-white/10 shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Resumo do período + calendário à direita */}
        <section className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-12">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-1 auto-rows-fr gap-3 sm:gap-4 xl:col-span-5">
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

          <TransactionsCalendar
            className="xl:col-span-7"
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selected={selectedDay}
            onSelect={setSelectedDay}
            byDay={byDay}
            dayTransactions={selectedDayTransactions}
            today={now}
            loading={yearsLoading}
          />
        </section>

        {/* Totais de hoje, da semana, do mês e do ano */}
        <PeriodTotalsCards byDay={byDay} now={now} loading={yearsLoading} />

        {/* Category Breakdown */}
        {Object.keys(transactionsByCategory).length > 0 && (
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4">Distribuição por Categoria</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              {Object.entries(transactionsByCategory).map(([category, { total, count }]) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => goTo({ categoria: category })}
                  className="glass-inset min-w-0 text-left p-3 sm:p-4 rounded-xl hover:bg-white/[0.06] transition"
                  title={`Ver lançamentos de ${category}`}
                >
                  <p className="truncate text-sm font-medium text-foreground mb-1 sm:mb-2">{category}</p>
                  <p className="text-lg sm:text-2xl font-bold text-primary tabular-nums">{formatCurrency(total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {count} lançamento{count !== 1 ? "s" : ""}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Recent Transactions */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">Lançamentos Recentes</h2>
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
                  <div key={t.id} className="glass-inset flex items-center justify-between gap-3 p-3 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-foreground">{t.description || t.category}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(t.transactionDate).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 font-semibold tabular-nums ${
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
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4">Cartões de Crédito</h2>
            {creditCards && creditCards.length > 0 ? (
              <div className="space-y-3">
                {creditCards.map(card => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => goTo({ cartao: card.id })}
                    className="glass-inset w-full text-left p-3 sm:p-4 rounded-xl hover:bg-white/[0.06] transition"
                    style={{ borderLeftColor: card.color || "#3B82F6", borderLeftWidth: "4px" }}
                    title={`Ver lançamentos do cartão ${card.name}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{card.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Corte: dia {card.cutoffDay} | Vencimento: dia {card.dueDay}
                        </p>
                      </div>
                      <CardInvoiceSummary
                        totals={cardTotals.get(card.id)}
                        label="Fatura do mês"
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
      className="@container min-w-0 gap-0 p-3.5 sm:p-5 cursor-pointer transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={`Ver lançamentos: ${title}`}
    >
      <div className="flex h-full flex-col @[24rem]:flex-row @[24rem]:items-center @[24rem]:gap-4">
      <div className="min-w-0 @[24rem]:flex-1">
      <div className="flex items-start justify-between">
        <p className="text-xs sm:text-sm text-muted-foreground mb-1.5 sm:mb-2">{title}</p>
        <ChevronRight className="w-4 h-4 text-muted-foreground @[24rem]:hidden" />
      </div>
      <p className={`font-bold tabular-nums tracking-tight text-lg @[11rem]:text-xl @[14rem]:text-2xl @[18rem]:text-3xl ${amount < 0 ? "text-rose-400" : "text-foreground"}`}>
        {formatCurrency(amount)}
      </p>
      </div>
      {paid && open && (
        <div className="mt-auto pt-3 flex flex-wrap gap-1.5 sm:gap-2 @[24rem]:mt-0 @[24rem]:pt-0 @[24rem]:flex-col @[24rem]:items-end">
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
              className={`rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-medium tabular-nums transition ${item.cls}`}
              title={`Ver lançamentos: ${title} · ${item.label.toLowerCase()}`}
            >
              {item.label}: {formatCurrency(Math.max(item.value, 0))}
            </button>
          ))}
        </div>
      )}
      </div>
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
