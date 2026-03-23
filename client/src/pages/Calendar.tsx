import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/formatting";
import ReactCalendar from "react-calendar";
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Clock } from "lucide-react";
import "react-calendar/dist/Calendar.css";

type DateType = Date | null;

export default function Calendar() {
  const { data: currentCompetency } = trpc.competency.current.useQuery();
  const { data: transactions, isLoading } = trpc.transaction.list.useQuery(
    { competencyId: currentCompetency?.id || 0 },
    { enabled: !!currentCompetency }
  );
  const { data: invoices } = trpc.invoice.list.useQuery(
    { competencyId: currentCompetency?.id || 0 },
    { enabled: !!currentCompetency }
  );

  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewType, setViewType] = useState<"month" | "year">("month");

  // Create a map of dates with their events
  const dateEvents = useMemo(() => {
    const events: Record<string, Array<{ type: string; title: string; amount: string; status?: string }>> = {};

    if (transactions) {
      transactions.forEach((t) => {
        const dateKey = new Date(t.transactionDate).toISOString().split("T")[0];
        if (!events[dateKey]) events[dateKey] = [];
        events[dateKey].push({
          type: "transaction",
          title: t.description || t.category,
          amount: formatCurrency(t.amount),
          status: t.type,
        });
      });
    }

    if (invoices) {
      invoices.forEach((inv) => {
        const dateKey = new Date(inv.dueDate).toISOString().split("T")[0];
        if (!events[dateKey]) events[dateKey] = [];
        events[dateKey].push({
          type: "invoice",
          title: `Fatura #${inv.id}`,
          amount: formatCurrency(inv.totalAmount),
          status: inv.status,
        });
      });
    }

    return events;
  }, [transactions, invoices]);

  // Get events for selected date
  const selectedDateKey = selectedDate instanceof Date
    ? selectedDate.toISOString().split("T")[0]
    : null;

  const selectedDateEvents = selectedDateKey ? dateEvents[selectedDateKey] || [] : [];

  const tileClassName = ({ date }: { date: Date }) => {
    const dateKey = date.toISOString().split("T")[0];
    const hasEvents = dateEvents[dateKey];
    if (hasEvents) {
      return "has-events";
    }
    return "";
  };

  const tileContent = ({ date }: { date: Date }) => {
    const dateKey = date.toISOString().split("T")[0];
    const events = dateEvents[dateKey];
    if (events && events.length > 0) {
      return (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
          {events.slice(0, 3).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
          ))}
        </div>
      );
    }
    return null;
  };

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
    <DashboardLayoutCustom title="Calendário">
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                {currentCompetency?.name}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewType("month")}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    viewType === "month"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  Mês
                </button>
                <button
                  onClick={() => setViewType("year")}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    viewType === "year"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  Ano
                </button>
              </div>
            </div>

            <style>{`
              .react-calendar {
                background: transparent;
                border: none;
                font-family: inherit;
              }
              .react-calendar__navigation {
                margin-bottom: 1.5rem;
              }
              .react-calendar__navigation button {
                color: var(--foreground);
                font-size: 1rem;
                font-weight: 600;
                padding: 0.5rem;
                border-radius: 0.5rem;
              }
              .react-calendar__navigation button:hover {
                background-color: var(--muted);
              }
              .react-calendar__month-view__weekdays {
                margin-bottom: 1rem;
              }
              .react-calendar__month-view__weekdays__weekday {
                color: var(--muted-foreground);
                font-weight: 600;
                padding: 0.5rem;
                text-align: center;
                text-transform: uppercase;
                font-size: 0.75rem;
              }
              .react-calendar__month-view__days {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 0.5rem;
              }
              .react-calendar__tile {
                aspect-ratio: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: var(--card);
                border: 1px solid var(--border);
                border-radius: 0.5rem;
                color: var(--foreground);
                font-weight: 500;
                position: relative;
                cursor: pointer;
                transition: all 0.2s;
              }
              .react-calendar__tile:hover {
                background-color: var(--muted);
                border-color: var(--primary);
              }
              .react-calendar__tile--active {
                background-color: var(--primary);
                color: var(--primary-foreground);
                border-color: var(--primary);
              }
              .react-calendar__tile--now {
                border-color: var(--primary);
              }
              .react-calendar__tile--hasContent {
                border-color: var(--primary);
              }
              .react-calendar__month-view__days__day--neighboringMonth {
                color: var(--muted-foreground);
                opacity: 0.5;
              }
            `}</style>

            <ReactCalendar
              onChange={(value) => {
                if (value instanceof Date) {
                  setSelectedDate(value);
                }
              }}
              value={selectedDate}
              view={viewType}
              tileClassName={tileClassName}
              tileContent={tileContent}
              prevLabel={<ChevronLeft className="w-4 h-4" />}
              nextLabel={<ChevronRight className="w-4 h-4" />}
              prev2Label={null}
              next2Label={null}
            />
          </Card>

          {/* Events Sidebar */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {selectedDate instanceof Date
                ? formatDate(selectedDate)
                : "Selecione uma data"}
            </h3>

            {selectedDateEvents.length > 0 ? (
              <div className="space-y-3">
                {selectedDateEvents.map((event, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {event.type === "invoice" ? (
                          event.status === "paid" ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : event.status === "partial" ? (
                            <Clock className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )
                        ) : (
                          <div className={`w-3 h-3 rounded-full ${
                            event.status === "income"
                              ? "bg-green-500"
                              : event.status === "expense"
                              ? "bg-red-500"
                              : "bg-blue-500"
                          }`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {event.title}
                        </p>
                        <p className={`text-sm font-semibold ${
                          event.status === "income"
                            ? "text-green-500"
                            : event.status === "expense"
                            ? "text-red-500"
                            : "text-blue-500"
                        }`}>
                          {event.amount}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">
                  Nenhum evento nesta data
                </p>
              </div>
            )}

            {/* Summary */}
            <div className="mt-6 pt-6 border-t border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-semibold text-foreground">
                  {selectedDateEvents.length > 0
                    ? formatCurrency(
                        selectedDateEvents.reduce((sum, e) => {
                          const amount = parseFloat(e.amount.replace(/[^\d.-]/g, ""));
                          return sum + amount;
                        }, 0)
                      )
                    : "-"}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Legend */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Legenda</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-muted-foreground">Receita</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-muted-foreground">Despesa</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-muted-foreground">Cartão</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Paga</span>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayoutCustom>
  );
}
