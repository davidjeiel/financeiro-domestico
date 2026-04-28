import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatting";
import { TrendingUp, TrendingDown, CreditCard, DollarSign } from "lucide-react";

export default function Dashboard() {
  const { data: currentCompetency, isLoading: competencyLoading } =
    trpc.competency.current.useQuery();

  const { data: transactions, isLoading: transactionsLoading } =
    trpc.transaction.list.useQuery(
      { competencyId: currentCompetency?.id || 0 },
      { enabled: !!currentCompetency }
    );

  const { data: creditCards } = trpc.creditCard.list.useQuery();

  // Calculate summary
  const summary = useMemo(() => {
    if (!transactions) return { 
      income: 0, 
      expense: 0, 
      creditCard: 0, 
      balance: 0,
      incomePaid: 0,
      expensePaid: 0,
      creditCardPaid: 0,
    };

    let income = 0;
    let expense = 0;
    let creditCard = 0;
    let incomePaid = 0;
    let expensePaid = 0;
    let creditCardPaid = 0;

    transactions.forEach(t => {
      const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
      if (t.type === "income") {
        income += amount;
        if (t.isPaid) incomePaid += amount;
      }
      else if (t.type === "expense") {
        expense += amount;
        if (t.isPaid) expensePaid += amount;
      }
      else if (t.type === "credit_card") {
        creditCard += amount;
        if (t.isPaid) creditCardPaid += amount;
      }
    });

    return {
      income,
      expense,
      creditCard,
      balance: income - expense - creditCard,
      incomePaid,
      expensePaid,
      creditCardPaid,
    };
  }, [transactions]);

  // Group transactions by category
  const transactionsByCategory = useMemo(() => {
    if (!transactions) return {};
    const grouped: Record<string, typeof transactions> = {};
    transactions.forEach(t => {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t);
    });
    return grouped;
  }, [transactions]);

  if (competencyLoading) {
    return (
      <DashboardLayoutCustom>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayoutCustom>
    );
  }

  return (
    <DashboardLayoutCustom title={`Dashboard - ${currentCompetency?.name}`}>
      <div className="space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <SummaryCard
            title="Receitas"
            amount={summary.income}
            amountPaid={summary.incomePaid}
            icon={<TrendingUp className="w-5 h-5" />}
            color="text-green-600"
            bgColor="bg-green-50"
          />
          <SummaryCard
            title="Despesas"
            amount={summary.expense}
            amountPaid={summary.expensePaid}
            icon={<TrendingDown className="w-5 h-5" />}
            color="text-red-600"
            bgColor="bg-red-50"
          />
          <SummaryCard
            title="Cartão de Crédito"
            amount={summary.creditCard}
            amountPaid={summary.creditCardPaid}
            icon={<CreditCard className="w-5 h-5" />}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
          <SummaryCard
            title="Saldo"
            amount={summary.balance}
            icon={<DollarSign className="w-5 h-5" />}
            color={summary.balance >= 0 ? "text-green-600" : "text-red-600"}
            bgColor={summary.balance >= 0 ? "bg-green-50" : "bg-red-50"}
          />
        </div>

        {/* Transactions by Category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Lançamentos Recentes
            </h2>
            {transactionsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.slice(0, 5).map(t => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{t.description || t.category}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(t.transactionDate).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <p
                      className={`font-semibold ${
                        t.type === "income"
                          ? "text-green-600"
                          : t.type === "expense"
                          ? "text-red-600"
                          : "text-blue-600"
                      }`}
                    >
                      {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhum lançamento nesta competência
              </p>
            )}
          </Card>

          {/* Credit Cards */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Cartões de Crédito
            </h2>
            {creditCards && creditCards.length > 0 ? (
              <div className="space-y-3">
                {creditCards.map(card => (
                  <div
                    key={card.id}
                    className="p-4 rounded-lg border border-border"
                    style={{ borderLeftColor: card.color || "#3B82F6", borderLeftWidth: "4px" }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{card.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Corte: dia {card.cutoffDay} | Vencimento: dia {card.dueDay}
                        </p>
                      </div>
                      {card.limit && (
                        <p className="text-sm font-semibold text-foreground">
                          Limite: {formatCurrency(card.limit)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhum cartão cadastrado
              </p>
            )}
          </Card>
        </div>

        {/* Category Breakdown */}
        {Object.keys(transactionsByCategory).length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Distribuição por Categoria
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(transactionsByCategory).map(([category, items]) => {
                const total = items.reduce((sum, t) => {
                  const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
                  return sum + amount;
                }, 0);

                return (
                  <div key={category} className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-foreground mb-2">{category}</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(total)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {items.length} lançamento{items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayoutCustom>
  );
}

interface SummaryCardProps {
  title: string;
  amount: number;
  amountPaid?: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

function SummaryCard({ title, amount, amountPaid, icon, color, bgColor }: SummaryCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-2">{title}</p>
          <p className="text-3xl font-bold text-foreground">
            {formatCurrency(amount)}
          </p>
          {amountPaid !== undefined && (
            <p className="text-sm text-muted-foreground mt-2">
              Pago: {formatCurrency(amountPaid)}
            </p>
          )}
        </div>
        <div className={`${bgColor} ${color} p-3 rounded-lg`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
