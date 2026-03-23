import React from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/formatting";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

export default function Invoices() {
  const { data: currentCompetency } = trpc.competency.current.useQuery();
  const { data: invoices, isLoading } = trpc.invoice.list.useQuery(
    { competencyId: currentCompetency?.id || 0 },
    { enabled: !!currentCompetency }
  );

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

  return (
    <DashboardLayoutCustom title="Faturas de Cartão">
      <div className="space-y-6">
        {invoices && invoices.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Fatura #{invoice.id}
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

                <div className="grid grid-cols-3 gap-4 mb-4">
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
                    <p className={`text-2xl font-bold ${
                      (Number(invoice.totalAmount) - Number(invoice.paidAmount || 0)) > 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}>
                      {formatCurrency(Number(invoice.totalAmount) - Number(invoice.paidAmount || 0))}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all"
                    style={{
                      width: `${(Number(invoice.paidAmount || 0) / Number(invoice.totalAmount)) * 100}%`,
                    }}
                  />
                </div>
              </Card>
            ))}
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
