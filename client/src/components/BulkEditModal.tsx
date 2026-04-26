import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Search } from "lucide-react";
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
  const [isLoading, setIsLoading] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3B82F6");
  const [newCategoryType, setNewCategoryType] = useState<"income" | "expense" | "credit_card">("expense");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<"income" | "expense" | "credit_card" | "all">("all");

  // Estados para cada campo com checkbox de ativação
  const [updateCategory, setUpdateCategory] = useState(false);
  const [category, setCategory] = useState("__placeholder__");

  const [updateTransactionDate, setUpdateTransactionDate] = useState(false);
  const [transactionDate, setTransactionDate] = useState("");

  const [updateDueDate, setUpdateDueDate] = useState(false);
  const [dueDate, setDueDate] = useState("");

  const [updateNotes, setUpdateNotes] = useState(false);
  const [notes, setNotes] = useState("");

  // Usar query sem parâmetros para buscar todas as tipologias do usuário
  const { data: typologies = [], isLoading: isLoadingTypologies, refetch: refetchTypologies } = trpc.typology.list.useQuery();
  const updateMutation = trpc.transaction.update.useMutation();
  const createTypologyMutation = trpc.typology.create.useMutation();
  const utils = trpc.useUtils();

  // Debug: log das categorias
  useEffect(() => {
    console.log("Tipologias carregadas:", typologies);
  }, [typologies]);

  // Filtrar e buscar categorias
  const filteredTypologies = useMemo(() => {
    let filtered = typologies || [];

    // Filtrar por tipo se não for "all"
    if (categoryTypeFilter !== "all") {
      filtered = filtered.filter(t => t.type === categoryTypeFilter);
    }

    // Filtrar por busca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.name.toLowerCase().includes(query));
    }

    return filtered;
  }, [typologies, categoryTypeFilter, searchQuery]);

  // Resetar formulário quando o modal fecha
  useEffect(() => {
    if (!isOpen) {
      setUpdateCategory(false);
      setCategory("__placeholder__");
      setUpdateTransactionDate(false);
      setTransactionDate("");
      setUpdateDueDate(false);
      setDueDate("");
      setUpdateNotes(false);
      setNotes("");
      setShowAddCategory(false);
      setNewCategoryName("");
      setNewCategoryColor("#3B82F6");
      setNewCategoryType("expense");
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
        type: newCategoryType,
        color: newCategoryColor,
        icon: "📌",
      });

      toast.success("Categoria criada com sucesso!");
      setNewCategoryName("");
      setNewCategoryColor("#3B82F6");
      setNewCategoryType("expense");
      setShowAddCategory(false);
      
      // Recarregar tipologias e invalidar cache
      await utils.typology.list.invalidate();
      await refetchTypologies();
    } catch (error) {
      console.error("Erro ao criar categoria:", error);
      toast.error("Erro ao criar categoria");
    }
  };

  const handleSubmit = async () => {
    // Validar se pelo menos um campo foi selecionado para atualização
    if (!updateCategory && !updateTransactionDate && !updateDueDate && !updateNotes) {
      toast.error("Selecione pelo menos um campo para atualizar");
      return;
    }

    // Validar se os campos selecionados foram preenchidos
    if (updateCategory && category === "__placeholder__") {
      toast.error("Selecione uma categoria");
      return;
    }
    if (updateTransactionDate && !transactionDate) {
      toast.error("Preencha a data da transação");
      return;
    }
    if (updateDueDate && !dueDate) {
      toast.error("Preencha a data de vencimento");
      return;
    }
    if (updateNotes && !notes.trim()) {
      toast.error("Preencha as notas");
      return;
    }

    setIsLoading(true);
    try {
      for (const id of selectedIds) {
        const updateData: any = { id };

        if (updateCategory && category !== "__placeholder__") updateData.category = category;
        if (updateTransactionDate) updateData.transactionDate = new Date(transactionDate);
        if (updateDueDate) updateData.dueDate = new Date(dueDate);
        if (updateNotes) updateData.notes = notes;

        await updateMutation.mutateAsync(updateData);
      }

      toast.success(`${selectedIds.length} transação(ões) atualizada(s)`);
      await utils.transaction.list.invalidate();

      // Resetar formulário
      setUpdateCategory(false);
      setCategory("__placeholder__");
      setUpdateTransactionDate(false);
      setTransactionDate("");
      setUpdateDueDate(false);
      setDueDate("");
      setUpdateNotes(false);
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
          <DialogTitle>Editar {selectedIds.length} transação(ões)</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Marque os campos que deseja atualizar e preencha os novos valores. Os campos não marcados não serão alterados.
          </p>

          {/* Categoria */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <Checkbox
                id="update-category"
                checked={updateCategory}
                onCheckedChange={(checked) => setUpdateCategory(checked as boolean)}
                className="w-5 h-5"
              />
              <Label htmlFor="update-category" className="text-base font-semibold cursor-pointer flex-1">
                Atualizar Categoria
              </Label>
            </div>

            {updateCategory && (
              <div className="ml-8 space-y-4">
                {/* Filtro por tipo */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Filtrar por Tipo:</Label>
                  <div className="flex gap-2 flex-wrap">
                    {["all", "income", "expense", "credit_card"].map((type) => (
                      <Button
                        key={type}
                        type="button"
                        variant={categoryTypeFilter === type ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCategoryTypeFilter(type as any)}
                        className={categoryTypeFilter === type ? "bg-blue-600 hover:bg-blue-700" : "border-border"}
                      >
                        {type === "all" ? "Todas" : TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
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
                  <Select value={category} onValueChange={setCategory}>
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
                      <Label className="text-sm font-medium">Tipo:</Label>
                      <div className="flex gap-2">
                        {["income", "expense", "credit_card"].map((type) => (
                          <Button
                            key={type}
                            type="button"
                            variant={newCategoryType === type ? "default" : "outline"}
                            size="sm"
                            onClick={() => setNewCategoryType(type as any)}
                            className={newCategoryType === type ? "bg-blue-600 hover:bg-blue-700" : "border-border"}
                          >
                            {TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Cor:</Label>
                      <div className="flex gap-2 flex-wrap">
                        {COLORS.map((color) => (
                          <button
                            key={color}
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
                          setNewCategoryType("expense");
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
            )}
          </div>

          {/* Data da Transação */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <Checkbox
                id="update-transaction-date"
                checked={updateTransactionDate}
                onCheckedChange={(checked) => setUpdateTransactionDate(checked as boolean)}
                className="w-5 h-5"
              />
              <Label htmlFor="update-transaction-date" className="text-base font-semibold cursor-pointer flex-1">
                Atualizar Data da Transação
              </Label>
            </div>

            {updateTransactionDate && (
              <div className="ml-8">
                <Input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="bg-background border-border text-foreground"
                />
              </div>
            )}
          </div>

          {/* Data de Vencimento */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <Checkbox
                id="update-due-date"
                checked={updateDueDate}
                onCheckedChange={(checked) => setUpdateDueDate(checked as boolean)}
                className="w-5 h-5"
              />
              <Label htmlFor="update-due-date" className="text-base font-semibold cursor-pointer flex-1">
                Atualizar Data de Vencimento
              </Label>
            </div>

            {updateDueDate && (
              <div className="ml-8">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-background border-border text-foreground"
                />
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <Checkbox
                id="update-notes"
                checked={updateNotes}
                onCheckedChange={(checked) => setUpdateNotes(checked as boolean)}
                className="w-5 h-5"
              />
              <Label htmlFor="update-notes" className="text-base font-semibold cursor-pointer flex-1">
                Adicionar Notas
              </Label>
            </div>

            {updateNotes && (
              <div className="ml-8">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Digite as notas"
                  className="bg-background border-border text-foreground"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="border-border">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || (!updateCategory && !updateTransactionDate && !updateDueDate && !updateNotes)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Atualizar {selectedIds.length} Transação(ões)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
