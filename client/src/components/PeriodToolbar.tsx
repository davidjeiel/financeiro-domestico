import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "@/lib/transactionView";

const MODES: [ViewMode, string, string][] = [
  ["competency", "Competência", "Pela competência (cartões entram no mês da fatura)"],
  ["monthly", "Mensal", "Pelo mês do calendário da data de cada lançamento"],
];

/** Competência/Mensal + navegação entre meses (Relatórios e Todas as áreas). */
export function PeriodToolbar({
  viewMode,
  onViewModeChange,
  title,
  subtitle,
  onPrev,
  onNext,
  onCurrent,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  title: string;
  subtitle?: string | null;
  onPrev: () => void;
  onNext: () => void;
  /** Só quando não está no mês atual. */
  onCurrent?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Exibir por"
        className="inline-flex rounded-md border border-border p-0.5 bg-muted/40"
      >
        {MODES.map(([mode, label, hint]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={viewMode === mode}
            title={hint}
            onClick={() => onViewModeChange(mode)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              viewMode === mode
                ? "bg-background shadow-sm font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <Button variant="outline" size="icon" onClick={onPrev} title="Período anterior">
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="min-w-[160px] text-center select-none leading-tight">
        <span className="block text-base font-semibold">{title}</span>
        {subtitle && <span className="block text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      <Button variant="outline" size="icon" onClick={onNext} title="Próximo período">
        <ChevronRight className="w-4 h-4" />
      </Button>
      {onCurrent && (
        <Button variant="outline" size="sm" onClick={onCurrent} title="Ir para o período atual">
          <CalendarDays className="w-4 h-4 mr-1" />
          Mês Atual
        </Button>
      )}
    </div>
  );
}
