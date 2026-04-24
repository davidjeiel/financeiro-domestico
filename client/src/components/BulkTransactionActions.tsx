import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface BulkTransactionActionsProps {
  selectedIds: number[];
  onClose: () => void;
  onSuccess: () => void;
}

type BulkAction = "edit_category" | "edit_date" | "edit_due_date" | "edit_notes" | "delete";

export default function BulkTransactionActions({
  selectedIds,
  onClose,
  onSuccess,
}: BulkTransactionActionsProps) {
  const [action, setAction] = useState<BulkAction | "">("edit_category");
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: typologies } = trpc.typology.list.useQuery();
  const updateMutation = trpc.transaction.update.useMutation();
  const deleteMutation = trpc.transaction.delete.useMutation();
  const utils = trpc.useUtils();

  const handleApplyAction = async () => {
    if (!action || !value) {
      toast.error("Selecione uma ação e preencha o valor");
      return;
    }

    setIsLoading(true);
    try {
      if (action === "delete") {
        for (const id of selectedIds) {
          await deleteMutation.mutateAsync({ id });
        }
        toast.success(`${selectedIds.length} transação(ões) deletada(s)`);
      } else {
        for (const id of selectedIds) {
          const updateData: any = { id };
          
          if (action === "edit_category") {
            updateData.category = value;
          } else if (action === "edit_date") {
            updateData.transactionDate = new Date(value);
          } else if (action === "edit_due_date") {
            updateData.dueDate = new Date(value);
          } else if (action === "edit_notes") {
            updateData.notes = value;
          }

          await updateMutation.mutateAsync(updateData);
        }
        toast.success(`${selectedIds.length} transação(ões) atualizada(s)`);
      }

      await utils.transaction.list.invalidate();
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao aplicar ação em lote:", error);
      toast.error("Erro ao aplicar ação em lote");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={selectedIds.length > 0} onOpenChange={onClose}>
        <DialogContent className="bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle>Editar {selectedIds.length} transação(ões)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-action">Ação</Label>
              <Select value={action} onValueChange={(val) => {
                setAction(val as BulkAction);
                setValue("");
              }}>
                <SelectTrigger id="bulk-action" className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Selecione uma ação" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-card-foreground">
                  <SelectItem value="edit_category">Alterar Categoria</SelectItem>
                  <SelectItem value="edit_date">Alterar Data da Transação</SelectItem>
                  <SelectItem value="edit_due_date">Alterar Data de Vencimento</SelectItem>
                  <SelectItem value="edit_notes">Adicionar Notas</SelectItem>
                  <SelectItem value="delete">Deletar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {action === "edit_category" && (
              <div>
                <Label htmlFor="category-value">Categoria</Label>
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger id="category-value" className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-card-foreground">
                    {typologies?.map((typology) => (
                      <SelectItem key={typology.id} value={typology.name}>
                        {typology.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {action === "edit_date" && (
              <div>
                <Label htmlFor="date-value">Nova Data</Label>
                <Input
                  id="date-value"
                  type="date"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="bg-background border-border text-foreground"
                />
              </div>
            )}

            {action === "edit_due_date" && (
              <div>
                <Label htmlFor="due-date-value">Nova Data de Vencimento</Label>
                <Input
                  id="due-date-value"
                  type="date"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="bg-background border-border text-foreground"
                />
              </div>
            )}

            {action === "edit_notes" && (
              <div>
                <Label htmlFor="notes-value">Notas</Label>
                <Input
                  id="notes-value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="bg-background border-border text-foreground"
                  placeholder="Adicione notas"
                />
              </div>
            )}

            {action === "delete" && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-600 font-medium">
                  ⚠️ Esta ação deletará {selectedIds.length} transação(ões) permanentemente.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="border-border">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={isLoading || !action || !value}
              className={action === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {action === "delete" ? "Deletar" : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle>Confirmar ação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja {action === "delete" ? "deletar" : "atualizar"} {selectedIds.length} transação(ões)?
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowConfirm(false)} className="border-border">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowConfirm(false);
                handleApplyAction();
              }}
              className={action === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
