import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/formatting";
import { Plus, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import AddCategoryModal from "@/components/AddCategoryModal";
import LoadingOverlay from "@/components/LoadingOverlay";
// BulkTransactionActions removido - usando BulkEditModal e BulkDeleteModal
import BulkActionsFAB from "@/components/BulkActionsFAB";
import BulkEditModal from "@/components/BulkEditModal";
import BulkDeleteModal from "@/components/BulkDeleteModal";
import EditTransactionModal from "@/components/EditTransactionModal";
import SavedFiltersSelector from "@/components/SavedFiltersSelector";
import { ColumnSelector, ColumnConfig } from "@/components/ColumnSelector";
import { AdvancedFilters, TransactionFilters } from "@/components/AdvancedFilters";
import TransactionLinksManager from "@/components/TransactionLinksManager";
import { ColumnHeader } from "@/components/ColumnHeader";
import { FilterPriorityManager } from "@/components/FilterPriorityManager";

const transactionSchema = z.object({
  type: z.enum(["income", "expense", "credit_card"]),
  transactionType: z.enum(["simple", "recurring", "installment"]),
  category: z.string().min(1, "Categoria é obrigatória"),
  description: z.string().optional(),
  amount: z.string().min(1, "Valor é obrigatório"),
  transactionDate: z.string().min(1, "Data é obrigatória"),
  creditCardId: z.string().optional(),
  accountId: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "annual"]).optional(),
  installments: z.string().optional(),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

const CATEGORIES = {
  income: ["Salário", "Freelance", "Investimentos", "Outros"],
  expense: ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Lazer", "Outros"],
  credit_card: ["Alimentação", "Compras", "Serviços", "Outros"],
};

const FREQUENCIES = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
};

