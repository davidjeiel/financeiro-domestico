import { AlertCircle, CheckCircle2, CircleDashed, Clock, Loader2, PieChart } from "lucide-react";

export type PaymentStatus = "paid" | "pending" | "overdue" | "partial";

const LABELS: Record<"income" | "expense", Record<PaymentStatus, string>> = {
  income: { paid: "Recebido", pending: "A receber", overdue: "Atrasado", partial: "Recebido em parte" },
  expense: { paid: "Pago", pending: "Pendente", overdue: "Atrasado", partial: "Pago em parte" },
};

const STYLES: Record<PaymentStatus, string> = {
  paid: "text-green-500 bg-green-500/10 hover:bg-green-500/20",
  pending: "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20",
  overdue: "text-red-500 bg-red-500/10 hover:bg-red-500/20",
  partial: "text-sky-500 bg-sky-500/10 hover:bg-sky-500/20",
};

const ICONS = { paid: CheckCircle2, pending: Clock, overdue: AlertCircle, partial: PieChart };

/** Situação de um lançamento: pago, ou pendente/atrasado pela data de vencimento. */
export function paymentStatusOf(isPaid: boolean, dueDate: Date | string | null | undefined, today = new Date()): PaymentStatus {
  if (isPaid) return "paid";
  if (!dueDate) return "pending";
  const due = new Date(dueDate);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return due < startOfToday ? "overdue" : "pending";
}

interface Props {
  status: PaymentStatus;
  kind?: "income" | "expense";
  /** Sem onToggle, é só indicativo (ex.: compra paga pela fatura). */
  onToggle?: () => void;
  loading?: boolean;
  /** Texto extra no tooltip (ex.: "pago na fatura", valor que falta). */
  hint?: string;
  /** Mostra o rótulo ao lado do ícone. */
  showLabel?: boolean;
}

export function PaymentStatusIcon({ status, kind = "expense", onToggle, loading, hint, showLabel }: Props) {
  const label = LABELS[kind][status];
  const Icon = loading ? Loader2 : ICONS[status];
  const action = onToggle
    ? status === "paid"
      ? kind === "income" ? " — clique para marcar como a receber" : " — clique para marcar como pendente"
      : kind === "income" ? " — clique para marcar como recebido" : " — clique para marcar como pago"
    : "";
  const title = `${label}${hint ? ` · ${hint}` : ""}${action}`;
  const content = (
    <>
      <Icon className={`w-5 h-5 shrink-0 ${loading ? "animate-spin" : ""}`} aria-hidden />
      {showLabel && <span className="text-xs font-medium whitespace-nowrap">{label}</span>}
    </>
  );
  const base = `inline-flex items-center gap-1.5 rounded-full p-1 ${showLabel ? "pr-2.5" : ""} transition-colors ${STYLES[status]}`;

  if (!onToggle) {
    return (
      <span className={`${base} cursor-default`} title={title} aria-label={title} role="img">
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`${base} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      title={title}
      aria-label={title}
      aria-pressed={status === "paid"}
      disabled={loading}
      onClick={onToggle}
    >
      {content}
    </button>
  );
}

/** Ícone neutro para quando não há situação (ex.: compra sem fatura). */
export function PaymentStatusUnknown({ title }: { title: string }) {
  return (
    <span className="inline-flex rounded-full p-1 text-muted-foreground" title={title} aria-label={title} role="img">
      <CircleDashed className="w-5 h-5" aria-hidden />
    </span>
  );
}
