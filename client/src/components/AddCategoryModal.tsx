import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#6366F1", "#14B8A6", "#F97316",
];

export interface AddCategoryModalProps {
  transactionType: "income" | "expense" | "credit_card";
  parentCategories?: Array<{ id: number; name: string }>;
  onSuccess?: (name: string) => void;
}

export function AddCategoryModal({
  transactionType,
  parentCategories,
  onSuccess,
}: AddCategoryModalProps) {
  const [open, setOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState("📌");
  const [selectedParentId, setSelectedParentId] = useState<number | undefined>(undefined);

  const utils = trpc.useUtils();
  const createMutation = trpc.typology.create.useMutation();

  const getTypeLabel = () => {
    switch (transactionType) {
      case "income":
        return "Receita";
      case "expense":
        return "Despesa";
      case "credit_card":
        return "Cartão de Crédito";
      default:
        return "Transação";
    }
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      toast.error("Digite um nome para a categoria");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: categoryName.trim(),
        type: transactionType,
        icon: selectedIcon,
        color: selectedColor,
        parentId: selectedParentId,
      });

      await utils.typology.list.invalidate();
      onSuccess?.(categoryName.trim());
      toast.success(`Categoria "${categoryName.trim()}" adicionada com sucesso!`);

      // Reset form
      setCategoryName("");
      setSelectedColor(COLORS[0]);
      setSelectedIcon("📌");
      setSelectedParentId(undefined);
      setOpen(false);
    } catch (error) {
      toast.error("Erro ao adicionar categoria");
      console.error(error);
    }
  };

  const EMOJI_OPTIONS = [
    "📌", "🍔", "🚗", "🏠", "💊", "📚", "🎮", "✈️",
    "💼", "🛍️", "⚡", "💰", "📱", "🎬", "🏃", "🎵",
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Categoria
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-card text-card-foreground border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Adicionar Categoria de {getTypeLabel()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Name */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Nome da Categoria
            </label>
            <input
              type="text"
              placeholder="Ex: Alimentação, Transporte..."
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="input-elegant w-full"
              disabled={createMutation.isPending}
            />
          </div>

          {/* Parent Category Selection */}
          {parentCategories && parentCategories.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Categoria pai (opcional)
              </label>
              <select
                value={selectedParentId ?? ""}
                onChange={(e) =>
                  setSelectedParentId(e.target.value ? parseInt(e.target.value) : undefined)
                }
                className="input-elegant w-full"
                disabled={createMutation.isPending}
              >
                <option value="">Nenhuma (categoria raiz)</option>
                {parentCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Emoji Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Ícone (Emoji)
            </label>
            <div className="grid grid-cols-8 gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedIcon(emoji)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center text-lg ${
                    selectedIcon === emoji
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                  disabled={createMutation.isPending}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Cor
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    selectedColor === color
                      ? "border-foreground"
                      : "border-border"
                  }`}
                  style={{ backgroundColor: color }}
                  disabled={createMutation.isPending}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-2">Prévia:</p>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: selectedColor }}
              >
                {selectedIcon}
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {categoryName || "Nome da categoria"}
                </p>
                <p className="text-xs text-muted-foreground">{getTypeLabel()}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleAddCategory}
              disabled={createMutation.isPending || !categoryName.trim()}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddCategoryModal;
