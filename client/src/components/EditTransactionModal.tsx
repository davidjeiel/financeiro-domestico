import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

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
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3B82F6");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<"income" | "expense" | "credit_card" | "all">("all");

  const [formData, setFormData] = useState({
    type: "expense" as "income" | "expense" | "credit_card",
    category: "__placeholder__",
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

  const { data: typologies = [], isLoading: isLoadingTypologies, refetch: refetchTypologies } = trpc.typology.list.useQuery();
  const updateMutation = trpc.transaction.update.useMutation();
  const createTypologyMutation = trpc.typology.create.useMutation();
  const utils = trpc.useUtils();

  // Filtrar categorias
  const filteredTypologies = useMemo(() => {
    let filtered = typologies || [];

    if (categoryTypeFilter !== "all") {
      filtered = filtered.filter(t => t.type === categoryTypeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.name.toLowerCase().includes(query));
    }

    return filtered;
  }, [typologies, categoryTypeFilter, searchQuery]);

  useEffect(() => {
    if (transaction && isOpen) {
      setFormData({
        type: transaction.type || "expense",
        category: transaction.category || "__placeholder__",
        description: transaction.description || "",
        amount: (transaction.amount || 0).toString(),
        transactionDate: transaction.transactionDate
          ? new Date(transaction.transactionDate).toISOString().split("T")[0]
          : "",
        dueDate: transaction.dueDate
          ? new Date(transaction.dueDate).toISOString().split("T")[0]
          : "",
        notes: transaction.notes || "",
      });
      setCategoryTypeFilter(transaction.type || "all");
    }
  }, [transaction, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        type: "expense",
        category: "__placeholder__",
        description: "",
        amount: "",
        transactionDate: "",
        dueDate: "",
        notes: "",
      });
      setShowAddCategory(false);
      setNewCategoryName("");
      setNewCategoryColor("#3B82F6");
      setSearchQuery("");
      setCategoryTypeFilter("all");
    }
  }, [isOpen]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Digite um nome para a categoria");
      return;
    }

    try {
      await createTypologyMutation.mutateAsync({
        name: newCategoryName,
        type: formData.type,
        color: newCategoryColor,
        icon: "📌",
      });

      toast.success("Categoria criada com sucesso!");
      setFormData({ ...formData, category: newCategoryName });
      setNewCategoryName("");
      setNewCategoryColor("#3B82F6");
      setShowAddCategory(false);
      
      await utils.typology.list.invalidate();
      await refetchTypologies();
    } catch (error) {
      console.error("Erro ao criar categoria:", error);
      toast.error("Erro ao criar categoria");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId) return;

    if (!formData.description.trim()) {
      toast.error("Preencha a descrição");
      return;
    }
    if (!formData.amount) {
      toast.error("Preencha o valor");
      return;
    }
    if (formData.category === "__placeholder__") {
      toast.error("Selecione uma categoria");
      return;
    }
    if (!formData.transactionDate) {
      toast.error("Preencha a data da transação");
      return;
    }

    setIsLoading(true);
    try {
      await updateMutation.mutateAsync({
        id: transactionId,
        description: formData.description,
        amount: formData.amount,
        transactionDate: new Date(formData.transactionDate),
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        notes: formData.notes,
      });

      await utils.transaction.list.invalidate();
      toast.success("Transação atualizada com sucesso!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar transação:", error);
      toast.error("Erro ao atualizar transação");
    } finally {
      setIsLoading(false);
    }
  };

  const COLORS = [
    "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
    "#EC4899", "#06B6D4", "#6366F1", "#14B8A6", "#F97316",
  ];

  const TYPE_LABELS = {
    income: "Receita",
    expense: "Despesa",
    credit_card: "Cartão de Crédito",
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-card-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Transação</DialogTitle>
        </DialogHeader>

        {isFetching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Descrição */}
            <div>
              <Label htmlFor="description" className="font-semibold">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Digite a descrição"
                className="bg-background border-border text-foreground"
              />
            </div>

            {/* Valor */}
            <div>
              <Label htmlFor="amount" className="font-semibold">Valor</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="bg-background border-border text-foreground"
              />
            </div>

            {/* Tipo */}
            <div>
              <Label htmlFor="type" className="font-semibold">Tipo</Label>
              <Select value={formData.type} onValueChange={(value) => {
                setFormData({ ...formData, type: value as any });
                setCategoryTypeFilter(value as any);
              }}>
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

            {/* Categoria */}
            <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
              <Label className="text-base font-semibold">Categoria</Label>

              {/* Filtro por tipo */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Filtrar por Tipo:</Label>
                <div className="flex gap-2 flex-wrap">
                  {["all", "income", "expense", "credit_card"].map((filterType) => (
                    <Button
                      key={filterType}
                      type="button"
                      variant={categoryTypeFilter === filterType ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategoryTypeFilter(filterType as any)}
                      className={categoryTypeFilter === filterType ? "bg-blue-600 hover:bg-blue-700" : "border-border"}
                    >
                      {filterType === "all" ? "Todas" : TYPE_LABELS[filterType as keyof typeof TYPE_LABELS]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Busca rápida */}
              <div className="space-y-2">
                <Label htmlFor="category-search" className="text-sm font-medium">Buscar Categoria:</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="category-search"
                    placeholder="Digite para buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-background border-border text-foreground"
                  />
                </div>
              </div>

              {/* Seletor de categorias */}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {isLoadingTypologies ? "Carregando categorias..." : `${filteredTypologies?.length || 0} categoria(s) encontrada(s)`}
                </div>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-card-foreground max-h-[300px]">
                    <SelectItem value="__placeholder__" disabled>
                      Selecione uma categoria
                    </SelectItem>
                    {isLoadingTypologies ? (
                      <SelectItem value="__loading__" disabled>
                        Carregando...
                      </SelectItem>
                    ) : filteredTypologies && filteredTypologies.length > 0 ? (
                      filteredTypologies.map((typology) => (
                        <SelectItem key={typology.id} value={typology.name}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: typology.color || "#3B82F6" }}
                            />
                            {typology.name}
                            <span className="text-xs text-muted-foreground ml-2">
                              ({TYPE_LABELS[typology.type as keyof typeof TYPE_LABELS]})
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__no-categories__" disabled>
                        Nenhuma categoria encontrada
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {!showAddCategory && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCategory(true)}
                  className="w-full border-border"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Nova Categoria
                </Button>
              )}

              {showAddCategory && (
                <div className="space-y-3 p-3 rounded border border-border bg-background">
                  <Input
                    placeholder="Nome da categoria"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="bg-background border-border text-foreground"
                  />

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tipo: {TYPE_LABELS[formData.type]}</Label>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Cor:</Label>
                    <div className="flex gap-2 flex-wrap">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewCategoryColor(color)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            newCategoryColor === color
                              ? "border-foreground scale-110"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddCategory(false);
                        setNewCategoryName("");
                        setNewCategoryColor("#3B82F6");
                      }}
                      className="flex-1 border-border"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddCategory}
                      disabled={!newCategoryName.trim() || createTypologyMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {createTypologyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Criar
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Data da Transação */}
            <div>
              <Label htmlFor="transactionDate" className="font-semibold">Data da Transação</Label>
              <Input
                id="transactionDate"
                type="date"
                value={formData.transactionDate}
                onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                className="bg-background border-border text-foreground"
              />
            </div>

            {/* Data de Vencimento */}
            <div>
              <Label htmlFor="dueDate" className="font-semibold">Data de Vencimento (Opcional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="bg-background border-border text-foreground"
              />
            </div>

            {/* Notas */}
            <div>
              <Label htmlFor="notes" className="font-semibold">Notas (Opcional)</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Digite as notas"
                className="bg-background border-border text-foreground"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="border-border">
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
