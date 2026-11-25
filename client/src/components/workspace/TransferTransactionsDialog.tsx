import { useEffect, useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { AlertTriangle, ArrowRightLeft, Loader2, Users, User } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useActiveWorkspaceId, useSwitchWorkspace } from "./useWorkspaces";

/**
 * Move os lançamentos selecionados da área ativa para outra área de trabalho.
 * Mostra antes o que muda (cartões, vínculos, responsáveis).
 */
export function TransferTransactionsDialog({
  open,
  ids,
  onClose,
  onDone,
}: {
  open: boolean;
  ids: number[];
  onClose: () => void;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const sourceWorkspaceId = useActiveWorkspaceId();
  const { data: list } = trpc.workspace.list.useQuery(undefined, { enabled: open });
  const { switchTo } = useSwitchWorkspace();
  const targets = (list?.workspaces ?? []).filter(w => !w.isActive);

  const [targetId, setTargetId] = useState("");
  const [cardMap, setCardMap] = useState<Record<string, number | "new">>({});

  useEffect(() => {
    if (open) {
      setTargetId(prev => (targets.some(t => t.id === prev) ? prev : targets[0]?.id ?? ""));
    } else {
      setCardMap({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, list]);

  const preview = trpc.transaction.transferPreview.useQuery(
    open && targetId && sourceWorkspaceId && ids.length
      ? { ids, sourceWorkspaceId, targetWorkspaceId: targetId }
      : skipToken,
    { retry: false, staleTime: 0 }
  );

  // Sugestões da prévia (cartão de mesmo nome, ou criar cópia).
  useEffect(() => {
    if (!preview.data) return;
    setCardMap(
      Object.fromEntries(preview.data.cards.map(c => [String(c.sourceCardId), c.suggested]))
    );
  }, [preview.data]);

  const transfer = trpc.transaction.transfer.useMutation();
  const target = targets.find(t => t.id === targetId);

  const handleTransfer = async () => {
    if (!sourceWorkspaceId || !targetId) return;
    try {
      const result = await transfer.mutateAsync({
        ids,
        sourceWorkspaceId,
        targetWorkspaceId: targetId,
        cardMap,
      });
      await Promise.all([
        utils.transaction.invalidate(),
        utils.invoice.invalidate(),
        utils.allocation.invalidate(),
        utils.typology.invalidate(),
        utils.creditCard.invalidate(),
      ]);
      toast.success(
        `${result.count} ${result.count === 1 ? "lançamento transferido" : "lançamentos transferidos"} para "${result.target.name}".`,
        {
          action: {
            label: "Abrir área",
            onClick: () => {
              switchTo(result.target.id).catch(err =>
                toast.error(err instanceof Error ? err.message : "Não foi possível abrir a área")
              );
            },
          },
        }
      );
      onDone();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível transferir");
    }
  };

  const p = preview.data;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Transferir {ids.length} {ids.length === 1 ? "lançamento" : "lançamentos"}
          </DialogTitle>
          <DialogDescription>
            Os lançamentos saem desta área e passam para a área escolhida.
          </DialogDescription>
        </DialogHeader>

        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você não tem outra área de trabalho. Crie uma em <strong>Áreas e pessoas</strong>.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Área de destino</Label>
              <div className="space-y-1.5" role="radiogroup">
                {targets.map(w => (
                  <label
                    key={w.id}
                    className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer text-sm ${
                      w.id === targetId ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="transfer-target"
                      className="sr-only"
                      checked={w.id === targetId}
                      onChange={() => setTargetId(w.id)}
                    />
                    {w.kind === "shared" ? <Users className="w-4 h-4 text-primary" /> : <User className="w-4 h-4" />}
                    <span className="font-medium">{w.name}</span>
                    {w.kind === "shared" && !w.ownedByMe && (
                      <span className="text-xs text-muted-foreground">de {w.ownerName ?? w.ownerEmail}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {preview.isFetching && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Lendo a área de destino…
              </p>
            )}
            {preview.error && <p className="text-sm text-red-600">{preview.error.message}</p>}

            {p && !preview.isFetching && (
              <>
                {p.cards.length > 0 && (
                  <div className="space-y-2">
                    <Label>Cartões em “{target?.name}”</Label>
                    {p.cards.map(card => (
                      <div key={card.sourceCardId} className="flex items-center gap-2 text-sm">
                        <span className="w-28 truncate" title={card.name}>{card.name} →</span>
                        <select
                          className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                          value={String(cardMap[String(card.sourceCardId)] ?? "new")}
                          onChange={e =>
                            setCardMap(prev => ({
                              ...prev,
                              [String(card.sourceCardId)]: e.target.value === "new" ? "new" : Number(e.target.value),
                            }))
                          }
                        >
                          {p.targetCards.map(tc => (
                            <option key={tc.id} value={tc.id}>{tc.name}</option>
                          ))}
                          <option value="new">Criar cartão “{card.name}” lá</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {(p.allocationsRemoved > 0 || p.responsiblesUnmatched > 0) && (
                  <div className="rounded-md bg-amber-500/10 p-3 text-sm space-y-1">
                    <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4" /> Atenção
                    </p>
                    {p.allocationsRemoved > 0 && (
                      <p>
                        {p.allocationsRemoved} {p.allocationsRemoved === 1 ? "vínculo" : "vínculos"} com
                        receitas desta área {p.allocationsRemoved === 1 ? "será desfeito" : "serão desfeitos"}.
                      </p>
                    )}
                    {p.responsiblesUnmatched > 0 && (
                      <p>
                        {p.responsiblesUnmatched}{" "}
                        {p.responsiblesUnmatched === 1 ? "lançamento ficará" : "lançamentos ficarão"} sem
                        responsável (a pessoa não está na área de destino).
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Competência, categoria, notas e links são mantidos; categorias que faltarem são criadas no destino.
                </p>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleTransfer}
            disabled={!p || preview.isFetching || transfer.isPending || !targetId}
          >
            {transfer.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
