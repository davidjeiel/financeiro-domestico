import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/formatting";
import { Link2, Plus, Trash2 } from "lucide-react";

export type IncomeLink = { incomeId: number; amount: string };

const cents = (v: string | number | null | undefined) =>
  Math.round(Number(String(v ?? 0).replace(",", ".")) * 100) || 0;
const toAmount = (c: number) => (Math.max(c, 0) / 100).toFixed(2);

/**
 * Editor das receitas que pagam uma despesa. Controlado: o pai guarda os
 * vínculos e grava (na criação, junto com o lançamento; na edição, ao salvar).
 */
export function IncomeLinksEditor({
  expenseId,
  expenseAmount,
  value,
  onChange,
}: {
  /** Id da despesa em edição (os vínculos dela não contam como comprometidos). */
  expenseId?: number;
  expenseAmount: string | number | undefined;
  value: IncomeLink[];
  onChange: (links: IncomeLink[]) => void;
}) {
  const { data: options = [], isLoading } = trpc.allocation.incomeOptions.useQuery({ expenseId });

  const expenseCents = cents(expenseAmount);
  const linkedCents = value.reduce((sum, l) => sum + cents(l.amount), 0);
  const missingCents = expenseCents - linkedCents;

  // Disponível de cada receita, descontando o que já foi usado nas outras linhas deste editor.
  const availableFor = (incomeId: number, ignoreIndex?: number) => {
    const option = options.find(o => o.id === incomeId);
    if (!option) return 0;
    const usedHere = value.reduce(
      (sum, l, i) => (i !== ignoreIndex && l.incomeId === incomeId ? sum + cents(l.amount) : sum),
      0
    );
    return cents(option.available) - usedHere;
  };

  const addLink = () => {
    const free = options.find(o => !value.some(l => l.incomeId === o.id) && availableFor(o.id) > 0);
    if (!free) return;
    const amount = toAmount(Math.min(availableFor(free.id), Math.max(missingCents, 0)) || availableFor(free.id));
    onChange([...value, { incomeId: free.id, amount }]);
  };

  const update = (index: number, patch: Partial<IncomeLink>) =>
    onChange(value.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const optionLabel = (o: (typeof options)[number], index: number) => {
    const date = new Date(o.transactionDate).toLocaleDateString("pt-BR");
    const free = availableFor(o.id, index);
    return `${o.description} · ${date} · disponível ${formatCurrency(free / 100)}`;
  };

  if (!isLoading && options.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma receita cadastrada nesta área para vincular.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {value.map((link, index) => {
        const over = cents(link.amount) > availableFor(link.incomeId, index);
        return (
          <div key={index} className="flex items-center gap-2">
            <select
              aria-label="Receita"
              className="input-elegant flex-1 min-w-0"
              value={link.incomeId}
              onChange={e => update(index, { incomeId: Number(e.target.value) })}
            >
              {options.map(o => (
                <option key={o.id} value={o.id}>
                  {optionLabel(o, index)}
                </option>
              ))}
            </select>
            <input
              aria-label="Valor vinculado"
              type="number"
              step="0.01"
              min="0.01"
              className={`input-elegant w-28 ${over ? "border-red-500 text-red-600" : ""}`}
              value={link.amount}
              onChange={e => update(index, { amount: e.target.value })}
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="p-2 text-muted-foreground hover:text-red-600"
              title="Remover vínculo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={addLink}
          disabled={isLoading || !options.some(o => availableFor(o.id) > 0)}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-50 disabled:no-underline"
        >
          <Plus className="w-4 h-4" /> Vincular receita
        </button>
        {value.length > 0 && (
          <span className={`text-xs ${missingCents < 0 ? "text-red-600" : "text-muted-foreground"}`}>
            <Link2 className="inline w-3 h-3 mr-1" />
            {missingCents < 0
              ? `Vínculos passam ${formatCurrency(-missingCents / 100)} do valor da despesa`
              : `Coberto ${formatCurrency(linkedCents / 100)} de ${formatCurrency(expenseCents / 100)}` +
                (missingCents > 0 ? ` · faltam ${formatCurrency(missingCents / 100)}` : "")}
          </span>
        )}
      </div>
    </div>
  );
}

/** Para receitas: quais despesas ela paga, quanto está comprometido e quanto sobra. */
export function IncomeCommitments({ incomeId }: { incomeId: number }) {
  const { data } = trpc.allocation.forTransaction.useQuery({ transactionId: incomeId });
  if (!data || data.role !== "income") return null;
  const remaining = Number(data.remaining);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md bg-muted p-2">
          <p className="text-xs text-muted-foreground">Comprometido</p>
          <p className="font-semibold">{formatCurrency(data.linked)}</p>
        </div>
        <div className={`rounded-md p-2 ${remaining < 0 ? "bg-red-500/10" : "bg-green-500/10"}`}>
          <p className="text-xs text-muted-foreground">Sobra</p>
          <p className={`font-semibold ${remaining < 0 ? "text-red-600" : "text-green-600"}`}>
            {formatCurrency(data.remaining)}
          </p>
        </div>
      </div>
      {data.links.length > 0 ? (
        <ul className="text-sm divide-y divide-border rounded-md border">
          {data.links.map(l => (
            <li key={l.id} className="flex justify-between gap-2 px-2 py-1.5">
              <span className="truncate">
                {l.counterpart?.description ?? "Lançamento excluído"}
                {l.counterpart && (
                  <span className="text-xs text-muted-foreground ml-1">
                    {new Date(l.counterpart.transactionDate).toLocaleDateString("pt-BR")}
                    {l.counterpart.isPaid ? " · pago" : ""}
                  </span>
                )}
              </span>
              <span className="text-red-600 whitespace-nowrap">-{formatCurrency(l.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhuma despesa vinculada. Vincule pela edição da despesa.
        </p>
      )}
    </div>
  );
}
