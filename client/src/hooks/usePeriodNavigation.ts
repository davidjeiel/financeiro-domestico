import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  competencyRangeLabel,
  monthRange,
  readViewMode,
  saveViewMode,
  shiftMonth,
  type ViewMode,
} from "@/lib/transactionView";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const monthTitle = (year: number, month: number) => `${MONTHS[month - 1]} de ${year}`;

/**
 * Mês navegável + visão Competência/Mensal (a escolha fica salva em
 * `storageKey`). Começa na competência atual.
 */
export function usePeriodNavigation(storageKey: string) {
  const { data: currentCompetency } = trpc.competency.current.useQuery();
  const [viewMode, setViewModeState] = useState<ViewMode>(() => readViewMode(storageKey));
  const [nav, setNav] = useState<{ year: number; month: number } | null>(null);

  useEffect(() => {
    if (currentCompetency && !nav) setNav({ year: currentCompetency.year, month: currentCompetency.month });
  }, [currentCompetency, nav]);

  const { data: navCompetency } = trpc.competency.getByYearMonth.useQuery(
    { year: nav?.year ?? 0, month: nav?.month ?? 0 },
    { enabled: !!nav }
  );
  const competency = navCompetency ?? (nav ? undefined : currentCompetency);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    saveViewMode(mode, storageKey);
  };
  const isCurrent = !!nav && nav.year === currentCompetency?.year && nav.month === currentCompetency?.month;

  return {
    viewMode,
    setViewMode,
    year: nav?.year ?? null,
    month: nav?.month ?? null,
    competency,
    /** Na visão mensal, o mês do calendário. */
    range: viewMode === "monthly" && nav ? monthRange(nav.year, nav.month) : null,
    title: nav ? monthTitle(nav.year, nav.month) : "...",
    subtitle:
      viewMode === "monthly"
        ? "mês do calendário"
        : competencyRangeLabel(competency) ?? "competência",
    goPrev: () => nav && setNav(shiftMonth(nav.year, nav.month, -1)),
    goNext: () => nav && setNav(shiftMonth(nav.year, nav.month, 1)),
    goCurrent:
      isCurrent || !currentCompetency
        ? undefined
        : () => setNav({ year: currentCompetency.year, month: currentCompetency.month }),
  };
}
