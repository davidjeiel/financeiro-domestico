import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface BulkEditModalProps {
  isOpen: boolean;
  selectedIds: number[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkEditModal({
  isOpen,
  selectedIds,
  onClose,
  onSuccess,
}: BulkEditModalProps) {
  const [category, setCategory] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { data: typologies } = trpc.typology.list.useQuery();
  const updateMutation = trpc.transaction.update.useMutation();
  const utils = trpc.useUtils();

  const handleSubmit = async () => {
    // Validar se pelo menos um campo foi preenchido
    if (!category && !transactionDate && !dueDate && !notes) {
      toast.error("Preencha pelo menos um campo para atualizar");
      return;
    }

    setIsLoading(true);
    try {
      for (const id of selectedIds) {
        const updateData: any = { id };

        if (category) updateData.category = category;
        if (transactionDate) updateData.transactionDate = new Date(transactionDate);
        if (dueDate) updateData.dueDate = new Date(dueDate);
        if (notes) updateData.notes = notes;

        await updateMutation.mutateAsync(updateData);
      }

      toast.success(`${selectedIds.length} transação(ões) atualizada(s)`);
      await utils.transaction.list.invalidate();
      
      // Limpar formulário
      setCategory("");
      setTransactionDate("");
      setDueDate("");
      setNotes("");
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar transações:", error);
      toast.error("Erro ao atualizar transações");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-card-foreground max-w-md">
        <DialogHeader>
          <DialogTitle>Editar {selectedIds.length} transação(ões)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Preencha apenas os campos que deseja atualizar. Os campos vazios não serão alterados.
          </p>

          {/* Categoria */}
          <div>
            <Label htmlFor="bulk-category">Categoria (opcional)</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="bulk-category" className="bg-background border-border text-foreground">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-card-foreground">
                {typologies && typologies.length > 0 ? (
                  typologies.map((typology) => (
                    <SelectItem key={typology.id} value={typology.name}>
                      {typology.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>
                    Nenhuma categoria disponível
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Data da Transação */}
          <div>
            <Label htmlFor="bulk-transaction-date">Data da Transação (opcional)</Label>
            <Input
              id="bulk-transaction-date"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="bg-background border-border text-foreground"
            />
          </div>

          {/* Data de Vencimento */}
          <div>
            <Label htmlFor="bulk-due-date">Data de Vencimento (opcional)</Label>
            <Input
              id="bulk-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-background border-border text-foreground"
            />
          </div>

          {/* Notas */}
          <div>
            <Label htmlFor="bulk-notes">Notas (opcional)</Label>
            <Input
              id="bulk-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione notas"
              className="bg-background border-border text-foreground"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} className="border-border">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || (!category && !transactionDate && !dueDate && !notes)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Atualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
