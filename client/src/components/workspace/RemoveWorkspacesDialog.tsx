import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, LogOut, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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

export type RemovableWorkspace = {
  id: string;
  name: string;
  ownedByMe: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  isActive: boolean;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Confirma a exclusão de uma ou mais áreas compartilhadas. As criadas pelo
 * usuário vão para a lixeira do Drive (para todos); das outras, ele só sai.
 */
export function RemoveWorkspacesDialog({
  open,
  workspaces,
  onClose,
  onDone,
}: {
  open: boolean;
  workspaces: RemovableWorkspace[];
  onClose: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const remove = trpc.workspace.remove.useMutation();
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open]);

  const owned = workspaces.filter(w => w.ownedByMe);
  const others = workspaces.filter(w => !w.ownedByMe);
  const needsConfirm = owned.length > 0;

  const title =
    owned.length && !others.length
      ? `Excluir ${plural(owned.length, "área", "áreas")}`
      : others.length && !owned.length
        ? `Sair de ${plural(others.length, "área", "áreas")}`
        : `Excluir ou sair de ${workspaces.length} áreas`;

  const handleConfirm = async () => {
    try {
      const { results, switchedToPersonal } = await remove.mutateAsync({ ids: workspaces.map(w => w.id) });
      // Os dados em cache podem ser da área que saiu: recarrega tudo.
      await queryClient.resetQueries();
      const deleted = results.filter(r => r.action === "deleted").length;
      const left = results.filter(r => r.action === "left").length;
      const failed = results.filter(r => r.action === "error");
      const parts = [
        deleted ? `${plural(deleted, "área excluída", "áreas excluídas")}.` : null,
        left ? `Você saiu de ${plural(left, "área", "áreas")}.` : null,
        switchedToPersonal ? "Agora você está na área Pessoal." : null,
      ].filter(Boolean);
      if (deleted || left) toast.success(parts.join(" ").replace(/^./, c => c.toUpperCase()));
      failed.forEach(f => toast.error(`${f.name}: ${f.error}`));
      onDone();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir");
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            {title}
          </DialogTitle>
          <DialogDescription>Confira o que acontece com cada uma antes de confirmar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {owned.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-red-500" /> Criadas por você — serão excluídas
              </p>
              <ul className="space-y-1">
                {owned.map(w => (
                  <li key={w.id} className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                    <span className="font-medium">{w.name}</span>
                    {w.isActive && <span className="ml-2 text-xs text-primary">(ativa)</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                A planilha vai para a lixeira do seu Google Drive e <strong>todos os participantes perdem o acesso</strong>.
                Dá para recuperá-la pela lixeira do Drive por 30 dias.
              </p>
            </div>
          )}

          {others.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium flex items-center gap-1.5">
                <LogOut className="w-4 h-4 text-amber-500" /> De outras pessoas — você sai
              </p>
              <ul className="space-y-1">
                {others.map(w => (
                  <li key={w.id} className="rounded-md border border-border px-3 py-2">
                    <span className="font-medium">{w.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      de {w.ownerName ?? w.ownerEmail ?? "outra pessoa"}
                    </span>
                    {w.isActive && <span className="ml-2 text-xs text-primary">(ativa)</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                A área sai da sua lista e os dados continuam com o dono. Para voltar, peça um novo convite ou use
                "Entrar em área compartilhada comigo".
              </p>
            </div>
          )}

          {workspaces.some(w => w.isActive) && (
            <p className="text-xs text-muted-foreground">Depois disso você volta para a área Pessoal.</p>
          )}

          {needsConfirm && (
            <label className="flex items-start gap-2 rounded-md bg-red-500/10 p-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
              />
              <span className="flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                Entendo que {owned.length === 1 ? "a área será excluída" : "as áreas serão excluídas"} para todos
                os participantes.
              </span>
            </label>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={remove.isPending || workspaces.length === 0 || (needsConfirm && !confirmed)}
          >
            {remove.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
