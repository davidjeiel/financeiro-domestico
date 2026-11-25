import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck2, CalendarDays, CalendarRange, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatting";
import { periodRanges, sumRange, type DayTotals, type Period, type PeriodId } from "@/lib/periodTotals";

const META: Record<PeriodId, { title: string; icon: LucideIcon }> = {
  today: { title: "Hoje", icon: CalendarCheck2 },
  week: { title: "Esta semana", icon: CalendarRange },
  month: { title: "Este mês", icon: CalendarDays },
  year: { title: "Este ano", icon: Layers },
};

function periodLabel(p: Period) {
  const day = (d: Date) => format(d, "d 'de' MMMM", { locale: ptBR });
  switch (p.id) {
    case "today":
      return format(p.start, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    case "week":
    case "month":
      return `${day(p.start)} – ${day(p.end)}`;
    case "year":
      return String(p.start.getFullYear());
  }
}

/** Cards de receitas e despesas do dia, da semana, do mês e do ano. */
export function PeriodTotalsCards({
  byDay,
  now,
  loading,
  onSelect,
}: {
  byDay: Map<string, DayTotals>;
  now: Date;
  loading?: boolean;
  /** Clique no card (ex.: levar o calendário para o período). */
  onSelect?: (period: Period) => void;
}) {
  const periods = useMemo(() => periodRanges(now), [now]);

  return (
    <section aria-label="Totais por período" className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {periods.map(p => {
        const { title, icon: Icon } = META[p.id];
        const totals = sumRange(byDay, p.start, p.end);
        const Tag = onSelect ? "button" : "div";
        return (
          <Tag
            key={p.id}
            {...(onSelect ? { type: "button" as const, onClick: () => onSelect(p) } : {})}
            className="glass group @container relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl p-3.5 text-left transition hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
          >
            <FlowIllustration className="pointer-events-none absolute -right-3 top-6 -z-10 hidden h-24 w-28 text-primary/70 opacity-60 transition-opacity group-hover:opacity-90 @[13rem]:block" />

            <header className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
                <Icon className="size-4" />
              </span>
              <h3 className="truncate [font-family:inherit] text-sm font-semibold tracking-normal text-foreground sm:text-base">{title}</h3>
            </header>

            <dl className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
              <Amount label="Receita" value={totals.income} tone="income" loading={loading} />
              <Amount label="Despesa" value={totals.expense} tone="expense" loading={loading} />
            </dl>

            <footer className="mt-3 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-t border-white/[0.07] pt-2.5 text-[11px] text-muted-foreground sm:mt-4 sm:pt-3 sm:text-xs">
              <span className="first-letter:uppercase">{periodLabel(p)}</span>
              {!loading && (
                <span className="tabular-nums">
                  Saldo{" "}
                  <span className={totals.income - totals.expense >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {formatCurrency(totals.income - totals.expense)}
                  </span>
                </span>
              )}
            </footer>
          </Tag>
        );
      })}
    </section>
  );
}

function Amount({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
  loading?: boolean;
}) {
  const color = tone === "income" ? "text-emerald-400" : "text-rose-400";
  const dot = tone === "income" ? "bg-emerald-400" : "bg-rose-400";
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
        <span className={`size-1.5 rounded-full ${dot}`} />
        {label}
      </dt>
      <dd className={`mt-0.5 font-medium tabular-nums tracking-tight ${color} text-base @[12rem]:text-lg @[15rem]:text-2xl`}>
        {loading ? <Skeleton className="h-6 w-24 bg-white/10" /> : formatCurrency(value)}
      </dd>
    </div>
  );
}

/** Ilustração decorativa: documento com setas de entrada e saída. */
function FlowIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" fill="none" aria-hidden="true" className={className}>
      <circle cx="68" cy="50" r="40" fill="currentColor" opacity="0.06" />
      <rect x="44" y="16" width="44" height="58" rx="7" stroke="currentColor" strokeWidth="2" opacity="0.55" />
      <path d="M54 30h20M54 38h26M54 46h14M60 58h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <circle cx="38" cy="34" r="11" stroke="currentColor" strokeWidth="2" fill="var(--background)" fillOpacity="0.6" />
      <path d="M33 34h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="90" cy="66" r="11" stroke="currentColor" strokeWidth="2" fill="var(--background)" fillOpacity="0.6" />
      <path d="M95 66H85m4-4-4 4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="104" cy="16" r="2" fill="currentColor" opacity="0.4" />
      <circle cx="22" cy="70" r="1.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
