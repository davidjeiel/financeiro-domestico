import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface BulkDeleteModalProps {
  isOpen: boolean;
  selectedIds: number[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkDeleteModal({
  isOpen,
  selectedIds,
  onClose,
  onSuccess,
}: BulkDeleteModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const deleteMutation = trpc.transaction.delete.useMutation();
  const utils = trpc.useUtils();

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      for (const id of selectedIds) {
        await deleteMutation.mutateAsync({ id });
      }

      toast.success(`${selectedIds.length} transação(ões) deletada(s)`);
      await utils.transaction.list.invalidate();
      
      setShowConfirm(false);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao deletar transações:", error);
      toast.error("Erro ao deletar transações");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Modal de Confirmação */}
      <Dialog open={isOpen && !showConfirm} onOpenChange={onClose}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Deletar {selectedIds.length} transação(ões)?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você está prestes a deletar {selectedIds.length} transação(ões) permanentemente. Esta ação não pode ser desfeita.
            </p>

            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-600 font-medium">
                ⚠️ Esta ação é irreversível. Certifique-se antes de prosseguir.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="border-border">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação Final */}
      <Dialog open={showConfirm} onOpenChange={() => setShowConfirm(false)}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza absoluta? Digite "DELETAR" abaixo para confirmar:
            </p>

            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-600 font-medium">
                {selectedIds.length} transação(ões) serão deletadas permanentemente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirm(false)}
              className="border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Deletar Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
