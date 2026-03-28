import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface DeleteTransactionDialogProps {
  isOpen: boolean;
  transactionId: number | null;
  transactionDescription?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteTransactionDialog({
  isOpen,
  transactionId,
  transactionDescription = "este lançamento",
  onClose,
  onSuccess,
}: DeleteTransactionDialogProps) {
  const deleteMutation = trpc.transaction.delete.useMutation();
  const utils = trpc.useUtils();

  const handleDelete = async () => {
    if (!transactionId) return;

    try {
      await deleteMutation.mutateAsync({ id: transactionId });
      await utils.transaction.list.invalidate();
      toast.success("Lançamento deletado com sucesso!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao deletar lançamento:", error);
      toast.error("Erro ao deletar lançamento");
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-card border-border text-card-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>Deletar Lançamento</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Tem certeza que deseja deletar {transactionDescription}? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border text-foreground hover:bg-muted">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? "Deletando..." : "Deletar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
