import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, getLocalDateStringSaoPaulo } from "@/lib/formatting";
import { Plus, Loader2, Filter, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CalendarDays, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "@/data/schema";
import AddCategoryModal from "@/components/AddCategoryModal";
import LoadingOverlay from "@/components/LoadingOverlay";
// BulkTransactionActions removido - usando BulkEditModal e BulkDeleteModal
import BulkActionsFAB from "@/components/BulkActionsFAB";
import { CalculatorPopover } from "@/components/CalculatorPopover";
import { DragHandle, SortableTr } from "@/components/SortableRows";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TransferTransactionsDialog } from "@/components/workspace/TransferTransactionsDialog";
import BulkEditModal from "@/components/BulkEditModal";
import BulkDeleteModal from "@/components/BulkDeleteModal";
import EditTransactionModal from "@/components/EditTransactionModal";
import SavedFiltersSelector, { type AppliedSavedFilter } from "@/components/SavedFiltersSelector";
import {
  applyFilterCriteria,
  countCriteria,
  describeCriteria,
  matchesDescription,
  savedFilterToState,
  selectedCardIds,
  selectedCategories,
  selectedTypes,
} from "@/lib/filterCriteria";
import { ColumnSelector, ColumnConfig } from "@/components/ColumnSelector";
import { AdvancedFilters, TransactionFilters } from "@/components/AdvancedFilters";
import TransactionLinksManager from "@/components/TransactionLinksManager";
import { ColumnHeader } from "@/components/ColumnHeader";
import { FilterPriorityManager } from "@/components/FilterPriorityManager";
import { ResponsibleSelect } from "@/components/workspace/ResponsibleSelect";
import { PersonBadge } from "@/components/workspace/PersonBadge";
import { useActiveWorkspaceId, usePeople } from "@/components/workspace/useWorkspaces";
import { IncomeLinksEditor, type IncomeLink } from "@/components/allocation/IncomeLinksEditor";
import { InvoicePaymentDialog, type InvoiceToPay } from "@/components/invoice/InvoicePaymentDialog";
import { MisplacedPurchasesBanner } from "@/components/invoice/MisplacedPurchasesBanner";
import {
  parseTransactionsSearch,
  toColumnFilters,
} from "@/lib/transactionFilters";
import {
  monthRange,
  readViewMode,
  saveViewMode,
  type ViewMode,
} from "@/lib/transactionView";

const transactionSchema = z.object({
  type: z.enum(["income", "expense", "credit_card"]),
  transactionType: z.enum(["simple", "recurring", "installment"]),
  category: z.string().min(1, "Categoria é obrigatória"),
  description: z.string().optional(),
  amount: z.string().min(1, "Valor é obrigatório"),
  transactionDate: z.string().min(1, "Data é obrigatória"),
  creditCardId: z.string().optional(),
  accountId: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "annual"]).optional().or(z.literal("")),
  endDate: z.string().optional(),
  /** Recorrência: o valor muda a cada mês (fica estimado até confirmar). */
  variableAmount: z.boolean().optional(),
  installments: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, context) => {
  if (data.transactionType !== "recurring") return;

  if (!data.frequency) {
    context.addIssue({
      code: "custom",
      path: ["frequency"],
      message: "Frequência obrigatória",
    });
  }
  // Data limite é opcional: em branco, a recorrência não tem fim.
  if (data.endDate && data.endDate < data.transactionDate) {
    context.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "A data limite deve ser igual ou posterior à data inicial",
    });
  }
});

