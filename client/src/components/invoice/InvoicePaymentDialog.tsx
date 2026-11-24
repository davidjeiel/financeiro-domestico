import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/formatting";

export type InvoiceToPay = {
  creditCardId: number;
  competencyId: number;
  cardName: string;
  dueDate: Date | null;
  total: number;
  paid: number;
};

/** Pagamento parcial ou total da fatura de um cartão. */
export function InvoicePaymentDialog({
  invoice,
  onClose,
}: {
  invoice: InvoiceToPay | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const payMutation = trpc.invoice.addPayment.useMutation();
  const remaining = invoice ? Math.max(Math.round((invoice.total - invoice.paid) * 100) / 100, 0) : 0;
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (invoice) setAmount(remaining.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.creditCardId, invoice?.competencyId]);

  const pay = async (value: number) => {
    if (!invoice) return;
    try {
      const result = await payMutation.mutateAsync({
        creditCardId: invoice.creditCardId,
        competencyId: invoice.competencyId,
        amount: value,
      });
      await Promise.all([utils.invoice.invalidate(), utils.transaction.list.invalidate()]);
      toast.success(
        result.status === "paid"
          ? `Fatura ${invoice.cardName} paga.`
          : `Pagamento de ${formatCurrency(value)} registrado. Em aberto: ${formatCurrency(
              Number(result.totalAmount) - Number(result.paidAmount)
            )}`
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o pagamento");
    }
  };

  const typed = Number(String(amount).replace(",", "."));
  const typedValid = Number.isFinite(typed) && typed > 0 && typed <= remaining + 0.001;

  return (
    <Dialog open={!!invoice} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pagar fatura {invoice?.cardName}</DialogTitle>
          <DialogDescription>
            {invoice?.dueDate
              ? `Vencimento em ${new Date(invoice.dueDate).toLocaleDateString("pt-BR")}`
              : "Fatura do cartão"}
          </DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-md bg-muted p-2">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-semibold">{formatCurrency(invoice.total)}</p>
              </div>
              <div className="rounded-md bg-green-500/10 p-2">
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="font-semibold text-green-600">{formatCurrency(invoice.paid)}</p>
              </div>
              <div className="rounded-md bg-red-500/10 p-2">
                <p className="text-xs text-muted-foreground">Em aberto</p>
                <p className="font-semibold text-red-600">{formatCurrency(remaining)}</p>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="invoice-payment">Valor do pagamento</Label>
              <Input
                id="invoice-payment"
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              {!typedValid && amount !== "" && (
                <p className="text-xs text-red-600">
                  Informe um valor entre R$ 0,01 e {formatCurrency(remaining)}.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            disabled={payMutation.isPending || !typedValid || typed >= remaining}
            onClick={() => pay(typed)}
          >
            Pagar parcial
          </Button>
          <Button disabled={payMutation.isPending || remaining <= 0} onClick={() => pay(remaining)}>
            {payMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Pagar total ({formatCurrency(remaining)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
