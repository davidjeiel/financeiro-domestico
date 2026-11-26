import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Repeat } from "lucide-react";
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

type Scope = "this" | "future" | "all_unpaid";

interface Props {
  transactionId: number | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const br = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
};

/**
 * Pergunta o alcance da exclusão de um lançamento recorrente: só este, este e
 * os próximos (encerra a recorrência) ou também os anteriores não pagos.
 */
export function RecurringDeleteDialog({ transactionId, open, onClose, onDeleted }: Props) {
  const utils = trpc.useUtils();
  const { data: preview, isLoading } = trpc.recurrence.deletePreview.useQuery(
    { id: transactionId ?? 0 },
    { enabled: open && !!transactionId, staleTime: 0 }
  );
  const deleteMutation = trpc.transaction.delete.useMutation();
  const [scope, setScope] = useState<Scope>("this");

  useEffect(() => {
    if (open) setScope("this");
  }, [open, transactionId]);

  const income = preview?.type === "income";
  const unpaidWord = income ? "não recebida" : "não paga";
  const unpaidWordPl = income ? "não recebidas" : "não pagas";
  const paidWordPl = income ? "recebidas" : "pagas";

  const options: { value: Scope; title: string; detail: string; count: number }[] = preview
    ? [
        {
          value: "this",
          title: "Somente esta",
          detail: "As outras continuam. Esta data não volta a ser gerada.",
          count: 1,
        },
        {
          value: "future",
          title: "Esta e as próximas",
          detail:
            (preview.futureUnpaid > 0
              ? `Remove também ${plural(preview.futureUnpaid, `ocorrência futura ${unpaidWord}`, `ocorrências futuras ${unpaidWordPl}`)}` +
                (preview.lastFutureDate ? ` (até ${br(preview.lastFutureDate)})` : "")
              : "Não há ocorrências futuras") +
            ". A recorrência é encerrada e não gera mais lançamentos." +
            (preview.futurePaid > 0 ? ` ${plural(preview.futurePaid, `futura já ${paidWordPl.slice(0, -1)} fica`, `futuras já ${paidWordPl} ficam`)}.` : ""),
          count: 1 + preview.futureUnpaid,
        },
        {
          value: "all_unpaid",
          title: `Esta, as próximas e as anteriores ${unpaidWordPl}`,
          detail:
            (preview.pastUnpaid > 0
              ? `Além das próximas, remove ${plural(preview.pastUnpaid, `anterior ${unpaidWord}`, `anteriores ${unpaidWordPl}`)}.`
              : `Não há anteriores ${unpaidWordPl}.`) +
            (preview.pastPaid > 0
              ? ` ${plural(preview.pastPaid, `${income ? "recebida" : "paga"} continua`, `${paidWordPl} continuam`)} no histórico.`
              : ""),
          count: 1 + preview.futureUnpaid + preview.pastUnpaid,
        },
      ]
    : [];

  const selected = options.find(o => o.value === scope);

  const confirm = async () => {
    if (!transactionId) return;
    try {
      await deleteMutation.mutateAsync({ id: transactionId, scope });
      await Promise.all([
        utils.transaction.invalidate(),
        utils.recurrence.invalidate(),
        utils.allocation.invalidate(),
        utils.invoice.invalidate(),
        utils.report.invalidate(),
      ]);
      toast.success(`${plural(selected?.count ?? 1, "lançamento excluído", "lançamentos excluídos")}.`);
      onDeleted();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir");
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary" />
            Excluir {income ? "receita" : "despesa"} recorrente
          </DialogTitle>
          <DialogDescription>
            {preview ? <>"{preview.description}" se repete. O que você quer excluir?</> : "Carregando…"}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !preview ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div role="radiogroup" className="space-y-2">
            {options.map(o => (
              <label
                key={o.value}
                className={`flex gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  scope === o.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="recurring-delete-scope"
                  className="mt-1 w-4 h-4 accent-[var(--primary)]"
                  checked={scope === o.value}
                  onChange={() => setScope(o.value)}
                />
                <span className="flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{o.title}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {plural(o.count, "lançamento", "lançamentos")}
                    </span>
                  </span>
                  <span className="block text-sm text-muted-foreground mt-0.5">{o.detail}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {scope !== "this" && (
          <p className="flex items-start gap-2 text-xs text-amber-500">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Não dá para desfazer. Vínculos com receitas desses lançamentos também são removidos.
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={!preview || deleteMutation.isPending}>
            {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Excluir {selected ? plural(selected.count, "lançamento", "lançamentos") : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
