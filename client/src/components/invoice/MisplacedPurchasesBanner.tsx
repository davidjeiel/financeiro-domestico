import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/formatting";

const fmt = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR");

/**
 * Aviso de compras no cartão gravadas na fatura errada (dados antigos). Mostra
 * a prévia — de qual fatura para qual — e só corrige as que o usuário confirmar.
 */
export function MisplacedPurchasesBanner() {
  const utils = trpc.useUtils();
  const { data: items = [] } = trpc.invoice.misplacedPurchases.useQuery(undefined, { staleTime: 60_000 });
  const fix = trpc.invoice.fixMisplacedPurchases.useMutation();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) setSelected(new Set(items.map(i => i.id)));
  }, [open, items]);

  if (items.length === 0) return null;

  const total = items.filter(i => selected.has(i.id)).reduce((sum, i) => sum + i.amount, 0);

  const apply = async () => {
    try {
      const { moved } = await fix.mutateAsync({ ids: Array.from(selected) });
      await Promise.all([utils.invoice.invalidate(), utils.transaction.invalidate(), utils.report.invalidate()]);
      toast.success(`${moved} ${moved === 1 ? "compra movida" : "compras movidas"} para a fatura certa.`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível corrigir");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="flex-1 min-w-[14rem]">
          <strong>
            {items.length} {items.length === 1 ? "compra no cartão está" : "compras no cartão estão"} na fatura errada.
          </strong>{" "}
          <span className="text-muted-foreground">
            Foram lançadas no mês aberto na tela, e não pela data da compra e o fechamento do cartão.
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Revisar e corrigir
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl sm:max-w-2xl flex flex-col max-h-[90vh] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-white/10 bg-black/20 shrink-0">
            <DialogTitle>Corrigir compras na fatura errada</DialogTitle>
            <DialogDescription>
              Cada compra vai para a fatura definida pela data dela e pelo dia de fechamento do cartão. Desmarque as
              que você colocou de propósito em outra fatura.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <label className="flex items-center gap-2 pb-2 mb-2 border-b border-white/10 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={selected.size === items.length}
                onChange={e => setSelected(e.target.checked ? new Set(items.map(i => i.id)) : new Set())}
              />
              Todas ({items.length})
            </label>
            <ul className="divide-y divide-white/5 text-sm">
              {items.map(item => (
                <li key={item.id}>
                  <label className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={selected.has(item.id)}
                      onChange={e =>
                        setSelected(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(item.id);
                          else next.delete(item.id);
                          return next;
                        })
                      }
                    />
                    <span className="w-20 text-muted-foreground">{fmt(item.transactionDate)}</span>
                    <span className="flex-1 min-w-[8rem] truncate">
                      {item.description} <span className="text-muted-foreground">· {item.cardName}</span>
                    </span>
                    <span className="tabular-nums w-24 text-right">{formatCurrency(item.amount)}</span>
                    <span className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <span className="text-red-400 line-through">vence {fmt(item.fromDueDate)}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="text-green-500">vence {fmt(item.toDueDate)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-white/10 bg-black/20 shrink-0 flex-col sm:flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              {selected.size} {selected.size === 1 ? "compra" : "compras"} · {formatCurrency(total)}. Os totais das
              faturas são recalculados; pagamentos já registrados continuam nas faturas.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={apply} disabled={selected.size === 0 || fix.isPending}>
                {fix.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Corrigir {selected.size}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
