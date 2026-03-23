import React, { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatting";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export default function Reports() {
  const { data: currentCompetency } = trpc.competency.current.useQuery();
  const { data: transactions, isLoading } = trpc.transaction.list.useQuery(
    { competencyId: currentCompetency?.id || 0 },
    { enabled: !!currentCompetency }
  );
  const { data: allCompetencies } = trpc.competency.list.useQuery();

  // Calculate summary for current competency
  const summary = useMemo(() => {
    if (!transactions) return { income: 0, expense: 0, creditCard: 0 };

    let income = 0;
    let expense = 0;
    let creditCard = 0;

    transactions.forEach(t => {
      const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
      if (t.type === "income") income += amount;
      else if (t.type === "expense") expense += amount;
      else if (t.type === "credit_card") creditCard += amount;
    });

    return { income, expense, creditCard };
  }, [transactions]);

  // Category breakdown
  const categoryData = useMemo(() => {
    if (!transactions) return [];

    const categories: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.type !== "income") {
        const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
        if (!categories[t.category]) categories[t.category] = 0;
        categories[t.category] += amount;
      }
    });

    return Object.entries(categories).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  }, [transactions]);

  // Type breakdown
  const typeData = useMemo(() => {
    return [
      { name: "Receitas", value: summary.income },
      { name: "Despesas", value: summary.expense },
      { name: "Cartão", value: summary.creditCard },
    ].filter(item => item.value > 0);
  }, [summary]);

  if (isLoading) {
    return (
      <DashboardLayoutCustom>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayoutCustom>
    );
  }

  return (
    <DashboardLayoutCustom title="Relatórios Financeiros">
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Total de Receitas</p>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(summary.income)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Total de Despesas</p>
            <p className="text-3xl font-bold text-red-600">
              {formatCurrency(summary.expense)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Cartão de Crédito</p>
            <p className="text-3xl font-bold text-blue-600">
              {formatCurrency(summary.creditCard)}
            </p>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Type Distribution */}
          {typeData.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Distribuição por Tipo
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Category Distribution */}
          {categoryData.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Distribuição por Categoria
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                  <YAxis stroke="var(--muted-foreground)" />
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>

        {/* Category Breakdown Table */}
        {categoryData.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Detalhamento por Categoria
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Categoria</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">Valor</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryData.map((item) => {
                    const total = categoryData.reduce((sum, cat) => sum + cat.value, 0);
                    const percentage = (item.value / total) * 100;

                    return (
                      <tr key={item.name} className="border-b border-border hover:bg-muted">
                        <td className="py-3 px-4 text-foreground">{item.name}</td>
                        <td className="py-3 px-4 text-right font-semibold text-foreground">
                          {formatCurrency(item.value)}
                        </td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {percentage.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {transactions && transactions.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Sem dados para exibir</p>
            <p className="text-sm text-muted-foreground">
              Crie lançamentos para visualizar relatórios
            </p>
          </Card>
        )}
      </div>
    </DashboardLayoutCustom>
  );
}
