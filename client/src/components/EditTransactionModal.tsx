import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import AddCategoryModal from "./AddCategoryModal";

interface EditTransactionModalProps {
  isOpen: boolean;
  transactionId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditTransactionModal({
  isOpen,
  transactionId,
  onClose,
  onSuccess,
}: EditTransactionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: "expense",
    category: "",
    description: "",
    amount: "",
    transactionDate: "",
    dueDate: "",
    notes: "",
  });

  const { data: transaction, isLoading: isFetching } = trpc.transaction.get.useQuery(
    { id: transactionId || 0 },
    { enabled: isOpen && transactionId !== null }
  );

  const { data: typologies } = trpc.typology.list.useQuery();
  const updateMutation = trpc.transaction.update.useMutation();
  const utils = trpc.useUtils();
  const [showAddCategory, setShowAddCategory] = useState(false);

  useEffect(() => {
    if (transaction) {
      setFormData({
        type: transaction.type || "expense",
        category: transaction.category || "",
        description: transaction.description || "",
        amount: transaction.amount || "",
        transactionDate: transaction.transactionDate
          ? new Date(transaction.transactionDate).toISOString().split("T")[0]
          : "",
        dueDate: transaction.dueDate
          ? new Date(transaction.dueDate).toISOString().split("T")[0]
          : "",
        notes: transaction.notes || "",
      });
    }
  }, [transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId) return;

    setIsLoading(true);
    try {
      await updateMutation.mutateAsync({
        id: transactionId,
        type: formData.type as "income" | "expense" | "credit_card",
        category: formData.category,
        description: formData.description,
        amount: formData.amount,
        transactionDate: new Date(formData.transactionDate),
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        notes: formData.notes,
      });

      await utils.transaction.list.invalidate();
      toast.success("Lançamento atualizado com sucesso!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar lançamento:", error);
      toast.error("Erro ao atualizar lançamento");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-card-foreground">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
        </DialogHeader>

        {isFetching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="type">Tipo</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger id="type" className="bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-card-foreground">
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category">Categoria</Label>
              <div className="flex gap-2">
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger id="category" className="bg-background border-border text-foreground flex-1">
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddCategory(true)}
                  className="border-border"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-background border-border text-foreground"
                placeholder="Descrição do lançamento"
              />
            </div>

            <div>
              <Label htmlFor="amount">Valor</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="bg-background border-border text-foreground"
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="transactionDate">Data da Transação</Label>
              <Input
                id="transactionDate"
                type="date"
                value={formData.transactionDate}
                onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                className="bg-background border-border text-foreground"
              />
            </div>

            <div>
              <Label htmlFor="dueDate">Data de Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="bg-background border-border text-foreground"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notas</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-background border-border text-foreground"
                placeholder="Notas adicionais"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} className="border-border">
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
      {showAddCategory && (
        <AddCategoryModal
          transactionType={formData.type as "income" | "expense" | "credit_card"}
          onCategoryAdded={() => {
            setShowAddCategory(false);
            utils.typology.list.invalidate();
          }}
        />
      )}
    </Dialog>
  );
}
