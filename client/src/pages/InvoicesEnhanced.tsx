import React, { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/formatting";
import { AlertCircle, CheckCircle, Clock, ChevronLeft, ChevronRight, CalendarDays, Pencil, Trash2, CreditCard } from "lucide-react";
import EditTransactionModal from "@/components/EditTransactionModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ColumnSelector, ColumnConfig } from "@/components/ColumnSelector";
import { ColumnHeader } from "@/components/ColumnHeader";
import { toast } from "sonner";

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "date", label: "Data", visible: true },
  { id: "description", label: "Descrição", visible: true },
  { id: "category", label: "Categoria", visible: true },
  { id: "amount", label: "Valor", visible: true },
];

interface InvoiceFilters {
  creditCardId?: string;
  category?: string;
  description?: string;
}

export default function InvoicesEnhanced() {
  const { data: currentCompetency } = trpc.competency.current.useQuery();
  const utils = trpc.useUtils();

  // Period navigation state
  const [navYear, setNavYear] = useState<number | null>(null);
  const [navMonth, setNavMonth] = useState<number | null>(null);

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

  const syncMutation = trpc.invoice.sync.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });

  const { data: invoices, isLoading: invoicesLoading } = trpc.invoice.list.useQuery(
    { competencyId: activeCompetency?.id || 0 },
    { enabled: !!activeCompetency }
  );

  const { data: creditCards } = trpc.creditCard.list.useQuery();
  const { data: transactions, isLoading: transactionsLoading } = trpc.transaction.list.useQuery(
    { competencyId: activeCompetency?.id || 0 },
    { enabled: !!activeCompetency }
  );

  // Sincroniza faturas ao mudar de período
  useEffect(() => {
    if (activeCompetency && !syncMutation.isPending) {
      syncMutation.mutate({ competencyId: activeCompetency.id });
    }
  }, [activeCompetency?.id]);

  // Obter cartão com maior limite como padrão
  const defaultCreditCardId = useMemo(() => {
    if (!creditCards || creditCards.length === 0) return undefined;
    const maxCard = creditCards.reduce((max, card) => 
      (parseFloat(card.limit || "0") || 0) > (parseFloat(max.limit || "0") || 0) ? card : max
    );
    return maxCard.id.toString();
  }, [creditCards]);

  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<number | null>(null);

  // Payment dialog state
  const [payingInvoice, setPayingInvoice] = useState<{ id: number; total: number; paid: number } | null>(null);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState("");

  const deleteMutation = trpc.transaction.delete.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      if (activeCompetency) syncMutation.mutate({ competencyId: activeCompetency.id });
      toast.success("Lançamento excluído!");
    },
    onError: () => toast.error("Erro ao excluir lançamento"),
  });

  const payMutation = trpc.invoice.pay.useMutation({
    onSuccess: () => {
      utils.invoice.list.invalidate();
      setPayingInvoice(null);
      toast.success("Pagamento registrado!");
    },
    onError: () => toast.error("Erro ao registrar pagamento"),
  });

  const handlePay = () => {
    if (!payingInvoice) return;
    const amount = paymentType === "full"
      ? payingInvoice.total
      : parseFloat(partialAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    payMutation.mutate({ invoiceId: payingInvoice.id, paidAmount: amount });
  };

  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [filters, setFilters] = useState<InvoiceFilters>({
    creditCardId: defaultCreditCardId,
    category: undefined,
    description: undefined,
  });
  const [sortBy, setSortBy] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "partial":
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "paid":
        return "Paga";
      case "partial":
        return "Parcial";
      default:
        return "Aberta";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700";
      case "partial":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-red-100 text-red-700";
    }
  };

  const getCreditCardName = (cardId: number) => {
    return creditCards?.find((c) => c.id === cardId)?.name || `Cartão ${cardId}`;
  };

  const getInvoiceTransactions = (invoice: any) => {
    if (!transactions || !invoice) return [];
    // Transações já são da mesma competência; basta casar pelo cartão
    return transactions.filter(
      (t) =>
        t.type === "credit_card" &&
        t.creditCardId === invoice.creditCardId &&
        (!filters.creditCardId || t.creditCardId === parseInt(filters.creditCardId)) &&
        (!filters.category || t.category === filters.category) &&
        (!filters.description || t.description?.toLowerCase().includes(filters.description.toLowerCase()))
    );
  };

  const handleColumnSort = (columnId: string, direction: "asc" | "desc") => {
    setSortBy({ column: columnId, direction });
  };

  const sortTransactions = (txs: typeof transactions | undefined) => {
    if (!sortBy || !txs) return txs || [];

    const sorted = [...txs].sort((a, b) => {
      let aVal: any = a[sortBy.column as keyof typeof a];
      let bVal: any = b[sortBy.column as keyof typeof b];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (sortBy.direction === "asc") {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return sorted;
  };

  // Obter categorias únicas das transações de cartão
  const availableCategories = useMemo(() => {
    if (!transactions) return [];
    const categories = new Set(
      transactions
        .filter((t) => t.type === "credit_card")
        .map((t) => t.category)
        .filter(Boolean)
    );
    return Array.from(categories).sort();
  }, [transactions]);

  if (invoicesLoading || transactionsLoading) {
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
    <DashboardLayoutCustom title="Faturas de Cartão">
      <div className="space-y-6">
        {/* Navegação de período */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev} title="Período anterior">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-base font-semibold min-w-[160px] text-center select-none">
            {activeCompetency?.name ?? "..."}
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

        {/* Filtros e Seletor de Colunas */}
        <div className="flex gap-4 items-center flex-wrap">
          <ColumnSelector columns={columns} onColumnsChange={setColumns} />
          
          {/* Seletor de Cartão */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Cartão:</label>
            <select
              value={filters.creditCardId || ""}
              onChange={(e) => setFilters({ ...filters, creditCardId: e.target.value || undefined })}
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            >
              {creditCards?.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name} (Limite: {formatCurrency(parseFloat(card.limit || "0") || 0)})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Categoria */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Categoria:</label>
            <select
              value={filters.category || ""}
              onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })}
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            >
              <option value="">Todas</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Descrição */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Descrição:</label>
            <input
              type="text"
              placeholder="Buscar..."
              value={filters.description || ""}
              onChange={(e) => setFilters({ ...filters, description: e.target.value || undefined })}
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            />
          </div>

          <Button
            variant="outline"
            onClick={() => {
              setFilters({
                creditCardId: defaultCreditCardId,
                category: undefined,
                description: undefined,
              });
              setSortBy(null);
            }}
          >
            Limpar Filtros
          </Button>
        </div>

        {/* Faturas */}
        {invoices && invoices.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {invoices.map((invoice) => {
              const invoiceTxs = getInvoiceTransactions(invoice);
              const sortedTxs = sortTransactions(invoiceTxs);

              return (
                <Card key={invoice.id} className="p-6">
                  {/* Header da Fatura */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {getCreditCardName(invoice.creditCardId || 0)} - Fatura #{invoice.id}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Fechamento: {formatDate(invoice.closingDate)} | Vencimento: {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusIcon(invoice.status)}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                        {getStatusLabel(invoice.status)}
                      </span>
                      {invoice.status !== "paid" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setPayingInvoice({
                              id: invoice.id,
                              total: Number(invoice.totalAmount),
                              paid: Number(invoice.paidAmount || 0),
                            });
                            setPaymentType("full");
                            setPartialAmount("");
                          }}
                        >
                          <CreditCard className="w-4 h-4 mr-1" />
                          Pagar Fatura
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Resumo Financeiro */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
                      <p className="text-2xl font-bold text-foreground">
                        {formatCurrency(invoice.totalAmount)}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Valor Pago</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(invoice.paidAmount || 0)}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Saldo</p>
                      <p
                        className={`text-2xl font-bold ${
                          Number(invoice.totalAmount) - Number(invoice.paidAmount || 0) > 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {formatCurrency(Number(invoice.totalAmount) - Number(invoice.paidAmount || 0))}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden mb-6">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{
                        width: `${(Number(invoice.paidAmount || 0) / Number(invoice.totalAmount)) * 100}%`,
                      }}
                    />
                  </div>

                  {/* Transações da Fatura */}
                  {sortedTxs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            {columns.map(
                              (col) =>
                                col.visible && (
                                  <th key={col.id} className="py-3 px-4 text-left font-semibold text-foreground">
                                    <ColumnHeader
                                      label={col.label}
                                      columnId={col.id}
                                      sortColumn={sortBy?.column}
                                      sortOrder={sortBy?.direction}
                                      onSort={(colId, dir) => handleColumnSort(colId, dir)}
                                    />
                                  </th>
                                )
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedTxs.map((transaction) => (
                            <tr
                              key={transaction.id}
                              className="border-b border-border hover:bg-muted cursor-pointer group"
                              onClick={() => setEditingTransactionId(transaction.id)}
                            >
                              {columns.map(
                                (col) =>
                                  col.visible && (
                                    <td key={`${transaction.id}-${col.id}`} className="py-3 px-4 text-foreground">
                                      {col.id === "date" && formatDate(transaction.transactionDate)}
                                      {col.id === "description" && (transaction.description || "-")}
                                      {col.id === "category" && transaction.category}
                                      {col.id === "amount" && (
                                        <span className="font-semibold text-red-600">
                                          -{formatCurrency(transaction.amount)}
                                        </span>
                                      )}
                                    </td>
                                  )
                              )}
                              <td className="py-3 px-2 w-16" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                  <button
                                    onClick={() => {
                                      if (confirm("Excluir este lançamento?")) {
                                        setDeletingTransactionId(transaction.id);
                                        deleteMutation.mutate({ id: transaction.id });
                                      }
                                    }}
                                    className="text-red-500 hover:text-red-700 p-0.5 rounded"
                                    title="Excluir lançamento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Nenhuma transação nesta fatura</p>
                  )}

                  {/* Detalhamento do gasto */}
                  {sortedTxs.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Detalhamento do período
                      </p>
                      <div className="space-y-1">
                        {sortedTxs.map((t) => (
                          <div key={t.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground truncate max-w-[60%]">
                              {formatDate(t.transactionDate)} · {t.description || t.category}
                            </span>
                            <span className="font-medium text-foreground">{formatCurrency(t.amount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border mt-2">
                          <span>Total dos lançamentos</span>
                          <span className="text-red-600">
                            {formatCurrency(sortedTxs.reduce((s, t) => s + Number(t.amount), 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Nenhuma fatura nesta competência</p>
            <p className="text-sm text-muted-foreground">
              Crie lançamentos de cartão de crédito para gerar faturas
            </p>
          </Card>
        )}
      </div>

      {/* Dialog de pagamento de fatura */}
      <Dialog open={payingInvoice !== null} onOpenChange={(o) => !o && setPayingInvoice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {payingInvoice && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total da fatura</span>
                  <span className="font-semibold">{formatCurrency(payingInvoice.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Já pago</span>
                  <span className="font-semibold text-green-600">{formatCurrency(payingInvoice.paid)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1">
                  <span className="text-muted-foreground">Saldo restante</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(payingInvoice.total - payingInvoice.paid)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentType("full")}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    paymentType === "full"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  Pagamento Total
                </button>
                <button
                  onClick={() => setPaymentType("partial")}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    paymentType === "partial"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  Pagamento Parcial
                </button>
              </div>

              {paymentType === "full" && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-sm text-center">
                  Será registrado o pagamento de{" "}
                  <span className="font-bold">{formatCurrency(payingInvoice.total)}</span>
                </div>
              )}

              {paymentType === "partial" && (
                <div className="space-y-2">
                  <Label>Valor pago</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={payingInvoice.total}
                    placeholder="0,00"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setPayingInvoice(null)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handlePay}
                  disabled={payMutation.isPending || (paymentType === "partial" && !partialAmount)}
                >
                  {payMutation.isPending ? "Salvando..." : "Confirmar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditTransactionModal
        isOpen={editingTransactionId !== null}
        transactionId={editingTransactionId}
        onClose={() => setEditingTransactionId(null)}
        onSuccess={() => {
          utils.transaction.list.invalidate();
          if (activeCompetency) syncMutation.mutate({ competencyId: activeCompetency.id });
        }}
      />
    </DashboardLayoutCustom>
  );
}