type TransactionFormData = z.infer<typeof transactionSchema>;

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

  // Visão escolhida pelo usuário; a última escolha fica salva no navegador.
  // Filtros vindos da URL (ex.: clique num card do dashboard), lidos uma vez.
  const [linkFilters] = useState(() =>
    typeof window === "undefined" ? {} : parseTransactionsSearch(window.location.search)
  );
  useEffect(() => {
    // Tira os parâmetros da barra de endereço: daqui em diante os filtros são da tela.
    if (window.location.search) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.hash);
    }
  }, []);
  const [viewMode, setViewMode] = useState<ViewMode>(() => linkFilters.visao ?? readViewMode());
  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    saveViewMode(mode);
  };

  // Period navigation state — null until currentCompetency loads
  const [navYear, setNavYear] = useState<number | null>(null);
  const [navMonth, setNavMonth] = useState<number | null>(null);

  // Initialise nav from currentCompetency on first load
  useEffect(() => {
    if (currentCompetency && navYear === null) {
      setNavYear(currentCompetency.year);
      setNavMonth(currentCompetency.month);
    }
  }, [currentCompetency, navYear]);

  const { data: navCompetency } = trpc.competency.getByYearMonth.useQuery(
    { year: navYear!, month: navMonth! },
    { enabled: navYear !== null && navMonth !== null }
  );

  const activeCompetency = navCompetency ?? currentCompetency;
  const isCurrentPeriod =
    navYear === currentCompetency?.year && navMonth === currentCompetency?.month;
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  const goPrev = () => {
    if (navYear === null || navMonth === null) return;
    if (navMonth === 1) { setNavYear(navYear - 1); setNavMonth(12); }
    else setNavMonth(navMonth - 1);
  };
  const goNext = () => {
    if (navYear === null || navMonth === null) return;
    if (navMonth === 12) { setNavYear(navYear + 1); setNavMonth(1); }
    else setNavMonth(navMonth + 1);
  };
  const goCurrent = () => {
    if (!currentCompetency) return;
    setNavYear(currentCompetency.year);
    setNavMonth(currentCompetency.month);
  };

  // Na visão mensal, o período é o mês do calendário (pela data do lançamento),
  // a menos que o usuário tenha escolhido um intervalo de datas nos filtros.
  const hasCustomRange = !!filterStartDate || !!filterEndDate;
  const navRange =
    viewMode === "monthly" && navYear !== null && navMonth !== null
      ? monthRange(navYear, navMonth)
      : null;

  const { data: transactions, isLoading } = trpc.transaction.list.useQuery(
    {
      competencyId: activeCompetency?.id || 0,
      startDate: hasCustomRange ? filterStartDate || undefined : navRange?.start,
      endDate: hasCustomRange ? filterEndDate || undefined : navRange?.end,
    },
    { enabled: !!activeCompetency }
  );
  const { data: creditCards } = trpc.creditCard.list.useQuery();
  const { data: allTypologies, refetch: refetchTypologies, isError: typologiesError } = trpc.typology.list.useQuery(undefined, {
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
  // Faturas da área, por cartão + competência (as compras do cartão são agrupadas nelas).
  const { data: allInvoices } = trpc.invoice.listAll.useQuery();
  const invoiceKey = (creditCardId: number | null, competencyId: number) => `${creditCardId}-${competencyId}`;
  const invoicesByKey = new Map((allInvoices ?? []).map(inv => [invoiceKey(inv.creditCardId, inv.competencyId), inv]));
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  // Veio filtrando um cartão: abre as faturas dele para mostrar as compras.
  const cardFilterFromLink = linkFilters.cartao;
  useEffect(() => {
    if (!cardFilterFromLink || !transactions) return;
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      transactions
        .filter(t => t.type === "credit_card" && t.creditCardId === cardFilterFromLink)
        .forEach(t => next.add(invoiceKey(t.creditCardId, t.competencyId)));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardFilterFromLink, transactions]);
  const toggleInvoice = (key: string) =>
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [payingInvoice, setPayingInvoice] = useState<InvoiceToPay | null>(null);

  // Vencimento da fatura em que uma compra no cartão é cobrada
  const getInvoiceDueDate = (transaction: Transaction): Date | null => {
    if (transaction.type !== 'credit_card') return null;
    const invoice = invoicesByKey.get(invoiceKey(transaction.creditCardId, transaction.competencyId));
    return invoice ? new Date(invoice.dueDate) : null;
  };
  
  const createMutation = trpc.transaction.create.useMutation();
  const createRecurringMutation = trpc.transaction.createRecurring.useMutation();
  const createInstallmentsMutation = trpc.transaction.createInstallments.useMutation();
  const isSaving =
    createMutation.isPending ||
    createRecurringMutation.isPending ||
    createInstallmentsMutation.isPending;
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const markAsPaidMutation = trpc.transaction.markAsPaid.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.allocation.invalidate();
      utils.invoice.invalidate();
      toast.success("Status de pagamento atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status de pagamento");
    },
  });

  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"income" | "expense" | "credit_card">("expense");
  const { people, byId: peopleById } = usePeople();
  const me = people.find(p => p.isMe);
  // Responsável pelo pagamento do novo lançamento (padrão: quem está lançando).
  const [responsibleUserId, setResponsibleUserId] = useState<number | null>(null);
  const showResponsible = people.filter(p => p.status !== "removed").length > 1;
  // Ações individuais removidas - usar seleção em lote com botões flutuantes
  const defaultColumns: ColumnConfig[] = [
    { id: 'date', label: 'Data', visible: true },
    { id: 'description', label: 'Descrição', visible: true },
    { id: 'category', label: 'Categoria', visible: true },
    { id: 'type', label: 'Tipo', visible: true },
    { id: 'amount', label: 'Valor', visible: true },
    { id: 'creditCard', label: 'Cartão', visible: true },
    { id: 'responsible', label: 'Responsável', visible: true },
    { id: 'allocation', label: 'Vínculo com receita', visible: true },
    { id: 'status', label: 'Status', visible: true },
    { id: 'links', label: 'Links', visible: true },
    { id: 'actions', label: 'Ações', visible: true },
  ];

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
      if (!saved) return defaultColumns;
      const parsed: ColumnConfig[] = JSON.parse(saved);
      // Colunas novas (ex: Responsável) entram mesmo com configuração salva.
      const missing = defaultColumns.filter(c => !parsed.some(p => p.id === c.id));
      return missing.length ? [...parsed, ...missing] : parsed;
    }
    return defaultColumns;
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<number[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showEditIndividual, setShowEditIndividual] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [showDeleteIndividual, setShowDeleteIndividual] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<number | null>(null);
  const [newTransactionLinks, setNewTransactionLinks] = useState<Array<{ title: string; url: string }>>([]);
  const [pendingNewCategory, setPendingNewCategory] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // Ordem recém-arrastada, aplicada na hora enquanto a planilha grava.
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);
  const reorderMutation = trpc.transaction.reorder.useMutation();
  const confirmAmountMutation = trpc.transaction.confirmAmount.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.invoice.invalidate();
      toast.success("Valor confirmado.");
    },
    onError: error => toast.error(error.message),
  });
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(() =>
    toColumnFilters(linkFilters)
  );
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const showAllocationColumn = columns.find(c => c.id === "allocation")?.visible !== false;
  const showResponsibleColumn =
    showResponsible && columns.find(c => c.id === "responsible")?.visible !== false;

  const handleAdvancedFiltersChange = (newFilters: TransactionFilters) => {
    setAdvancedFilters(newFilters);
    if (typeof window !== 'undefined') {
      localStorage.setItem('transactionAdvancedFilters', JSON.stringify(newFilters));
    }
  };

  // Filtro salvo: troca o período e os critérios da tela pelos do filtro.
  const applySavedFilter = (filter: AppliedSavedFilter) => {
    setFilterStartDate(filter.startDate);
    setFilterEndDate(filter.endDate);
    handleAdvancedFiltersChange(filter.criteria);
  };

  // Abre com um filtro salvo: o da URL (?filtro=id, vindo da página Filtros)
  // ou, sem nenhum outro filtro, o marcado como padrão.
  const { data: savedFilterList } = trpc.savedFilter.list.useQuery();
  const savedFilterApplied = useRef(false);
  useEffect(() => {
    if (savedFilterApplied.current || !savedFilterList) return;
    savedFilterApplied.current = true;
    const fromUrl = linkFilters.filtro ? savedFilterList.find(f => f.id === linkFilters.filtro) : undefined;
    const noOtherFilter =
      !linkFilters.tipo && !linkFilters.situacao && !linkFilters.cartao && !linkFilters.categoria &&
      !linkFilters.natureza && countCriteria(advancedFilters) === 0;
    const chosen = fromUrl ?? (noOtherFilter ? savedFilterList.find(f => f.isDefault === 1) : undefined);
    if (!chosen) return;
    applySavedFilter({ id: chosen.id, name: chosen.name, ...savedFilterToState(chosen) });
    if (fromUrl) toast.success(`Filtro "${chosen.name}" aplicado.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedFilterList]);

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

  // Função para obter data local no formato YYYY-MM-DD
  const getLocalDateString = () => {
    return getLocalDateStringSaoPaulo();
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "expense",
      transactionType: "simple",
      transactionDate: getLocalDateString(),
      variableAmount: true,
    },
  });

  const watchType = watch("type");
  const watchTransactionType = watch("transactionType");
  const watchAmount = watch("amount");
  const watchInstallments = watch("installments");
  // Receitas que pagam a nova despesa (só em lançamentos simples).
  const [newIncomeLinks, setNewIncomeLinks] = useState<IncomeLink[]>([]);
  const activeWorkspaceId = useActiveWorkspaceId();
  // Trocou de área: vínculos escolhidos na área anterior não valem aqui.
  useEffect(() => setNewIncomeLinks([]), [activeWorkspaceId]);
  const canLinkIncome = watchType !== "income" && watchTransactionType === "simple";
  // Totais vinculados por lançamento (coberto nas despesas, comprometido nas receitas).
  const { data: allocationTotals = {} } = trpc.allocation.totals.useQuery();

  useEffect(() => {
    if (pendingNewCategory && allTypologies?.some((t) => t.name === pendingNewCategory)) {
      setValue("category", pendingNewCategory);
      setPendingNewCategory(null);
    }
  }, [allTypologies, pendingNewCategory, setValue]);

  useEffect(() => {
    if (open) {
      setResponsibleUserId(me?.id ?? null);
      setNewIncomeLinks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, me?.id]);

  useEffect(() => {
    if (open) {
      reset({
        type: "expense",
        transactionType: "simple",
        transactionDate: getLocalDateString(),
        variableAmount: true,
      });
      setSelectedType("expense");
      setNewTransactionLinks([]);
      setPendingNewCategory(null);
    }
  }, [open]);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as typeof selectedType;
    setSelectedType(newType);
    setValue("type", newType);
  };

  // "Salvar e nova": grava e deixa o formulário aberto para o próximo lançamento.
  const continueAfterSave = React.useRef(false);

  const onSubmit = async (data: TransactionFormData) => {
    const keepOpen = continueAfterSave.current;
    continueAfterSave.current = false;
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

      // Enviar data como string YYYY-MM-DD (sem conversão para Date)
      const transactionData = {
        type: data.type,
        category: data.category,
        description: data.description || "",
        amount: amountNum.toString(),
        creditCardId: data.creditCardId ? parseInt(data.creditCardId) : undefined,
        notes: data.notes || "",
        responsibleUserId,
      };

      let createdTransactions: Transaction[];
      if (data.transactionType === "installment") {
        const count = parseInt(data.installments || "", 10);
        if (!Number.isInteger(count) || count < 2 || count > 72) {
          toast.error("Informe de 2 a 72 parcelas");
          return;
        }
        if (data.type === "income") {
          toast.error("Parcelamento vale para despesas e compras no cartão");
          return;
        }
        createdTransactions = await createInstallmentsMutation.mutateAsync({
          type: data.type,
          category: data.category,
          description: data.description || "",
          totalAmount: amountNum.toFixed(2),
          installments: count,
          firstDate: data.transactionDate,
          creditCardId: transactionData.creditCardId,
          notes: data.notes || "",
          responsibleUserId,
        });
      } else if (data.transactionType === "recurring") {
        if (!data.frequency) {
          toast.error("Informe a frequência");
          return;
        }
        createdTransactions = await createRecurringMutation.mutateAsync({
          ...transactionData,
          frequency: data.frequency,
          startDate: data.transactionDate,
          endDate: data.endDate || null,
          variableAmount: data.variableAmount !== false,
        });
      } else {
        if (!activeCompetency) {
          toast.error("Competência não carregada");
          return;
        }
        createdTransactions = [
          await createMutation.mutateAsync({
            ...transactionData,
            competencyId: activeCompetency.id,
            transactionDate: data.transactionDate,
            incomeLinks:
              data.type !== "income" && data.transactionType === "simple" && newIncomeLinks.length
                ? newIncomeLinks
                : undefined,
            workspaceId: activeWorkspaceId,
          }),
        ];
      }

      toast.success(
        data.transactionType === "recurring"
          ? data.endDate
            ? `Recorrência criada: ${createdTransactions.length} lançamento(s) até o mês que vem; os demais são gerados com 1 mês de antecedência.`
            : `Recorrência sem data final criada: ${createdTransactions.length} lançamento(s) até o mês que vem; os próximos são gerados automaticamente.`
          : data.transactionType === "installment"
            ? `${createdTransactions.length} parcelas de ${formatCurrency(createdTransactions[createdTransactions.length - 1]?.amount ?? 0)} criadas.`
            : (() => {
                const due = (createdTransactions[0] as { invoiceDueDate?: Date | null } | undefined)?.invoiceDueDate;
                return due
                  ? `Compra lançada na fatura que vence em ${new Date(due).toLocaleDateString("pt-BR")}.`
                  : "Movimentação criada com sucesso!";
              })()
      );
      
      // Salvar links se houver
      if (newTransactionLinks.length > 0 && createdTransactions[0]) {
        for (const link of newTransactionLinks) {
          try {
            await trpc.transactionLinks.add.useMutation().mutateAsync({
              transactionId: createdTransactions[0].id,
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
      
      utils.transaction.list.invalidate();
      if (keepOpen) {
        // Mantém tipo, forma, data, cartão e categoria; limpa o resto.
        reset({
          type: data.type,
          transactionType: data.transactionType,
          transactionDate: data.transactionDate,
          creditCardId: data.creditCardId,
          category: data.category,
          frequency: data.frequency,
          endDate: data.endDate,
          installments: data.installments,
          variableAmount: data.variableAmount,
          description: "",
          amount: "",
          notes: "",
        });
        setNewTransactionLinks([]);
        setNewIncomeLinks([]);
        setTimeout(() => setFocus("description"), 0);
        utils.allocation.invalidate();
        utils.invoice.invalidate();
        return;
      }
      reset({
        type: "expense",
        transactionType: "simple",
        transactionDate: getLocalDateString(),
        variableAmount: true,
      });
      setSelectedType("expense");
      setNewTransactionLinks([]);
      setOpen(false);
      utils.allocation.invalidate();
      utils.invoice.invalidate();
      utils.invoice.invalidate();
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

  // ── Filtering & sorting (hoisted so totals can be rendered outside the Card) ──
  let filteredTransactions = [...(transactions ?? [])];

  if (columnFilters.transactionDate)
    filteredTransactions = filteredTransactions.filter(t =>
      new Date(t.transactionDate).toISOString().split('T')[0] === columnFilters.transactionDate);
  if (columnFilters.description)
    filteredTransactions = filteredTransactions.filter(t =>
      matchesDescription(t.description, columnFilters.description));
  // Painel de filtros / filtro salvo: descrição, tipos, categorias, cartões e valores.
  filteredTransactions = applyFilterCriteria(filteredTransactions, advancedFilters);
  if (columnFilters.category)
    filteredTransactions = filteredTransactions.filter(t => t.category === columnFilters.category);
  if (columnFilters.recurrence)
    // Despesas fixas/variáveis (o comparativo dos relatórios é só de despesas).
    filteredTransactions = filteredTransactions.filter(t =>
      t.type !== 'income' &&
      (columnFilters.recurrence === 'fixa' ? !!t.recurrence : !t.recurrence));
  if (columnFilters.creditCardId)
    filteredTransactions = filteredTransactions.filter(t => String(t.creditCardId) === columnFilters.creditCardId);
  if (columnFilters.invoiceStatus) {
    // Situação das compras no cartão = situação da fatura em que são cobradas.
    filteredTransactions = filteredTransactions.filter(t => {
      if (t.type !== 'credit_card') return false;
      const inv = invoicesByKey.get(invoiceKey(t.creditCardId, t.competencyId));
      const paidInFull = !!inv && Number(inv.paidAmount ?? 0) + 0.005 >= Number(inv.totalAmount);
      return columnFilters.invoiceStatus === 'pago' ? paidInFull : !paidInFull;
    });
  }
  if (columnFilters.type)
    filteredTransactions = filteredTransactions.filter(t => t.type === columnFilters.type);
  if (columnFilters.allocation)
    filteredTransactions = filteredTransactions.filter(t =>
      (Number(allocationTotals[t.id] ?? 0) > 0) === (columnFilters.allocation === 'linked'));
  if (columnFilters.responsibleUserId)
    filteredTransactions = filteredTransactions.filter(t =>
      columnFilters.responsibleUserId === 'none'
        ? t.responsibleUserId == null
        : String(t.responsibleUserId) === columnFilters.responsibleUserId);
  if (columnFilters.isPaid) {
    const isPaidValue = columnFilters.isPaid === '1' ? 1 : 0;
    filteredTransactions = filteredTransactions.filter(t => t.isPaid === isPaidValue);
  }

  if (sortColumn) {
    filteredTransactions = [...filteredTransactions].sort((a, b) => {
      let aVal: any = a[sortColumn as keyof typeof a];
      let bVal: any = b[sortColumn as keyof typeof b];
      if (sortColumn === 'amount') { aVal = parseFloat(aVal); bVal = parseFloat(bVal); }
      else if (sortColumn === 'allocation') {
        // Receitas pelo que sobra; despesas pelo que falta cobrir.
        aVal = parseFloat(a.amount) - Number(allocationTotals[a.id] ?? 0);
        bVal = parseFloat(b.amount) - Number(allocationTotals[b.id] ?? 0);
      }
      else if (sortColumn === 'responsibleUserId') {
        aVal = (a.responsibleUserId != null && peopleById.get(a.responsibleUserId)?.name.toLowerCase()) || '\uffff';
        bVal = (b.responsibleUserId != null && peopleById.get(b.responsibleUserId)?.name.toLowerCase()) || '\uffff';
      }
      else if (sortColumn === 'transactionDate') { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime(); }
      else if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = bVal.toLowerCase(); }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  } else {
    // Ordem manual (arrastada) primeiro; o resto na ordem automática.
    const manualIndex = new Map<number, number>();
    if (localOrder) localOrder.forEach((id, i) => manualIndex.set(id, i));
    const manualKey = (t: Transaction) =>
      localOrder ? manualIndex.get(t.id) ?? Number.MAX_SAFE_INTEGER : t.sortOrder ?? Number.MAX_SAFE_INTEGER;
    filteredTransactions = [...filteredTransactions].sort((a, b) => {
      const ma = manualKey(a);
      const mb = manualKey(b);
      if (ma !== mb) return ma - mb;
      const aIsCC = a.type === 'credit_card';
      const bIsCC = b.type === 'credit_card';
      if (aIsCC && bIsCC) {
        const aDue = getInvoiceDueDate(a)?.getTime() ?? 0;
        const bDue = getInvoiceDueDate(b)?.getTime() ?? 0;
        if (aDue !== bDue) return aDue - bDue;
        return new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
      }
      if (aIsCC) return -1;
      if (bIsCC) return 1;
      return new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime();
    });
  }

  // Parte dos totais que ainda é estimativa (recorrências sem valor confirmado).
  const estimatedTotals = filteredTransactions.reduce(
    (acc, t) => {
      if (!t.isEstimated) return acc;
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') acc.income += amt;
      else if (t.type === 'expense') acc.expense += amt;
      else acc.creditCard += amt;
      return acc;
    },
    { income: 0, expense: 0, creditCard: 0 }
  );

  const totals = filteredTransactions.reduce(
    (acc, t) => {
      const amt = parseFloat(t.amount);
      if (t.type === 'income')       { acc.income      += amt; if (t.isPaid) acc.incomePaid      += amt; }
      else if (t.type === 'expense') { acc.expense     += amt; if (t.isPaid) acc.expensePaid     += amt; }
      else                           { acc.creditCard  += amt; if (t.isPaid) acc.creditCardPaid  += amt; }
      return acc;
    },
    { income: 0, expense: 0, creditCard: 0, incomePaid: 0, expensePaid: 0, creditCardPaid: 0 }
  );

  // Quanto das receitas filtradas já está comprometido com despesas.
  const incomeCommitted = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(allocationTotals[t.id] ?? 0), 0);

  // Quanto cada pessoa paga/recebe nos lançamentos filtrados.
  const totalsByResponsible = Array.from(
    filteredTransactions
      .reduce((acc, t) => {
        const key = t.responsibleUserId ?? 0;
        const entry = acc.get(key) ?? { id: key, pay: 0, paid: 0, receive: 0 };
        const amt = parseFloat(t.amount);
        if (t.type === 'income') entry.receive += amt;
        else { entry.pay += amt; if (t.isPaid) entry.paid += amt; }
        acc.set(key, entry);
        return acc;
      }, new Map<number, { id: number; pay: number; paid: number; receive: number }>())
      .values()
  ).sort((a, b) => b.pay - a.pay);

  // ── Compras no cartão viram uma linha por fatura (cartão + competência) ──
  type InvoiceGroup = {
    kind: "invoice";
    key: string;
    creditCardId: number;
    competencyId: number;
    items: Transaction[];
  };
  type DisplayRow = { kind: "tx"; transaction: Transaction } | InvoiceGroup;
  const displayRows: DisplayRow[] = [];
  const groupsByKey = new Map<string, InvoiceGroup>();
  for (const t of filteredTransactions) {
    if (t.type === "credit_card" && t.creditCardId) {
      const key = invoiceKey(t.creditCardId, t.competencyId);
      let group = groupsByKey.get(key);
      if (!group) {
        group = { kind: "invoice", key, creditCardId: t.creditCardId, competencyId: t.competencyId, items: [] };
        groupsByKey.set(key, group);
        displayRows.push(group);
      }
      group.items.push(t);
    } else {
      displayRows.push({ kind: "tx", transaction: t });
    }
  }
  // O "pago" do cartão vem do que foi pago na fatura.
  totals.creditCardPaid = Array.from(groupsByKey.values()).reduce((sum, g) => {
    const inv = invoicesByKey.get(g.key);
    const shown = g.items.reduce((acc, t) => acc + parseFloat(t.amount), 0);
    return sum + Math.min(Number(inv?.paidAmount ?? 0), shown);
  }, 0);

  const rowSortId = (row: DisplayRow) => (row.kind === "invoice" ? `inv:${row.key}` : `tx:${row.transaction.id}`);
  const dragDisabled = !!sortColumn;
  const dragDisabledReason = "Para arrastar, volte para a ordem manual (sem ordenação por coluna).";

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = displayRows.map(rowSortId);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const moved = arrayMove(displayRows, from, to);
    // Fatura arrastada leva todas as compras dela junto.
    const orderedIds = moved.flatMap(row => (row.kind === "invoice" ? row.items.map(t => t.id) : [row.transaction.id]));
    setLocalOrder(orderedIds);
    reorderMutation.mutate(
      { ids: orderedIds },
      {
        onSuccess: async () => {
          await utils.transaction.list.invalidate();
          setLocalOrder(null);
        },
        onError: error => {
          setLocalOrder(null);
          toast.error(error.message || "Não foi possível salvar a nova ordem");
        },
      }
    );
  };

  const renderInvoiceRow = (group: InvoiceGroup) => {
    const invoice = invoicesByKey.get(group.key);
    const card = creditCards?.find(c => c.id === group.creditCardId);
    const cardName = card?.name ?? "Cartão";
    const shown = group.items.reduce((acc, t) => acc + parseFloat(t.amount), 0);
    const total = invoice ? Number(invoice.totalAmount) : shown;
    const paid = Number(invoice?.paidAmount ?? 0);
    const open = Math.max(total - paid, 0);
    const expanded = expandedInvoices.has(group.key);
    const dueDate = invoice ? new Date(invoice.dueDate) : null;
    const status = paid <= 0 ? "open" : open < 0.005 ? "paid" : "partial";
    return (
      <SortableTr
        key={`invoice-row-${group.key}`}
        sortId={`inv:${group.key}`}
        disabled={dragDisabled}
        disabledReason={dragDisabledReason}
        className="border-b border-border bg-blue-500/5 hover:bg-blue-500/10 cursor-pointer"
        onClick={() => toggleInvoice(group.key)}
        aria-expanded={expanded}
      >
        <td className="py-3 pl-2 pr-4 whitespace-nowrap">
          <DragHandle />
          <button
            type="button"
            className="p-0.5 rounded hover:bg-muted"
            aria-label={expanded ? "Recolher compras da fatura" : "Ver compras da fatura"}
            onClick={e => {
              e.stopPropagation();
              toggleInvoice(group.key);
            }}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        <td className="py-3 px-4 text-foreground whitespace-nowrap">
          {dueDate ? (
            <>
              <span className="text-xs text-muted-foreground block leading-none">vence</span>
              {formatDate(dueDate)}
            </>
          ) : "-"}
        </td>
        <td className="py-3 px-4 text-foreground font-medium">
          Fatura {cardName}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {group.items.length} {group.items.length === 1 ? "lançamento" : "lançamentos"}
          </span>
        </td>
        <td className="py-3 px-4 text-muted-foreground">—</td>
        <td className="py-3 px-4">
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/10 text-blue-600">Fatura</span>
        </td>
        {showResponsibleColumn && <td className="py-3 px-4" />}
        <td className="py-3 px-4 text-right font-semibold text-red-600 whitespace-nowrap">
          -{formatCurrency(shown)}
          {Math.abs(shown - total) >= 0.005 && (
            <span className="block text-xs font-normal text-muted-foreground" title="Os filtros escondem parte das compras">
              de {formatCurrency(total)}
            </span>
          )}
        </td>
        {showAllocationColumn && <td className="py-3 px-4" />}
        <td className="py-3 px-4 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
          {status === "paid" ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">Paga</span>
          ) : status === "partial" ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600" title={`Pago ${formatCurrency(paid)}`}>
              Parcial · falta {formatCurrency(open)}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Aberta</span>
          )}
        </td>
        <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
          {status !== "paid" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() =>
                setPayingInvoice({
                  creditCardId: group.creditCardId,
                  competencyId: group.competencyId,
                  cardName,
                  dueDate,
                  total,
                  paid,
                })
              }
            >
              Pagar
            </Button>
          )}
        </td>
      </SortableTr>
    );
  };

  const renderTransactionRow = (transaction: Transaction, nested: boolean) => (
                    <SortableTr
                      key={transaction.id}
                      sortId={nested ? undefined : `tx:${transaction.id}`}
                      disabled={dragDisabled}
                      disabledReason={dragDisabledReason}
                      className={`border-b border-border hover:bg-muted cursor-pointer ${nested ? "bg-muted/30 text-sm" : ""}`}
                      onClick={() => {
                        setEditingTransactionId(transaction.id);
                        setShowEditIndividual(true);
                      }}
                    >
                      <td className="py-3 pl-2 pr-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {!nested && <DragHandle />}
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
                          className={`w-4 h-4 cursor-pointer align-middle ${nested ? "ml-5" : "ml-1"}`}
                        />
                      </td>
                      <td className="py-3 px-4 text-foreground">
                        {formatDate(transaction.transactionDate)}
                      </td>
                      <td className={`py-3 px-4 text-foreground ${nested ? "pl-10" : ""}`}>
                        {transaction.description || "-"}
                        {transaction.recurrence && (
                          <span
                            className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary align-middle"
                            title="Lançamento fixo (recorrente)"
                          >
                            fixa
                          </span>
                        )}
                        {(transaction.installments ?? 1) > 1 && (
                          <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">
                            {transaction.currentInstallment}/{transaction.installments}
                          </span>
                        )}
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
                      {showResponsibleColumn && (
                        <td className="py-3 px-4 text-foreground">
                          <PersonBadge
                            person={transaction.responsibleUserId != null ? peopleById.get(transaction.responsibleUserId) : null}
                          />
                        </td>
                      )}
                      <td className={`py-3 px-4 text-right font-semibold ${
                        transaction.type === "income"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}>
                        {transaction.isEstimated ? (
                          <span className="italic opacity-80" title="Valor estimado pela recorrência — confirme o valor real">
                            ≈ {transaction.type === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}
                            <span className="block text-[10px] font-medium not-italic uppercase tracking-wide text-amber-600">
                              estimado
                            </span>
                          </span>
                        ) : (
                          <>{transaction.type === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}</>
                        )}
                      </td>
                      {showAllocationColumn && (
                        <td className="py-3 px-4 text-xs whitespace-nowrap">
                          <AllocationCell
                            type={transaction.type}
                            amount={transaction.amount}
                            linked={allocationTotals[transaction.id]}
                          />
                        </td>
                      )}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {transaction.type === "credit_card" ? (
                          <span
                            className="inline-flex items-center justify-center w-4 h-4 rounded border border-border opacity-40 cursor-not-allowed"
                            title="O pagamento é feito na linha da fatura"
                          />
                        ) : (
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
                        )}
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          {transaction.isEstimated === 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => confirmAmountMutation.mutate({ id: transaction.id })}
                              disabled={confirmAmountMutation.isPending}
                              className="text-green-600 hover:text-green-700 hover:bg-green-500/10 p-1 h-auto"
                              title="Confirmar o valor estimado (para outro valor, abra a edição)"
                              aria-label="Confirmar valor"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDeletingTransactionId(transaction.id);
                              setShowDeleteIndividual(true);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
                            title="Deletar transação"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </td>
                    </SortableTr>
  );

  const TYPE_LABELS: Record<string, string> = { income: "Receitas", expense: "Despesas", credit_card: "Cartão" };
  const activeFilterChips: { key: string; label: string; keys: string[]; onRemove?: () => void }[] = [];
  // Critérios do painel de filtros / filtro salvo.
  const cardNameOf = (id: number) => creditCards?.find(c => c.id === id)?.name;
  const removeCriteria = (...keys: (keyof TransactionFilters)[]) => () => {
    const next = { ...advancedFilters };
    keys.forEach(k => delete next[k]);
    handleAdvancedFiltersChange(next);
  };
  if (advancedFilters.description?.trim())
    activeFilterChips.push({
      key: "adv-description",
      label: describeCriteria({ description: advancedFilters.description })[0],
      keys: [],
      onRemove: removeCriteria("description"),
    });
  if (selectedTypes(advancedFilters).length)
    activeFilterChips.push({
      key: "adv-types",
      label: `Tipo: ${describeCriteria({ types: selectedTypes(advancedFilters) })[0]}`,
      keys: [],
      onRemove: removeCriteria("type", "types"),
    });
  if (selectedCategories(advancedFilters).length)
    activeFilterChips.push({
      key: "adv-categories",
      label: describeCriteria({ categories: selectedCategories(advancedFilters) })[0],
      keys: [],
      onRemove: removeCriteria("category", "categories"),
    });
  if (selectedCardIds(advancedFilters).length)
    activeFilterChips.push({
      key: "adv-cards",
      label: describeCriteria({ creditCardIds: selectedCardIds(advancedFilters) }, cardNameOf)[0],
      keys: [],
      onRemove: removeCriteria("creditCardId", "creditCardIds"),
    });
  if (advancedFilters.minAmount != null || advancedFilters.maxAmount != null)
    activeFilterChips.push({
      key: "adv-amount",
      label: describeCriteria({ minAmount: advancedFilters.minAmount, maxAmount: advancedFilters.maxAmount })[0],
      keys: [],
      onRemove: removeCriteria("minAmount", "maxAmount"),
    });
  if (columnFilters.description)
    activeFilterChips.push({
      key: "col-description",
      label: describeCriteria({ description: columnFilters.description })[0],
      keys: ["description"],
    });
  if (filterStartDate || filterEndDate) {
    const br = (d: string) => new Date(`${d}T00:00`).toLocaleDateString("pt-BR");
    activeFilterChips.push({
      key: "dates",
      label: filterStartDate && filterEndDate
        ? `De ${br(filterStartDate)} a ${br(filterEndDate)}`
        : filterStartDate ? `A partir de ${br(filterStartDate)}` : `Até ${br(filterEndDate)}`,
      keys: [],
      onRemove: () => { setFilterStartDate(""); setFilterEndDate(""); },
    });
  }
  if (columnFilters.type) {
    activeFilterChips.push({
      key: "type",
      label: TYPE_LABELS[columnFilters.type] ?? columnFilters.type,
      // Tirar o tipo "cartão" também tira os filtros que só valem para cartão.
      keys: columnFilters.type === "credit_card" ? ["type", "creditCardId", "invoiceStatus"] : ["type"],
    });
  }
  if (columnFilters.creditCardId) {
    const card = creditCards?.find(c => String(c.id) === columnFilters.creditCardId);
    activeFilterChips.push({ key: "card", label: `Cartão ${card?.name ?? columnFilters.creditCardId}`, keys: ["creditCardId"] });
  }
  if (columnFilters.isPaid) {
    const label =
      columnFilters.type === "income"
        ? columnFilters.isPaid === "1" ? "Recebidas" : "A receber"
        : columnFilters.isPaid === "1" ? "Pagos" : "Em aberto";
    activeFilterChips.push({ key: "isPaid", label, keys: ["isPaid"] });
  }
  if (columnFilters.invoiceStatus) {
    activeFilterChips.push({
      key: "invoiceStatus",
      label: columnFilters.invoiceStatus === "pago" ? "Fatura paga" : "Fatura em aberto",
      keys: ["invoiceStatus"],
    });
  }
  if (columnFilters.recurrence) {
    activeFilterChips.push({
      key: "recurrence",
      label: columnFilters.recurrence === "fixa" ? "Despesas fixas" : "Despesas variáveis",
      keys: ["recurrence"],
    });
  }
  if (columnFilters.category) {
    activeFilterChips.push({ key: "category", label: `Categoria: ${columnFilters.category}`, keys: ["category"] });
  }
  if (columnFilters.responsibleUserId) {
    const person = peopleById.get(Number(columnFilters.responsibleUserId));
    activeFilterChips.push({
      key: "responsible",
      label: `Responsável: ${columnFilters.responsibleUserId === "none" ? "ninguém" : person?.name ?? "?"}`,
      keys: ["responsibleUserId"],
    });
  }
  if (columnFilters.allocation) {
    activeFilterChips.push({
      key: "allocation",
      label: columnFilters.allocation === "linked" ? "Com vínculo" : "Sem vínculo",
      keys: ["allocation"],
    });
  }

  // Categorias para o filtro: as cadastradas e as já usadas nos lançamentos.
  const filterCategoryOptions = Array.from(
    new Set([
      ...(allTypologies ?? []).filter(t => t.isActive !== 0).map(t => t.name),
      ...(transactions ?? []).map(t => t.category),
    ].filter((c): c is string => !!c))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const hasActiveFilters =
    !!filterStartDate || !!filterEndDate ||
    countCriteria(advancedFilters) > 0 ||
    Object.keys(columnFilters).length > 0;

  return (
    <DashboardLayoutCustom title="Movimentações">
      <LoadingOverlay
        isVisible={createMutation.isPending}
        message="Salvando movimentação"
        details="Aguarde enquanto processamos sua transação..."
        status="loading"
      />

      <div className="space-y-4 pb-24">
        {/* Toolbar: period navigation + new transaction */}
        <div className="flex items-center justify-between gap-4">
          {/* Period navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="radiogroup"
              aria-label="Exibir lançamentos por"
              className="inline-flex rounded-md border border-border p-0.5 bg-muted/40"
            >
              {([
                ["competency", "Competência", "Agrupa pela competência (cartões entram no mês da fatura)"],
                ["monthly", "Mensal", "Agrupa pelo mês da data de cada lançamento"],
              ] as const).map(([mode, label, hint]) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={viewMode === mode}
                  title={hint}
                  onClick={() => changeViewMode(mode)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    viewMode === mode
                      ? "bg-background shadow-sm font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={goPrev} title="Período anterior">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="min-w-[160px] text-center select-none leading-tight">
              <span className="block text-base font-semibold">{activeCompetency?.name ?? "..."}</span>
              <span className="block text-xs text-muted-foreground">
                {viewMode === "monthly" ? "mês do calendário" : "competência"}
              </span>
            </span>
            <Button variant="outline" size="icon" onClick={goNext} title="Próximo período">
              <ChevronRight className="w-4 h-4" />
            </Button>
            {!isCurrentPeriod && (
              <Button variant="outline" size="sm" onClick={goCurrent} title="Ir para o período atual">
                <CalendarDays className="w-4 h-4 mr-1" />
                Mês Atual
              </Button>
            )}
          </div>

          {/* Add Transaction Dialog */}
          <Dialog open={open} onOpenChange={setOpen}>
            {/* Botão flutuante: fica visível ao rolar a tela */}
            <DialogTrigger asChild>
              <Button
                className="fixed bottom-6 right-6 z-40 h-14 rounded-full px-5 shadow-lg hover:shadow-xl bg-primary text-primary-foreground hover:bg-primary/90"
                title="Nova movimentação"
                aria-label="Nova movimentação"
              >
                <Plus className="w-6 h-6 sm:mr-2" />
                <span className="hidden sm:inline">Nova Movimentação</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] gap-0 p-0 bg-surface-raised text-foreground border-white/10 overflow-hidden">
              {/* Header fixo */}
              <DialogHeader className="px-6 pt-5 pb-4 border-b border-white/10 bg-black/20 shrink-0">
                <DialogTitle className="text-foreground">Nova Movimentação</DialogTitle>
                <p className="text-xs text-muted-foreground">Comece pela descrição; os campos com * são obrigatórios.</p>
              </DialogHeader>

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
                {/* Corpo rolável — scroll vertical quando necessário, sem overflow horizontal */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-5">
                {/* Description */}
                <div>
                  <label className="form-label">
                    Descrição
                  </label>
                  <input
                    {...register("description")}
                    type="text"
                    autoFocus
                    placeholder="Ex.: Conta de luz, Mercado, Salário"
                    className="input-elegant w-full"
                  />
                </div>

                {/* Type Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">
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
                    <label className="form-label">
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

                {/* Valor e data lado a lado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Amount */}
                  <div>
                    <label className="form-label">
                      {watchTransactionType === "installment" ? "Valor total da compra" : "Valor"} <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        {...register("amount")}
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        className="input-elegant w-full pr-10"
                      />
                      <CalculatorPopover
                        value={watchAmount}
                        onApply={value =>
                          setValue("amount", value, { shouldValidate: true, shouldDirty: true })
                        }
                      />
                    </div>
                    {errors.amount && <p className="text-red-600 text-sm mt-1">{errors.amount.message}</p>}
                  </div>
                {/* Date */}
                  <div>
                    <label className="form-label">
                      {watchTransactionType === "installment" ? "Data da compra (1ª parcela)" : "Data"} <span className="text-red-600">*</span>
                    </label>
                    <input
                      {...register("transactionDate")}
                      type="date"
                      className="input-elegant w-full"
                    />
                    {errors.transactionDate && <p className="text-red-600 text-sm mt-1">{errors.transactionDate.message}</p>}
                  </div>
                </div>

                {/* Credit Card Selection - Required for credit_card type */}
                {watchType === "credit_card" && (
                  <div>
                    <label className="form-label">
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

                {/* Category with Add Option */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="form-label mb-0">
                      Categoria
                    </label>
                    <AddCategoryModal
                      transactionType={selectedType}
                      parentCategories={(allTypologies ?? [])
                        .filter((t) => t.type === selectedType && t.parentId == null)
                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
                        .map((t) => ({ id: t.id, name: t.name }))}
                      onSuccess={(name) => {
                        refetchTypologies();
                        setPendingNewCategory(name);
                      }}
                    />
                  </div>
                  <select
                    {...register("category")}
                    className="input-elegant w-full"
                  >
                    <option value="">Selecione uma categoria</option>
                    {(() => {
                      const typeTypologies = (allTypologies ?? []).filter(
                        (t) => t.type === selectedType
                      );
                      const topLevel = typeTypologies
                        .filter((t) => t.parentId == null)
                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
                      const result: React.ReactNode[] = [];
                      for (const parent of topLevel) {
                        result.push(
                          <option key={parent.id} value={parent.name}>
                            {parent.name}
                          </option>
                        );
                        const children = typeTypologies
                          .filter((t) => t.parentId === parent.id)
                          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
                        for (const child of children) {
                          result.push(
                            <option key={child.id} value={child.name}>
                              {"  ↳ "}{child.name}
                            </option>
                          );
                        }
                      }
                      return result;
                    })()}
                  </select>
                  {errors.category && <p className="text-red-600 text-sm mt-1">{errors.category.message}</p>}
                </div>

                {/* Responsável pelo pagamento */}
                <div>
                  <label htmlFor="responsibleUserId" className="form-label">
                    {watchType === "income" ? "Quem recebe" : "Responsável pelo pagamento"}
                  </label>
                  <ResponsibleSelect
                    id="responsibleUserId"
                    value={responsibleUserId}
                    onChange={setResponsibleUserId}
                  />
                  {!showResponsible && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Adicione pessoas em <a href={`${import.meta.env.BASE_URL}workspaces`} className="text-primary hover:underline">Áreas e pessoas</a> para dividir as contas.
                    </p>
                  )}
                </div>

                {/* Recurring Options */}
                {watchTransactionType === "recurring" && (
                  <>
                    <div>
                      <label className="form-label">
                        Frequência <span className="text-red-600">*</span>
                      </label>
                      <select
                        {...register("frequency")}
                        className="input-elegant w-full"
                        required
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

                    <div>
                      <label className="form-label">
                        Data limite <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                      </label>
                      <input
                        {...register("endDate")}
                        type="date"
                        min={watch("transactionDate") || undefined}
                        className="input-elegant w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Em branco, repete sem fim. Os lançamentos são gerados com 1 mês de antecedência.
                      </p>
                      {errors.endDate && <p className="text-red-600 text-sm mt-1">{errors.endDate.message}</p>}
                    </div>

                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="mt-0.5 w-4 h-4" {...register("variableAmount")} />
                      <span>
                        O valor muda a cada mês
                        <span className="block text-xs text-muted-foreground">
                          Os próximos lançamentos aparecem como <strong>valor estimado</strong> até você confirmar o valor real.
                        </span>
                      </span>
                    </label>
                  </>
                )}

                {/* Installment Options */}
                {watchTransactionType === "installment" && (
                  <div>
                    <label className="form-label">
                      Número de Parcelas <span className="text-red-600">*</span>
                    </label>
                    <input
                      {...register("installments")}
                      type="number"
                      min="2"
                      max="72"
                      placeholder="Ex: 3"
                      className="input-elegant w-full"
                    />
                    {errors.installments && <p className="text-red-600 text-sm mt-1">{errors.installments.message}</p>}
                    {Number(watchInstallments) >= 2 && Number(watchAmount) > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {watchInstallments}x de {formatCurrency(Math.floor((Number(watchAmount) * 100) / Number(watchInstallments)) / 100)}
                        {watchType === "credit_card" ? " — uma parcela em cada fatura" : " — uma parcela por mês"}
                      </p>
                    )}
                  </div>
                )}

                {/* Receita que paga esta despesa */}
                {canLinkIncome && (
                  <div>
                    <label className="form-label">
                      Pago com a receita
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Opcional: de qual receita sai o dinheiro. Pode dividir entre várias.
                    </p>
                    <IncomeLinksEditor
                      expenseAmount={watchAmount}
                      value={newIncomeLinks}
                      onChange={setNewIncomeLinks}
                    />
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="form-label">
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
                  <label className="form-label">
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
                    <div className="grid grid-cols-1 gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Título do link"
                          id="linkTitle"
                          className="input-elegant w-full"
                        />
                        <input
                          type="url"
                          placeholder="URL"
                          id="linkUrl"
                          className="input-elegant w-full"
                        />
                      </div>
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
                        className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm font-medium w-full"
                      >
                        Adicionar Link
                      </button>
                    </div>
                  </div>
                </div>

                </div>{/* fim do corpo rolável */}

                {/* Footer fixo */}
                <div className="shrink-0 px-6 py-4 border-t border-white/10 bg-black/20 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="flex-1"
                    disabled={isSaving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="secondary"
                    className="flex-1"
                    title="Salva e deixa o formulário aberto para lançar outra"
                    onClick={() => {
                      continueAfterSave.current = true;
                    }}
                    disabled={isSaving}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Salvar e nova
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      continueAfterSave.current = false;
                    }}
                    disabled={isSaving}
                  >
                    {isSaving ? (
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

        {/* Totalizadores — sticky abaixo do header da página */}
        {transactions && transactions.length > 0 && (
          <div className="sticky top-0 z-10 -mx-8 px-8 pt-2 pb-3 bg-background/95 backdrop-blur-sm border-b border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <p className="text-xs text-muted-foreground">Receitas</p>
                <p className="text-base font-semibold text-green-600">+{formatCurrency(totals.income)}</p>
                <p className="text-xs text-muted-foreground">Pago: {formatCurrency(totals.incomePaid)}</p>
                {estimatedTotals.income > 0 && (
                  <p className="text-xs text-amber-600">inclui ≈ {formatCurrency(estimatedTotals.income)} estimado</p>
                )}
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg">
                <p className="text-xs text-muted-foreground">Despesas</p>
                <p className="text-base font-semibold text-red-600">-{formatCurrency(totals.expense)}</p>
                <p className="text-xs text-muted-foreground">Pago: {formatCurrency(totals.expensePaid)}</p>
                {estimatedTotals.expense > 0 && (
                  <p className="text-xs text-amber-600">inclui ≈ {formatCurrency(estimatedTotals.expense)} estimado</p>
                )}
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <p className="text-xs text-muted-foreground">Cartão</p>
                <p className="text-base font-semibold text-blue-600">-{formatCurrency(totals.creditCard)}</p>
                <p className="text-xs text-muted-foreground">Pago: {formatCurrency(totals.creditCardPaid)}</p>
                {estimatedTotals.creditCard > 0 && (
                  <p className="text-xs text-amber-600">inclui ≈ {formatCurrency(estimatedTotals.creditCard)} estimado</p>
                )}
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className={`text-base font-semibold ${totals.income - totals.expense - totals.creditCard >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totals.income - totals.expense - totals.creditCard)}
                </p>
                {incomeCommitted > 0 && (
                  <p className="text-xs text-muted-foreground" title="Receitas ainda não vinculadas a despesas">
                    Receitas livres: {formatCurrency(totals.income - incomeCommitted)}
                  </p>
                )}
              </div>
            </div>
            {showResponsible && totalsByResponsible.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {totalsByResponsible.map(entry => {
                  const person = entry.id ? peopleById.get(entry.id) : null;
                  const active = columnFilters.responsibleUserId === (entry.id ? String(entry.id) : 'none');
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleColumnFilter('responsibleUserId', active ? undefined : entry.id ? String(entry.id) : 'none')}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${
                        active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                      }`}
                      title="Filtrar por responsável"
                    >
                      <PersonBadge person={person} fallback="Sem responsável" className="font-medium" />
                      {entry.pay > 0 && (
                        <span className="text-red-600">
                          paga {formatCurrency(entry.pay)}
                          <span className="text-muted-foreground"> (pago {formatCurrency(entry.paid)})</span>
                        </span>
                      )}
                      {entry.receive > 0 && <span className="text-green-600">recebe {formatCurrency(entry.receive)}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Compras antigas na fatura errada (correção com prévia) */}
        <MisplacedPurchasesBanner />

        {/* Filtros ativos (inclusive os vindos do dashboard) */}
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Filtrando por:</span>
            {activeFilterChips.map(chip => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1"
              >
                {chip.label}
                <button
                  type="button"
                  className="ml-1 rounded-full hover:bg-primary/20 px-1"
                  aria-label={`Remover filtro ${chip.label}`}
                  onClick={() => chip.onRemove ? chip.onRemove() : chip.keys.forEach(k => handleColumnFilter(k, undefined))}
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                setColumnFilters({});
                setFilterPriority([]);
                handleAdvancedFiltersChange({});
                setFilterStartDate("");
                setFilterEndDate("");
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}

        {/* Transactions List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">
              Movimentações - {activeCompetency?.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {hasCustomRange
                  ? "(período dos filtros)"
                  : viewMode === "monthly"
                    ? "(por data do lançamento)"
                    : "(por competência)"}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(v => !v)}
                className={hasActiveFilters ? "border-primary text-primary" : ""}
              >
                <Filter className="w-4 h-4 mr-1.5" />
                Filtros
                {hasActiveFilters && (
                  <span className="ml-1.5 w-2 h-2 rounded-full bg-primary inline-block" />
                )}
                {showFilters ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
              </Button>
              {sortColumn && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortColumn(null)}
                  title="Voltar para a ordem manual (arrastando as linhas)"
                >
                  Ordem manual
                </Button>
              )}
              <ColumnSelector columns={columns} onColumnsChange={handleColumnsChange} onSort={handleSort} />
            </div>
          </div>

          {/* Filters — colapsável */}
          {showFilters && (
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

              <AdvancedFilters
                embedded
                filters={advancedFilters}
                onFiltersChange={handleAdvancedFiltersChange}
                creditCards={creditCards}
                categoryOptions={filterCategoryOptions}
                onClearFilters={() => handleAdvancedFiltersChange({})}
              />

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm font-medium text-muted-foreground">Filtros Salvos:</span>
                <SavedFiltersSelector
                  currentDates={{ startDate: filterStartDate, endDate: filterEndDate }}
                  currentCriteria={advancedFilters}
                  onApply={applySavedFilter}
                  cardName={cardNameOf}
                />
              </div>
            </div>
          )}

          {transactions && transactions.length > 0 ? (
            <>
              {filteredTransactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                      <thead className="border-b border-border">
                        <tr>
                          <th className="text-left py-3 pl-2 pr-4 font-semibold text-foreground whitespace-nowrap">
                            <span className="inline-block w-5" aria-hidden />
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
                          {showResponsibleColumn && (
                            <th className="text-left py-3 px-4">
                              <ColumnHeader
                                label="Responsável"
                                columnId="responsibleUserId"
                                sortColumn={sortColumn}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                                onFilter={handleColumnFilter}
                                filterType="select"
                                filterOptions={[
                                  ...people.map(p => ({ label: p.name, value: String(p.id) })),
                                  { label: "Sem responsável", value: "none" },
                                ]}
                                currentFilterValue={columnFilters.responsibleUserId}
                              />
                            </th>
                          )}
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
                          {showAllocationColumn && (
                            <th className="text-left py-3 px-4">
                              <ColumnHeader
                                label="Receita"
                                columnId="allocation"
                                sortColumn={sortColumn}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                                onFilter={handleColumnFilter}
                                filterType="select"
                                filterOptions={[
                                  { label: "Com vínculo", value: "linked" },
                                  { label: "Sem vínculo", value: "unlinked" },
                                ]}
                                currentFilterValue={columnFilters.allocation}
                              />
                            </th>
                          )}
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
                      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={displayRows.map(rowSortId)} strategy={verticalListSortingStrategy}>
                      <tbody>
                        {displayRows.map(row =>
                          row.kind === "invoice" ? (
                            <React.Fragment key={`invoice-${row.key}`}>
                              {renderInvoiceRow(row)}
                              {expandedInvoices.has(row.key) &&
                                row.items.map(t => renderTransactionRow(t, true))}
                            </React.Fragment>
                          ) : (
                            renderTransactionRow(row.transaction, false)
                          )
                        )}
                      </tbody>
                      </SortableContext>
                      </DndContext>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma movimentação no período selecionado
                  </p>
                )}
            </>
          ) : (
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
          onTransfer={() => setShowTransfer(true)}
        />

        {/* Transferir para outra área de trabalho */}
        <TransferTransactionsDialog
          open={showTransfer}
          ids={selectedTransactionIds}
          onClose={() => setShowTransfer(false)}
          onDone={() => setSelectedTransactionIds([])}
        />

        {/* Bulk Edit Modal */}
        <BulkEditModal
          isOpen={showBulkEdit}
          selectedIds={selectedTransactionIds}
          onClose={() => setShowBulkEdit(false)}
          onSuccess={() => {
            setSelectedTransactionIds([]);
            utils.transaction.list.invalidate();
            utils.allocation.invalidate();
            utils.invoice.invalidate();
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
            utils.allocation.invalidate();
            utils.invoice.invalidate();
          }}
        />

        {/* Individual Edit Modal */}
        <InvoicePaymentDialog invoice={payingInvoice} onClose={() => setPayingInvoice(null)} />
        <EditTransactionModal
          isOpen={showEditIndividual}
          transactionId={editingTransactionId}
          onClose={() => {
            setShowEditIndividual(false);
            setEditingTransactionId(null);
          }}
          onSuccess={() => {
            utils.transaction.list.invalidate();
            utils.allocation.invalidate();
            utils.invoice.invalidate();
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
            utils.allocation.invalidate();
            utils.invoice.invalidate();
          }}
        />
      </div>
    </DashboardLayoutCustom>
  );
}

/** Célula da coluna "Receita": o que sobra da receita ou quanto da despesa está coberto. */
function AllocationCell({
  type,
  amount,
  linked,
}: {
  type: string;
  amount: string;
  linked: string | undefined;
}) {
  const total = parseFloat(amount) || 0;
  const used = Number(linked ?? 0);
  if (type === "income") {
    if (!used) return <span className="text-muted-foreground">Livre</span>;
    const left = total - used;
    return (
      <span className={left < 0 ? "text-red-600" : "text-green-600"} title={`Comprometido ${formatCurrency(used)}`}>
        Sobra {formatCurrency(left)}
      </span>
    );
  }
  if (!used) return <span className="text-muted-foreground">—</span>;
  if (used >= total) return <span className="text-green-600">Coberta</span>;
  return (
    <span className="text-amber-600" title={`Coberto ${formatCurrency(used)} de ${formatCurrency(total)}`}>
      Falta {formatCurrency(total - used)}
    </span>
  );
}