export default function TransactionsEnhanced() {
  const { data: currentCompetency } = trpc.competency.current.useQuery();
  const { data: transactions, isLoading } = trpc.transaction.list.useQuery(
    { competencyId: currentCompetency?.id || 0 },
    { enabled: !!currentCompetency }
  );
  const { data: creditCards } = trpc.creditCard.list.useQuery();
  const createMutation = trpc.transaction.create.useMutation();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const markAsPaidMutation = trpc.transaction.markAsPaid.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      toast.success("Status de pagamento atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status de pagamento");
    },
  });

  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"income" | "expense" | "credit_card">("expense");
  const [dynamicCategories, setDynamicCategories] = useState<{ [key: string]: { name: string; color: string; icon?: string }[] }>({
    income: [],
    expense: [],
    credit_card: [],
  });
  // Ações individuais removidas - usar seleção em lote com botões flutuantes
  const defaultColumns: ColumnConfig[] = [
    { id: 'date', label: 'Data', visible: true },
    { id: 'description', label: 'Descrição', visible: true },
    { id: 'category', label: 'Categoria', visible: true },
    { id: 'type', label: 'Tipo', visible: true },
    { id: 'amount', label: 'Valor', visible: true },
    { id: 'creditCard', label: 'Cartão', visible: true },
    { id: 'status', label: 'Status', visible: true },
    { id: 'links', label: 'Links', visible: true },
    { id: 'actions', label: 'Ações', visible: true },
  ];

  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [advancedFilters, setAdvancedFilters] = useState<TransactionFilters>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('transactionAdvancedFilters');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('transactionColumns');
      return saved ? JSON.parse(saved) : defaultColumns;
    }
    return defaultColumns;
  });
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<number[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showEditIndividual, setShowEditIndividual] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [showDeleteIndividual, setShowDeleteIndividual] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<number | null>(null);
  const [newTransactionLinks, setNewTransactionLinks] = useState<Array<{ title: string; url: string }>>([]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [filterPriority, setFilterPriority] = useState<string[]>([]);

  const handleAdvancedFiltersChange = (newFilters: TransactionFilters) => {
    setAdvancedFilters(newFilters);
    if (typeof window !== 'undefined') {
      localStorage.setItem('transactionAdvancedFilters', JSON.stringify(newFilters));
    }
  };

  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    if (typeof window !== 'undefined') {
      localStorage.setItem('transactionColumns', JSON.stringify(newColumns));
    }
  };

  const handleSort = (columnId: string, order: 'asc' | 'desc') => {
    setSortColumn(columnId);
    setSortOrder(order);
  };

  const handleColumnFilter = (columnId: string, value: string | undefined) => {
    setColumnFilters((prev) => {
      const newFilters = { ...prev };
      if (value === undefined || value === '') {
        delete newFilters[columnId];
        setFilterPriority((p) => p.filter((f) => f !== columnId));
      } else {
        newFilters[columnId] = value;
        if (!filterPriority.includes(columnId)) {
          setFilterPriority((p) => [columnId, ...p]);
        }
      }
      return newFilters;
    });
  };

  const handleFilterPriorityChange = (newPriority: string[]) => {
    setFilterPriority(newPriority);
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "expense",
      transactionType: "simple",
      transactionDate: new Date().toISOString().split("T")[0],
    },
  });

  const watchType = watch("type");
  const watchTransactionType = watch("transactionType");

  const handleAddCategory = (category: { name: string; color: string; icon?: string }) => {
    setDynamicCategories(prev => ({
      ...prev,
      [selectedType]: [...(prev[selectedType] || []), category],
    }));
    toast.success(`Categoria "${category.name}" adicionada!`);
  };

  const getAllCategories = () => {
    const baseCategories = CATEGORIES[selectedType as keyof typeof CATEGORIES] || [];
    const dynamicCats = dynamicCategories[selectedType] || [];
    return [...baseCategories, ...dynamicCats.map(c => c.name)];
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as typeof selectedType;
    setSelectedType(newType);
    setValue("type", newType);
  };

  const onSubmit = async (data: TransactionFormData) => {
    if (!currentCompetency) {
      toast.error("Competência não carregada");
      return;
    }

    // Validar se cartão foi selecionado quando tipo é credit_card
    if (data.type === "credit_card" && !data.creditCardId) {
      toast.error("Selecione um cartão de crédito");
      return;
    }

    try {
      // Converter amount para número e validar
      const amountNum = parseFloat(data.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        toast.error("Valor deve ser um número positivo");
        return;
      }

      // Corrigir timezone: data.transactionDate eh uma string YYYY-MM-DD
      // Criar data no formato UTC para evitar problemas de timezone
      const [year, month, day] = data.transactionDate.split('-').map(Number);
      const transactionDate = new Date(Date.UTC(year, month - 1, day));

      await createMutation.mutateAsync({
        competencyId: currentCompetency.id,
        type: data.type,
        category: data.category,
        description: data.description || "",
        amount: amountNum.toString(),
        transactionDate: transactionDate,
        creditCardId: data.creditCardId ? parseInt(data.creditCardId) : undefined,
        notes: data.notes || "",
      });

      toast.success("Movimentação criada com sucesso!");
      
      // Salvar links se houver
      if (newTransactionLinks.length > 0) {
        const lastTransaction = (await utils.transaction.list.getData({ competencyId: currentCompetency.id }))?.[0];
        if (lastTransaction) {
          for (const link of newTransactionLinks) {
            try {
              await trpc.transactionLinks.add.useMutation().mutateAsync({
                transactionId: lastTransaction.id,
                link: {
                  url: link.url,
                  title: link.title,
                },
              });
            } catch (linkError) {
              console.error("Erro ao salvar link:", linkError);
            }
          }
        }
      }
      
      reset({
        type: "expense",
        transactionType: "simple",
        transactionDate: new Date().toISOString().split("T")[0],
      });
      setSelectedType("expense");
      setNewTransactionLinks([]);
      setOpen(false);
      utils.transaction.list.invalidate({ competencyId: currentCompetency.id });
    } catch (error: any) {
      console.error("Erro ao criar movimentação:", error);
      const errorMessage = error?.message || "Erro ao criar movimentação";
      toast.error(errorMessage);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayoutCustom>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayoutCustom>
    );
  }

  return (
    <DashboardLayoutCustom title="Movimentações">
      <LoadingOverlay
        isVisible={createMutation.isPending}
        message="Salvando movimentação"
        details="Aguarde enquanto processamos sua transação..."
        status="loading"
      />

      <div className="space-y-6">
        {/* Add Transaction Dialog */}
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Nova Movimentação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-card text-card-foreground border-border max-h-96 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-foreground">Nova Movimentação</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Type Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Tipo de Transação
                    </label>
                    <select
                      {...register("type")}
                      onChange={handleTypeChange}
                      className="input-elegant w-full"
                    >
                      <option value="income">Receita</option>
                      <option value="expense">Despesa</option>
                      <option value="credit_card">Cartão de Crédito</option>
                    </select>
                    {errors.type && <p className="text-red-600 text-sm mt-1">{errors.type.message}</p>}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Tipo de Movimentação
                    </label>
                    <select
                      {...register("transactionType")}
                      className="input-elegant w-full"
                    >
                      <option value="simple">Simples</option>
                      <option value="recurring">Fixa/Recorrente</option>
                      <option value="installment">Parcelada</option>
                    </select>
                    {errors.transactionType && <p className="text-red-600 text-sm mt-1">{errors.transactionType.message}</p>}
                  </div>
                </div>

                {/* Category with Add Option */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">
                      Categoria
                    </label>
                    <AddCategoryModal
                      transactionType={selectedType}
                      onCategoryAdded={handleAddCategory}
                    />
                  </div>
                  <select
                    {...register("category")}
                    className="input-elegant w-full"
                  >
                    <option value="">Selecione uma categoria</option>
                    {getAllCategories().map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {errors.category && <p className="text-red-600 text-sm mt-1">{errors.category.message}</p>}
                </div>

                {/* Credit Card Selection - Required for credit_card type */}
                {watchType === "credit_card" && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Cartão de Crédito <span className="text-red-600">*</span>
                    </label>
                    {creditCards && creditCards.length > 0 ? (
                      <select
                        {...register("creditCardId")}
                        className="input-elegant w-full"
                      >
                        <option value="">Selecione um cartão</option>
                        {creditCards.map((card) => (
                          <option key={card.id} value={card.id.toString()}>
                            {card.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-600">
                        Nenhum cartão cadastrado. Crie um cartão primeiro em "Cartões".
                      </div>
                    )}
                    {errors.creditCardId && <p className="text-red-600 text-sm mt-1">{errors.creditCardId.message}</p>}
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Descrição
                  </label>
                  <input
                    {...register("description")}
                    type="text"
                    placeholder="Descrição da movimentação"
                    className="input-elegant w-full"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Valor <span className="text-red-600">*</span>
                  </label>
                  <input
                    {...register("amount")}
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    className="input-elegant w-full"
                  />
                  {errors.amount && <p className="text-red-600 text-sm mt-1">{errors.amount.message}</p>}
                </div>

                {/* Recurring Options */}
                {watchTransactionType === "recurring" && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Frequência <span className="text-red-600">*</span>
                    </label>
                    <select
                      {...register("frequency")}
                      className="input-elegant w-full"
                    >
                      <option value="">Selecione a frequência</option>
                      {Object.entries(FREQUENCIES).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {errors.frequency && <p className="text-red-600 text-sm mt-1">{errors.frequency.message}</p>}
                  </div>
                )}

                {/* Installment Options */}
                {watchTransactionType === "installment" && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Número de Parcelas <span className="text-red-600">*</span>
                    </label>
                    <input
                      {...register("installments")}
                      type="number"
                      min="2"
                      max="12"
                      placeholder="Ex: 3"
                      className="input-elegant w-full"
                    />
                    {errors.installments && <p className="text-red-600 text-sm mt-1">{errors.installments.message}</p>}
                  </div>
                )}

                {/* Date */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Data <span className="text-red-600">*</span>
                  </label>
                  <input
                    {...register("transactionDate")}
                    type="date"
                    className="input-elegant w-full"
                  />
                  {errors.transactionDate && <p className="text-red-600 text-sm mt-1">{errors.transactionDate.message}</p>}
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Notas
                  </label>
                  <textarea
                    {...register("notes")}
                    placeholder="Notas adicionais"
                    className="input-elegant w-full"
                    rows={2}
                  />
                </div>

                {/* Links Manager */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Links
                  </label>
                  <div className="space-y-2">
                    {newTransactionLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <div className="flex-1 truncate">
                          <p className="text-sm font-medium text-foreground truncate">{link.title || 'Sem título'}</p>
                          <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewTransactionLinks(newTransactionLinks.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Título do link"
                        id="linkTitle"
                        className="input-elegant flex-1"
                      />
                      <input
                        type="url"
                        placeholder="URL"
                        id="linkUrl"
                        className="input-elegant flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const titleInput = document.getElementById('linkTitle') as HTMLInputElement;
                          const urlInput = document.getElementById('linkUrl') as HTMLInputElement;
                          if (titleInput.value && urlInput.value) {
                            setNewTransactionLinks([...newTransactionLinks, { title: titleInput.value, url: urlInput.value }]);
                            titleInput.value = '';
                            urlInput.value = '';
                          }
                        }}
                        className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm font-medium"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="flex-1"
                    disabled={createMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Transactions List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">
              Movimentações - {currentCompetency?.name}
            </h2>
            <ColumnSelector columns={columns} onColumnsChange={handleColumnsChange} onSort={handleSort} />
          </div>
          
          {/* Filters */}
          <div className="mb-6 p-4 bg-muted rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Data Inicial</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Data Final</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={() => {
                    setFilterStartDate("");
                    setFilterEndDate("");
                    handleAdvancedFiltersChange({});
                    setColumnFilters({});
                    setFilterPriority([]);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Limpar Filtros
                </Button>
                <FilterPriorityManager
                  filters={columnFilters}
                  priority={filterPriority}
                  onPriorityChange={handleFilterPriorityChange}
                  onFilterRemove={(columnId) => handleColumnFilter(columnId, undefined)}
                />
              </div>
            </div>
            
            {/* Advanced Filters */}
            <AdvancedFilters
              filters={advancedFilters}
              onFiltersChange={handleAdvancedFiltersChange}
              creditCards={creditCards}
              onClearFilters={() => handleAdvancedFiltersChange({})}
            />
            
            {/* Saved Filters Selector */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-medium text-muted-foreground">Filtros Salvos:</span>
              <SavedFiltersSelector
                currentFilters={{
                  startDate: filterStartDate,
                  endDate: filterEndDate,
                }}
                onFilterSelect={(filter) => {
                  if (filter.startDate) setFilterStartDate(filter.startDate);
                  if (filter.endDate) setFilterEndDate(filter.endDate);
                }}
                onFilterSave={() => {}}
              />
            </div>
          </div>
          {transactions && transactions.length > 0 ? (() => {
            let filteredTransactions = transactions.filter(t => {
              const txDate = new Date(t.transactionDate).toISOString().split('T')[0];
              if (filterStartDate && txDate < filterStartDate) return false;
              if (filterEndDate && txDate > filterEndDate) return false;
              return true;
            });

            if (columnFilters.transactionDate) {
              filteredTransactions = filteredTransactions.filter(t =>
                new Date(t.transactionDate).toISOString().split('T')[0] === columnFilters.transactionDate
              );
            }
            if (columnFilters.description) {
              filteredTransactions = filteredTransactions.filter(t =>
                t.description?.toLowerCase().includes(columnFilters.description.toLowerCase())
              );
            }
            if (columnFilters.category) {
              filteredTransactions = filteredTransactions.filter(t => t.category === columnFilters.category);
            }
            if (columnFilters.type) {
              filteredTransactions = filteredTransactions.filter(t => t.type === columnFilters.type);
            }
            if (columnFilters.isPaid) {
              const isPaidValue = columnFilters.isPaid === '1' ? 1 : 0;
              filteredTransactions = filteredTransactions.filter(t => t.isPaid === isPaidValue);
            }

            if (sortColumn) {
              filteredTransactions = [...filteredTransactions].sort((a, b) => {
                let aVal: any = a[sortColumn as keyof typeof a];
                let bVal: any = b[sortColumn as keyof typeof b];

                if (sortColumn === 'amount') {
                  aVal = parseFloat(aVal);
                  bVal = parseFloat(bVal);
                } else if (sortColumn === 'transactionDate') {
                  aVal = new Date(aVal).getTime();
                  bVal = new Date(bVal).getTime();
                } else if (typeof aVal === 'string') {
                  aVal = aVal.toLowerCase();
                  bVal = bVal.toLowerCase();
                }

                if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
                return 0;
              });
            }

            const totals = filteredTransactions.reduce((acc, t) => {
              const amount = parseFloat(t.amount);
              if (t.type === 'income') {
                acc.income += amount;
                if (t.isPaid) acc.incomePaid += amount;
              }
              else if (t.type === 'expense') {
                acc.expense += amount;
                if (t.isPaid) acc.expensePaid += amount;
              }
              else if (t.type === 'credit_card') {
                acc.creditCard += amount;
                if (t.isPaid) acc.creditCardPaid += amount;
              }
              return acc;
            }, { income: 0, expense: 0, creditCard: 0, incomePaid: 0, expensePaid: 0, creditCardPaid: 0 });

            return (
              <>
                {/* Totals */}
                <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Receitas</p>
                    <p className="text-lg font-semibold text-green-600">+{formatCurrency(totals.income)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Pago: {formatCurrency(totals.incomePaid)}</p>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Despesas</p>
                    <p className="text-lg font-semibold text-red-600">-{formatCurrency(totals.expense)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Pago: {formatCurrency(totals.expensePaid)}</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Cartão</p>
                    <p className="text-lg font-semibold text-blue-600">-{formatCurrency(totals.creditCard)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Pago: {formatCurrency(totals.creditCardPaid)}</p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Saldo</p>
                    <p className={`text-lg font-semibold ${totals.income - totals.expense - totals.creditCard >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(totals.income - totals.expense - totals.creditCard)}
                    </p>
                  </div>
                </div>

                {filteredTransactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-border">
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold text-foreground">
                            <input
                              type="checkbox"
                              checked={selectedTransactionIds.length === filteredTransactions.length && filteredTransactions.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTransactionIds(filteredTransactions.map(t => t.id));
                                } else {
                                  setSelectedTransactionIds([]);
                                }
                              }}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </th>
                          <th className="text-left py-3 px-4">
                            <ColumnHeader
                              label="Data"
                              columnId="transactionDate"
                              sortColumn={sortColumn}
                              sortOrder={sortOrder}
                              onSort={handleSort}
                              onFilter={handleColumnFilter}
                              filterType="date"
                              currentFilterValue={columnFilters.transactionDate}
                            />
                          </th>
                          <th className="text-left py-3 px-4">
                            <ColumnHeader
                              label="Descrição"
                              columnId="description"
                              sortColumn={sortColumn}
                              sortOrder={sortOrder}
                              onSort={handleSort}
                              onFilter={handleColumnFilter}
                              filterType="text"
                              currentFilterValue={columnFilters.description}
                            />
                          </th>
                          <th className="text-left py-3 px-4">
                            <ColumnHeader
                              label="Categoria"
                              columnId="category"
                              sortColumn={sortColumn}
                              sortOrder={sortOrder}
                              onSort={handleSort}
                              onFilter={handleColumnFilter}
                              filterType="select"
                              filterOptions={[
                                { label: "Alimentação", value: "Alimentação" },
                                { label: "Transporte", value: "Transporte" },
                                { label: "Moradia", value: "Moradia" },
                                { label: "Saúde", value: "Saúde" },
                                { label: "Educação", value: "Educação" },
                                { label: "Lazer", value: "Lazer" },
                              ]}
                              currentFilterValue={columnFilters.category}
                            />
                          </th>
                          <th className="text-left py-3 px-4">
                            <ColumnHeader
                              label="Tipo"
                              columnId="type"
                              sortColumn={sortColumn}
                              sortOrder={sortOrder}
                              onSort={handleSort}
                              onFilter={handleColumnFilter}
                              filterType="select"
                              filterOptions={[
                                { label: "Receita", value: "income" },
                                { label: "Despesa", value: "expense" },
                                { label: "Cartão", value: "credit_card" },
                              ]}
                              currentFilterValue={columnFilters.type}
                            />
                          </th>
                          <th className="text-right py-3 px-4">
                            <ColumnHeader
                              label="Valor"
                              columnId="amount"
                              sortColumn={sortColumn}
                              sortOrder={sortOrder}
                              onSort={handleSort}
                              filterType="text"
                            />
                          </th>
                          <th className="text-center py-3 px-4">
                            <ColumnHeader
                              label="Pago"
                              columnId="isPaid"
                              sortColumn={sortColumn}
                              sortOrder={sortOrder}
                              onSort={handleSort}
                              onFilter={handleColumnFilter}
                              filterType="select"
                              filterOptions={[
                                { label: "Pagos", value: "1" },
                                { label: "Não Pagos", value: "0" },
                              ]}
                              currentFilterValue={columnFilters.isPaid}
                            />
                          </th>
                          <th className="text-center py-3 px-4 font-semibold text-foreground">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-border hover:bg-muted">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedTransactionIds.includes(transaction.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTransactionIds([...selectedTransactionIds, transaction.id]);
                            } else {
                              setSelectedTransactionIds(selectedTransactionIds.filter(id => id !== transaction.id));
                            }
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 text-foreground">
                        {formatDate(transaction.transactionDate)}
                      </td>
                      <td className="py-3 px-4 text-foreground">
                        {transaction.description || "-"}
                      </td>
                      <td className="py-3 px-4 text-foreground">{transaction.category}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          transaction.type === "income"
                            ? "bg-green-500/10 text-green-600"
                            : transaction.type === "expense"
                            ? "bg-red-500/10 text-red-600"
                            : "bg-blue-500/10 text-blue-600"
                        }`}>
                          {transaction.type === "income" ? "Receita" : transaction.type === "expense" ? "Despesa" : "Cartão"}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-semibold ${
                        transaction.type === "income"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}>
                        {transaction.type === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={transaction.isPaid === 1}
                          onChange={(e) => {
                            markAsPaidMutation.mutate({
                              id: transaction.id,
                              isPaid: e.target.checked,
                            });
                          }}
                          className="w-4 h-4 cursor-pointer"
                          title={transaction.isPaid === 1 ? "Marcar como não pago" : "Marcar como pago"}
                        />
                      </td>
                      <td className="py-3 px-4 text-center flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingTransactionId(transaction.id);
                            setShowEditIndividual(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDeletingTransactionId(transaction.id);
                            setShowDeleteIndividual(true);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Deletar
                        </Button>
                      </td>
                    </tr>
                  ))}  
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma movimentação no período selecionado
                  </p>
                )}
              </>
            );
          })() : (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma movimentação nesta competência
            </p>
          )}
        </Card>

        {/* Componentes de edição/exclusão individual removidos - usar seleção em lote */}

        {/* BulkTransactionActions removido - usando BulkEditModal e BulkDeleteModal no lugar */}

        {/* Floating Action Buttons */}
        <BulkActionsFAB
          selectedCount={selectedTransactionIds.length}
          onEdit={() => setShowBulkEdit(true)}
          onDelete={() => setShowBulkDelete(true)}
        />

        {/* Bulk Edit Modal */}
        <BulkEditModal
          isOpen={showBulkEdit}
          selectedIds={selectedTransactionIds}
          onClose={() => setShowBulkEdit(false)}
          onSuccess={() => {
            setSelectedTransactionIds([]);
            utils.transaction.list.invalidate();
          }}
        />

        {/* Bulk Delete Modal */}
        <BulkDeleteModal
          isOpen={showBulkDelete}
          selectedIds={selectedTransactionIds}
          onClose={() => setShowBulkDelete(false)}
          onSuccess={() => {
            setSelectedTransactionIds([]);
            utils.transaction.list.invalidate();
          }}
        />

        {/* Individual Edit Modal */}
        <EditTransactionModal
          isOpen={showEditIndividual}
          transactionId={editingTransactionId}
          onClose={() => {
            setShowEditIndividual(false);
            setEditingTransactionId(null);
          }}
          onSuccess={() => {
            utils.transaction.list.invalidate();
          }}
        />

        {/* Individual Delete Modal */}
        <BulkDeleteModal
          isOpen={showDeleteIndividual}
          selectedIds={deletingTransactionId ? [deletingTransactionId] : []}
          onClose={() => {
            setShowDeleteIndividual(false);
            setDeletingTransactionId(null);
          }}
          onSuccess={() => {
            utils.transaction.list.invalidate();
          }}
        />
      </div>
    </DashboardLayoutCustom>
  );
}
