import { useMemo } from "react";
import { addMonths, format, getDaysInMonth, isSameDay, isSameMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/formatting";
import { dateKey, formatCompact, type DayTotals } from "@/lib/periodTotals";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export type DayTransaction = {
  id: number;
  type: string;
  amount: string;
  description?: string | null;
  category: string;
};

/**
 * Calendário do mês com o total de entradas e saídas de cada dia. Os valores
 * se adaptam à largura: completos quando cabem, abreviados ("81,4 mil") em
 * telas estreitas. Tocar em um dia mostra os lançamentos dele logo abaixo.
 */
export function TransactionsCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  byDay,
  dayTransactions,
  today,
  loading,
  className = "",
}: {
  month: Date;
  onMonthChange: (month: Date) => void;
  selected: Date;
  onSelect: (day: Date) => void;
  byDay: Map<string, DayTotals>;
  /** Lançamentos do dia selecionado. */
  dayTransactions: DayTransaction[];
  today: Date;
  loading?: boolean;
  className?: string;
}) {
  const first = startOfMonth(month);
  const cells = useMemo(() => {
    const blanks: null[] = Array(first.getDay()).fill(null);
    const days = Array.from(
      { length: getDaysInMonth(first) },
      (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1)
    );
    return [...blanks, ...days];
  }, [first.getTime()]);

  const monthTitle = format(first, "MMMM 'de' yyyy", { locale: ptBR });
  const selectedTotals = byDay.get(dateKey(selected));
  const showingCurrentMonth = isSameMonth(first, today);

  return (
    <section className={`glass flex min-w-0 flex-col rounded-2xl p-3 sm:p-5 ${className}`} aria-label="Calendário de transações">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
            <CalendarDays className="size-4" />
          </span>
          <h2 className="truncate [font-family:inherit] text-base font-semibold tracking-normal text-foreground sm:text-lg">
            Calendário de Transações
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {!showingCurrentMonth && (
            <button
              type="button"
              onClick={() => {
                onMonthChange(startOfMonth(today));
                onSelect(today);
              }}
              className="mr-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-white/5"
            >
              Hoje
            </button>
          )}
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(first, -1))}
            className="grid size-8 place-items-center rounded-lg hover:bg-white/5"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[8.5rem] text-center text-sm font-medium text-foreground tabular-nums first-letter:uppercase">
            {monthTitle}
          </span>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(first, 1))}
            className="grid size-8 place-items-center rounded-lg hover:bg-white/5"
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </header>

      <div className="@container mt-3 sm:mt-4">
        <div className="grid grid-cols-7 border-b border-white/[0.07] pb-2 text-center text-[11px] font-semibold text-muted-foreground sm:text-xs">
          {WEEKDAYS.map(d => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div
          role="grid"
          aria-busy={loading}
          className={`mt-2 grid grid-cols-7 gap-0.5 @md:gap-1 ${loading ? "animate-pulse" : ""}`}
        >
          {cells.map((day, i) => {
            if (!day) return <span key={`b${i}`} aria-hidden="true" />;
            const totals = byDay.get(dateKey(day));
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selected);
            const hasData = !!totals && totals.count > 0;
            return (
              <button
                key={day.getDate()}
                type="button"
                role="gridcell"
                aria-selected={isSelected}
                aria-label={dayLabel(day, totals)}
                onClick={() => onSelect(day)}
                className={`relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-start rounded-lg px-0.5 py-1.5 transition-colors @md:min-h-[3.75rem] @xl:min-h-[4.25rem] ${
                  isToday
                    ? "bg-primary/15 ring-1 ring-primary/40"
                    : isSelected
                      ? "bg-white/[0.07] ring-1 ring-white/20"
                      : "hover:bg-white/[0.05]"
                }`}
              >
                <span
                  className={`text-xs leading-none tabular-nums @md:text-sm ${
                    isToday
                      ? "font-bold text-primary"
                      : hasData
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {day.getDate()}
                </span>
                {hasData && (
                  <span className="mt-1 flex w-full flex-col items-center gap-px text-[10px] leading-tight tabular-nums @md:text-[11px] @3xl:text-xs">
                    {totals.income > 0 && <Value value={totals.income} className="text-emerald-400" />}
                    {totals.expense > 0 && <Value value={totals.expense} className="text-rose-400" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dia selecionado */}
      <div className="glass-inset mt-3 rounded-xl p-3 sm:mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-foreground first-letter:uppercase">
            {format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <div className="flex flex-wrap gap-x-3 text-xs tabular-nums">
            <span className="text-emerald-400">↑ {formatCurrency(selectedTotals?.income ?? 0)}</span>
            <span className="text-rose-400">↓ {formatCurrency(selectedTotals?.expense ?? 0)}</span>
          </div>
        </div>
        {dayTransactions.length > 0 ? (
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto overscroll-contain pr-1">
            {dayTransactions.map(t => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">{t.description || t.category}</span>
                <span className={`shrink-0 tabular-nums ${t.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                  {t.type === "income" ? "+" : "−"}
                  {formatCurrency(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Nenhum lançamento neste dia.</p>
        )}
        <Link href="/calendar" className="mt-2 inline-block text-xs text-primary hover:underline">
          Abrir calendário completo
        </Link>
      </div>
    </section>
  );
}

/** Valor completo quando há espaço; abreviado em calendários estreitos. */
function Value({ value, className }: { value: number; className: string }) {
  return (
    <span className={`block max-w-full truncate ${className}`}>
      <span className="@md:hidden">{formatCompact(value, 0)}</span>
      <span className="hidden @md:inline @xl:hidden">{formatCompact(value, 1)}</span>
      <span className="hidden @xl:inline">{formatCurrency(value)}</span>
    </span>
  );
}

function dayLabel(day: Date, totals: DayTotals | undefined) {
  const base = format(day, "d 'de' MMMM", { locale: ptBR });
  if (!totals || totals.count === 0) return `${base}: sem lançamentos`;
  return `${base}: entradas ${formatCurrency(totals.income)}, saídas ${formatCurrency(totals.expense)}`;
}
