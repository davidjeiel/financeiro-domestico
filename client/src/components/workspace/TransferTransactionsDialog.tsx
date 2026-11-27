import { useEffect, useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { AlertTriangle, ArrowRightLeft, Copy, Loader2, Repeat, Users, User } from "lucide-react";
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

type Mode = "move" | "copy";
type SeriesScope = "selected" | "following" | "all";

const MODES: { mode: Mode; label: string; hint: string; Icon: typeof Copy }[] = [
  { mode: "move", label: "Mover", hint: "Sai desta área e vai para a outra", Icon: ArrowRightLeft },
  { mode: "copy", label: "Copiar", hint: "Fica nesta área e ganha uma cópia na outra", Icon: Copy },
];

/**
 * Move ou copia os lançamentos selecionados da área ativa para outra área de
 * trabalho. Mostra antes o que muda (cartões, vínculos, responsáveis).
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
  const [mode, setMode] = useState<Mode>("move");
  const [cardMap, setCardMap] = useState<Record<string, number | "new">>({});
  const [seriesScope, setSeriesScope] = useState<SeriesScope>("selected");

  useEffect(() => {
    if (open) {
      setTargetId(prev => (targets.some(t => t.id === prev) ? prev : targets[0]?.id ?? ""));
    } else {
      setCardMap({});
      setMode("move");
      setSeriesScope("selected");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, list]);

  const preview = trpc.transaction.transferPreview.useQuery(
    open && targetId && sourceWorkspaceId && ids.length
      ? { ids, sourceWorkspaceId, targetWorkspaceId: targetId, seriesScope }
      : skipToken,
    // Mantém a prévia anterior na tela enquanto recalcula (ex.: trocar a opção da série).
    { retry: false, staleTime: 0, placeholderData: prev => prev }
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
        mode,
        seriesScope,
      });
      await Promise.all([
        utils.transaction.invalidate(),
        utils.invoice.invalidate(),
        utils.allocation.invalidate(),
        utils.typology.invalidate(),
        utils.creditCard.invalidate(),
        utils.recurrence.invalidate(),
      ]);
      const what =
        mode === "copy"
          ? result.count === 1 ? "lançamento copiado" : "lançamentos copiados"
          : result.count === 1 ? "lançamento movido" : "lançamentos movidos";
      const rules =
        result.rulesTransferred > 0
          ? ` A recorrência continua sendo gerada lá${mode === "move" ? " (e para de ser gerada aqui)" : ""}.`
          : "";
      toast.success(
        `${result.count} ${what} para "${result.target.name}".${rules}`,
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
  const total = p?.count ?? ids.length;
  const noun = total === 1 ? "lançamento" : "lançamentos";
  const series = p?.series;
  const seriesOptions: { value: SeriesScope; label: string; hint: string; count: number }[] = series
    ? [
        {
          value: "selected",
          label: ids.length === 1 ? "Só este lançamento" : "Só os selecionados",
          hint: "As demais ocorrências continuam nesta área.",
          count: series.selected,
        },
        {
          value: "following",
          label: "Este e os próximos da série",
          hint:
            mode === "move"
              ? "A recorrência passa a ser gerada na outra área; aqui ficam só os anteriores."
              : "A outra área ganha a recorrência a partir daqui; esta continua igual.",
          count: series.following,
        },
        {
          value: "all",
          label: "A série inteira",
          hint:
            mode === "move"
              ? "Todos os lançamentos da série, pagos inclusive, e a recorrência vão para a outra área."
              : "A outra área ganha a série inteira e a recorrência; esta continua igual.",
          count: series.all,
        },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Transferir {total} {noun}
          </DialogTitle>
          <DialogDescription>
            {total === 1
              ? mode === "copy"
                ? "O lançamento continua nesta área e uma cópia é criada na área escolhida."
                : "O lançamento sai desta área e passa para a área escolhida."
              : mode === "copy"
                ? "Os lançamentos continuam nesta área e uma cópia é criada na área escolhida."
                : "Os lançamentos saem desta área e passam para a área escolhida."}
          </DialogDescription>
        </DialogHeader>

        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você não tem outra área de trabalho. Crie uma em <strong>Áreas e pessoas</strong>.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>O que fazer</Label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mover ou copiar">
                {MODES.map(({ mode: m, label, hint, Icon }) => (
                  <label
                    key={m}
                    className={`flex flex-col gap-0.5 rounded-md border p-2 cursor-pointer text-sm ${
                      m === mode ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="transfer-mode"
                      className="sr-only"
                      checked={m === mode}
                      onChange={() => setMode(m)}
                    />
                    <span className="flex items-center gap-1.5 font-medium">
                      <Icon className="w-4 h-4" /> {label}
                    </span>
                    <span className="text-xs text-muted-foreground">{hint}</span>
                  </label>
                ))}
              </div>
            </div>

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

            {series && series.recurringSelected > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Repeat className="w-4 h-4 text-primary" />
                  {series.recurringSelected === 1 && ids.length === 1
                    ? "Este lançamento é recorrente"
                    : `${series.recurringSelected} ${series.recurringSelected === 1 ? "lançamento selecionado é recorrente" : "lançamentos selecionados são recorrentes"}`}
                </Label>
                <div className="space-y-1.5" role="radiogroup" aria-label="O que levar da série">
                  {seriesOptions.map(o => (
                    <label
                      key={o.value}
                      className={`flex gap-2 rounded-md border p-2 cursor-pointer text-sm ${
                        o.value === seriesScope ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="transfer-series"
                        className="mt-0.5"
                        checked={o.value === seriesScope}
                        onChange={() => setSeriesScope(o.value)}
                      />
                      <span className="flex-1">
                        <span className="flex justify-between gap-2">
                          <span className="font-medium">{o.label}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {o.count} {o.count === 1 ? "lançamento" : "lançamentos"}
                          </span>
                        </span>
                        <span className="block text-xs text-muted-foreground">{o.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

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

                {((mode === "move" && p.allocationsRemoved > 0) || p.responsiblesUnmatched > 0) && (
                  <div className="rounded-md bg-amber-500/10 p-3 text-sm space-y-1">
                    <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4" /> Atenção
                    </p>
                    {mode === "move" && p.allocationsRemoved > 0 && (
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
                  Categoria, notas, links e situação de pagamento são mantidos; categorias que faltarem são
                  criadas no destino. A competência segue a data (no cartão, a fatura).
                  {mode === "copy" && p.allocationsRemoved > 0 && " Os vínculos com receitas ficam só nesta área."}
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
            {mode === "copy" ? `Copiar ${noun}` : `Mover ${noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
