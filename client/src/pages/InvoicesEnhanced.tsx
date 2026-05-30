import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/formatting";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdvancedFilters, TransactionFilters } from "@/components/AdvancedFilters";
import { ColumnSelector, ColumnConfig } from "@/components/ColumnSelector";
import { ColumnHeader } from "@/components/ColumnHeader";

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "date", label: "Data", visible: true },
  { id: "description", label: "Descrição", visible: true },
  { id: "category", label: "Categoria", visible: true },
  { id: "type", label: "Tipo", visible: true },
  { id: "amount", label: "Valor", visible: true },
];

export default function InvoicesEnhanced() {
  const { data: currentCompetency } = trpc.competency.current.useQuery();
  const { data: invoices, isLoading: invoicesLoading } = trpc.invoice.list.useQuery(
    { competencyId: currentCompetency?.id || 0 },
    { enabled: !!currentCompetency }
  );

  const { data: creditCards } = trpc.creditCard.list.useQuery();
  const { data: transactions, isLoading: transactionsLoading } = trpc.transaction.list.useQuery(
    { competencyId: currentCompetency?.id || 0 },
    { enabled: !!currentCompetency }
  );

  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [filters, setFilters] = useState<TransactionFilters>({
    category: undefined,
    type: undefined,
    creditCardId: undefined,
    description: undefined,
  });
  const [columnFilters, setColumnFilters] = useState<Record<string, string | undefined>>({});
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

  const getInvoiceTransactions = (invoiceId: number) => {
    if (!transactions) return [];
    return transactions.filter(
      (t) =>
        t.type === "credit_card" &&
        (!filters.creditCardId || t.creditCardId === parseInt(filters.creditCardId)) &&
        (!filters.category || t.category === filters.category) &&
        (!filters.type || t.type === filters.type) &&
        (!filters.description || t.description?.toLowerCase().includes(filters.description.toLowerCase()))
    );
  };

  const handleColumnSort = (columnId: string, direction: "asc" | "desc") => {
    setSortBy({ column: columnId, direction });
  };

  const handleColumnFilter = (columnId: string, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [columnId]: value || undefined,
    }));
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
        {/* Filtros e Seletor de Colunas */}
        <div className="flex gap-4 items-center">
          <ColumnSelector columns={columns} onColumnsChange={setColumns} />
          <AdvancedFilters filters={filters} onFiltersChange={setFilters} />
          <Button
            variant="outline"
            onClick={() => {
              setFilters({
                category: undefined,
                type: undefined,
                creditCardId: undefined,
                description: undefined,
              });
              setColumnFilters({});
            }}
          >
            Limpar Filtros
          </Button>
        </div>

        {/* Faturas */}
        {invoices && invoices.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {invoices.map((invoice) => {
              const invoiceTxs = getInvoiceTransactions(invoice.id);
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
                    <div className="flex items-center gap-2">
                      {getStatusIcon(invoice.status)}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                        {getStatusLabel(invoice.status)}
                      </span>
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
                                      onFilter={(colId, val) => handleColumnFilter(colId, val || "")}
                                    />
                                  </th>
                                )
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedTxs.map((transaction) => (
                            <tr key={transaction.id} className="border-b border-border hover:bg-muted">
                              {columns.map(
                                (col) =>
                                  col.visible && (
                                    <td key={`${transaction.id}-${col.id}`} className="py-3 px-4 text-foreground">
                                      {col.id === "date" && formatDate(transaction.transactionDate)}
                                      {col.id === "description" && (transaction.description || "-")}
                                      {col.id === "category" && transaction.category}
                                      {col.id === "type" && (
                                        <span
                                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                                            transaction.type === "income"
                                              ? "bg-green-500/10 text-green-600"
                                              : transaction.type === "expense"
                                              ? "bg-red-500/10 text-red-600"
                                              : "bg-blue-500/10 text-blue-600"
                                          }`}
                                        >
                                          {transaction.type === "income"
                                            ? "Receita"
                                            : transaction.type === "expense"
                                            ? "Despesa"
                                            : "Cartão"}
                                        </span>
                                      )}
                                      {col.id === "amount" && (
                                        <span
                                          className={`font-semibold ${
                                            transaction.type === "income" ? "text-green-600" : "text-red-600"
                                          }`}
                                        >
                                          {transaction.type === "income" ? "+" : "-"}
                                          {formatCurrency(transaction.amount)}
                                        </span>
                                      )}
                                    </td>
                                  )
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Nenhuma transação nesta fatura</p>
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
    </DashboardLayoutCustom>
  );
}
