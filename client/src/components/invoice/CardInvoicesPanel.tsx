import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/formatting";
import { InvoicePaymentDialog, type InvoiceToPay } from "./InvoicePaymentDialog";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR");

/**
 * Faturas do cartão selecionado, filtráveis por ano e mês de vencimento.
 * Cada fatura abre a lista de compras e pode ser paga (total ou parcial).
 */
export function CardInvoicesPanel({ card }: { card: { id: number; name: string; color: string | null } }) {
  const utils = trpc.useUtils();
  const { data: invoices, isLoading } = trpc.invoice.byCard.useQuery({ creditCardId: card.id });
  const resetPayment = trpc.invoice.pay.useMutation();

  const now = new Date();
  const years = useMemo(() => {
    const set = new Set((invoices ?? []).map(i => new Date(i.dueDate).getFullYear()));
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]);

  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const [month, setMonth] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [paying, setPaying] = useState<InvoiceToPay | null>(null);

  // Ao trocar de cartão, volta para o ano atual.
  useEffect(() => {
    setYear(String(now.getFullYear()));
    setMonth("all");
    setExpanded(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const filtered = (invoices ?? []).filter(inv => {
    const due = new Date(inv.dueDate);
    if (year !== "all" && due.getFullYear() !== Number(year)) return false;
    if (month !== "all" && due.getMonth() + 1 !== Number(month)) return false;
    return true;
  });
  const totals = filtered.reduce(
    (acc, inv) => ({ total: acc.total + inv.total, paid: acc.paid + Math.min(inv.paid, inv.total) }),
    { total: 0, paid: 0 }
  );

  const toggle = (id: number) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const undoPayments = async (invoiceId: number) => {
    if (!window.confirm("Zerar os pagamentos registrados nesta fatura?")) return;
    try {
      await resetPayment.mutateAsync({ invoiceId, paidAmount: 0 });
      await utils.invoice.invalidate();
      toast.success("Pagamentos da fatura zerados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível desfazer");
    }
  };

  const selectClass = "rounded-md border border-border bg-background px-2 py-1.5 text-sm";

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: card.color || "#3B82F6" }} />
            Faturas do {card.name}
          </h2>
          <p className="text-sm text-muted-foreground">Pelo mês de vencimento.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="invoice-year">Ano</label>
          <select id="invoice-year" className={selectClass} value={year} onChange={e => setYear(e.target.value)}>
            <option value="all">Todos</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <label className="text-sm text-muted-foreground ml-2" htmlFor="invoice-month">Mês</label>
          <select id="invoice-month" className={selectClass} value={month} onChange={e => setMonth(e.target.value)}>
            <option value="all">Todos</option>
            {MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando faturas…
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhuma fatura {month !== "all" ? `em ${MONTHS[Number(month) - 1].toLowerCase()} ` : ""}
          {year !== "all" ? `de ${year}` : ""} para este cartão.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-md bg-muted p-2">
              <p className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "fatura" : "faturas"}</p>
              <p className="font-semibold tabular-nums">{formatCurrency(totals.total)}</p>
            </div>
            <div className="rounded-md bg-green-500/10 p-2">
              <p className="text-xs text-muted-foreground">Pago</p>
              <p className="font-semibold tabular-nums text-green-600">{formatCurrency(totals.paid)}</p>
            </div>
            <div className="rounded-md bg-amber-500/10 p-2">
              <p className="text-xs text-muted-foreground">Em aberto</p>
              <p className="font-semibold tabular-nums text-amber-600">{formatCurrency(Math.max(totals.total - totals.paid, 0))}</p>
            </div>
          </div>

          <ul className="divide-y divide-border rounded-lg border border-border">
            {filtered.map(inv => {
              const open = Math.max(inv.total - inv.paid, 0);
              const isOpen = expanded.has(inv.id);
              const status =
                inv.paid <= 0
                  ? { label: "Aberta", cls: "bg-muted text-muted-foreground" }
                  : open < 0.005
                    ? { label: "Paga", cls: "bg-green-500/10 text-green-600" }
                    : { label: `Parcial · falta ${formatCurrency(open)}`, cls: "bg-amber-500/10 text-amber-600" };
              const due = new Date(inv.dueDate);
              return (
                <li key={inv.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggle(inv.id)}
                    onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(inv.id))}
                    className="flex flex-wrap items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50"
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                    <div className="min-w-[9rem]">
                      <p className="font-medium text-foreground">
                        {MONTHS[due.getMonth()]} de {due.getFullYear()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        vence {fmtDate(inv.dueDate)} · fecha {fmtDate(inv.closingDate)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {inv.items.length} {inv.items.length === 1 ? "compra" : "compras"}
                    </span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                    <span className="font-semibold tabular-nums w-28 text-right">{formatCurrency(inv.total)}</span>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      {open >= 0.005 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            setPaying({
                              creditCardId: card.id,
                              competencyId: inv.competencyId,
                              cardName: card.name,
                              dueDate: due,
                              total: inv.total,
                              paid: inv.paid,
                            })
                          }
                        >
                          Pagar
                        </Button>
                      )}
                      {inv.paid > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          title="Zerar pagamentos desta fatura"
                          onClick={() => undoPayments(inv.id)}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <ul className="bg-muted/30 border-t border-border text-sm">
                      {inv.items.map(item => (
                        <li key={item.id} className="flex items-center gap-3 px-3 py-2 pl-10">
                          <span className="text-muted-foreground w-20 shrink-0">{fmtDate(item.transactionDate)}</span>
                          <span className="flex-1 truncate">
                            {item.description}
                            {(item.installments ?? 1) > 1 && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                {item.currentInstallment}/{item.installments}
                              </span>
                            )}
                            <span className="text-muted-foreground"> · {item.category}</span>
                          </span>
                          <span className="tabular-nums">{formatCurrency(item.amount)}</span>
                        </li>
                      ))}
                      {inv.items.length === 0 && (
                        <li className="px-3 py-2 pl-10 text-muted-foreground">Sem compras nesta fatura.</li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <InvoicePaymentDialog invoice={paying} onClose={() => setPaying(null)} />
    </Card>
  );
}
