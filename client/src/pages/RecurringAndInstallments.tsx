import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Calendar, DollarSign } from "lucide-react";

const recurringSchema = z.object({
  description: z.string().min(1, "Descrição obrigatória"),
  type: z.enum(["income", "expense"]),
  amount: z.string().min(1, "Valor obrigatório").refine(value => Number(value) > 0, "Valor deve ser positivo"),
  category: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "annual"]),
  startDate: z.string().min(1, "Data inicial obrigatória"),
  endDate: z.string().min(1, "Data limite obrigatória"),
}).refine(data => data.endDate >= data.startDate, {
  path: ["endDate"],
  message: "A data limite deve ser igual ou posterior à data inicial",
});

const installmentSchema = z.object({
  description: z.string().min(1, "Descrição obrigatória"),
  totalAmount: z.string().min(1, "Valor total obrigatório"),
  totalInstallments: z.string().min(1, "Número de parcelas obrigatório"),
  category: z.string().optional(),
  startDate: z.string().min(1, "Data inicial obrigatória"),
});

type RecurringFormData = z.infer<typeof recurringSchema>;
type InstallmentFormData = z.infer<typeof installmentSchema>;

function formatInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
}

export default function RecurringAndInstallments() {
  const [recurringTransactions, setRecurringTransactions] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const createRecurringMutation = trpc.transaction.createRecurring.useMutation();
  const createInstallmentsMutation = trpc.transaction.createInstallments.useMutation();
  const utils = trpc.useUtils();

  const recurringForm = useForm<RecurringFormData>({
    resolver: zodResolver(recurringSchema),
  });

  const installmentForm = useForm<InstallmentFormData>({
    resolver: zodResolver(installmentSchema),
  });

  const onRecurringSubmit = async (data: RecurringFormData) => {
    try {
      const created = await createRecurringMutation.mutateAsync({
        type: data.type,
        category: data.category?.trim() || "Outros",
        description: data.description,
        amount: Number(data.amount).toString(),
        frequency: data.frequency,
        startDate: data.startDate,
        endDate: data.endDate,
      });
      const newRecurring = {
        id: Date.now(),
        ...data,
        amount: parseFloat(data.amount),
        isActive: true,
        occurrenceCount: created.length,
      };
      setRecurringTransactions(current => [...current, newRecurring]);
      utils.transaction.list.invalidate();
      utils.invoice.list.invalidate();
      toast.success(`${created.length} lançamentos recorrentes criados.`);
      recurringForm.reset();
    } catch (error) {
      console.error("Erro ao criar débito/crédito fixo:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao criar débito/crédito fixo");
    }
  };

  const onInstallmentSubmit = async (data: InstallmentFormData) => {
    try {
      const totalAmount = parseFloat(data.totalAmount);
      const totalInstallments = parseInt(data.totalInstallments);
      if (!(totalAmount > 0) || !(totalInstallments >= 2)) {
        toast.error("Informe o valor total e pelo menos 2 parcelas");
        return;
      }
      // Grava uma parcela por mês na planilha, com o valor dividido.
      const created = await createInstallmentsMutation.mutateAsync({
        type: "expense",
        category: data.category || "Outros",
        description: data.description,
        totalAmount: totalAmount.toFixed(2),
        installments: totalInstallments,
        firstDate: data.startDate,
      });
      const newInstallment = {
        id: Date.now(),
        ...data,
        totalAmount,
        totalInstallments,
        installmentAmount: created[created.length - 1]?.amount ?? (totalAmount / totalInstallments).toFixed(2),
        currentInstallment: 1,
        isActive: true,
      };
      setInstallments([...installments, newInstallment]);
      utils.transaction.list.invalidate();
      toast.success(`${created.length} parcelas lançadas`);
      installmentForm.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar parcelamento");
    }
  };

  const frequencyLabels = {
    daily: "Diariamente",
    weekly: "Semanalmente",
    biweekly: "Quinzenalmente",
    monthly: "Mensalmente",
    quarterly: "Trimestralmente",
    annual: "Anualmente",
  };

  return (
    <DashboardLayoutCustom title="Débitos/Créditos Fixos e Parcelamentos">
      <Tabs defaultValue="recurring" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recurring">Débitos/Créditos Fixos</TabsTrigger>
          <TabsTrigger value="installments">Parcelamentos</TabsTrigger>
        </TabsList>

        {/* Débitos/Créditos Fixos */}
        <TabsContent value="recurring" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Criar Débito/Crédito Fixo</h2>

            <form onSubmit={recurringForm.handleSubmit(onRecurringSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Descrição</label>
                  <Input
                    {...recurringForm.register("description")}
                    placeholder="Ex: Aluguel, Salário"
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Tipo</label>
                  <select
                    {...recurringForm.register("type")}
                    className="input-elegant w-full"
                  >
                    <option value="income">Receita</option>
                    <option value="expense">Despesa</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Valor (R$)</label>
                  <Input
                    {...recurringForm.register("amount")}
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Frequência</label>
                  <select
                    {...recurringForm.register("frequency")}
                    className="input-elegant w-full"
                  >
                    <option value="daily">Diariamente</option>
                    <option value="weekly">Semanalmente</option>
                    <option value="biweekly">Quinzenalmente</option>
                    <option value="monthly">Mensalmente</option>
                    <option value="quarterly">Trimestralmente</option>
                    <option value="annual">Anualmente</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Data Inicial</label>
                  <Input
                    {...recurringForm.register("startDate")}
                    type="date"
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Data limite <span className="text-red-600">*</span>
                  </label>
                  <Input
                    {...recurringForm.register("endDate")}
                    type="date"
                    min={recurringForm.watch("startDate") || undefined}
                    required
                    className="input-elegant"
                  />
                  {recurringForm.formState.errors.endDate && (
                    <p className="text-red-600 text-sm mt-1">
                      {recurringForm.formState.errors.endDate.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Categoria</label>
                  <Input
                    {...recurringForm.register("category")}
                    placeholder="Ex: Salário, Aluguel"
                    className="input-elegant"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={createRecurringMutation.isPending}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                {createRecurringMutation.isPending ? "Gerando lançamentos..." : "Criar Débito/Crédito Fixo"}
              </Button>
            </form>
          </Card>

          {/* Lista de Débitos/Créditos Fixos */}
          {recurringTransactions.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Débitos/Créditos Ativos</h3>
              <div className="space-y-3">
                {recurringTransactions.map(recurring => (
                  <div
                    key={recurring.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted transition-all"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground">{recurring.description}</p>
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                          recurring.type === "income"
                            ? "bg-green-500/20 text-green-600"
                            : "bg-red-500/20 text-red-600"
                        }`}>
                          {recurring.type === "income" ? "Receita" : "Despesa"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          R$ {parseFloat(recurring.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <span>{frequencyLabels[recurring.frequency as keyof typeof frequencyLabels]}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatInputDate(recurring.startDate)}
                        </span>
                        <span>
                          até {formatInputDate(recurring.endDate)}
                        </span>
                        <span>{recurring.occurrenceCount} lançamentos gerados</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRecurringTransactions(recurringTransactions.filter(r => r.id !== recurring.id))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Parcelamentos */}
        <TabsContent value="installments" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Criar Parcelamento</h2>

            <form onSubmit={installmentForm.handleSubmit(onInstallmentSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Descrição</label>
                  <Input
                    {...installmentForm.register("description")}
                    placeholder="Ex: Compra no Mercado"
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Valor Total (R$)</label>
                  <Input
                    {...installmentForm.register("totalAmount")}
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Número de Parcelas</label>
                  <Input
                    {...installmentForm.register("totalInstallments")}
                    type="number"
                    min="1"
                    max="36"
                    placeholder="12"
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Data Inicial</label>
                  <Input
                    {...installmentForm.register("startDate")}
                    type="date"
                    className="input-elegant"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground mb-2 block">Categoria</label>
                  <Input
                    {...installmentForm.register("category")}
                    placeholder="Ex: Eletrônicos, Móveis"
                    className="input-elegant"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Criar Parcelamento
              </Button>
            </form>
          </Card>

          {/* Lista de Parcelamentos */}
          {installments.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Parcelamentos Ativos</h3>
              <div className="space-y-3">
                {installments.map(installment => (
                  <div
                    key={installment.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted transition-all"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-1">{installment.description}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Total: R$ {parseFloat(installment.totalAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <span>
                          {installment.currentInstallment}/{installment.totalInstallments} parcelas
                        </span>
                        <span>
                          R$ {parseFloat(installment.installmentAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} por parcela
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setInstallments(installments.filter(i => i.id !== installment.id))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayoutCustom>
  );
}
