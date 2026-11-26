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
  // Opcional: em branco, repete sem fim.
  endDate: z.string().optional(),
  variableAmount: z.boolean().optional(),
}).refine(data => !data.endDate || data.endDate >= data.startDate, {
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
  // Recorrências gravadas na planilha (regras e séries antigas).
  const { data: recurrences = [] } = trpc.recurrence.list.useQuery();
  const endRecurrence = trpc.recurrence.end.useMutation();
  const continueSeries = trpc.recurrence.continueSeries.useMutation();
  const [installments, setInstallments] = useState<any[]>([]);
  const createRecurringMutation = trpc.transaction.createRecurring.useMutation();
  const createInstallmentsMutation = trpc.transaction.createInstallments.useMutation();
  const utils = trpc.useUtils();

  const recurringForm = useForm<RecurringFormData>({
    resolver: zodResolver(recurringSchema),
    defaultValues: { variableAmount: true },
  });

  const refreshAll = () =>
    Promise.all([utils.recurrence.invalidate(), utils.transaction.invalidate(), utils.invoice.invalidate()]);

  const handleEnd = async (groupKey: string, description: string) => {
    if (!window.confirm(`Encerrar "${description}" hoje? Os lançamentos futuros ainda não pagos serão removidos.`)) return;
    try {
      const { removed } = await endRecurrence.mutateAsync({ groupKey });
      await refreshAll();
      toast.success(removed ? `Recorrência encerrada; ${removed} lançamento(s) futuro(s) removido(s).` : "Recorrência encerrada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível encerrar");
    }
  };

  const handleContinue = async (groupKey: string) => {
    try {
      await continueSeries.mutateAsync({ groupKey });
      await refreshAll();
      toast.success("A série agora continua sem data final.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar a série");
    }
  };

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
        endDate: data.endDate || null,
        variableAmount: data.variableAmount !== false,
      });
      await refreshAll();
      toast.success(
        `${created.length} lançamento(s) gerado(s) até o mês que vem; os próximos são gerados automaticamente.`
      );
      recurringForm.reset({ variableAmount: true });
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
                    Data limite <span className="text-xs font-normal text-muted-foreground">(opcional — em branco, sem fim)</span>
                  </label>
                  <Input
                    {...recurringForm.register("endDate")}
                    type="date"
                    min={recurringForm.watch("startDate") || undefined}
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

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="mt-0.5 w-4 h-4" {...recurringForm.register("variableAmount")} />
                <span>
                  O valor muda a cada mês
                  <span className="block text-xs text-muted-foreground">
                    Os lançamentos aparecem como valor estimado até você confirmar o valor real.
                  </span>
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                Os lançamentos são gerados com 1 ano (12 meses) de antecedência; os seguintes aparecem automaticamente.
              </p>

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

          {/* Recorrências gravadas na planilha */}
          {recurrences.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Débitos/Créditos Fixos</h3>
              <div className="space-y-3">
                {recurrences.map(r => (
                  <div
                    key={r.groupKey}
                    className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-border bg-card ${
                      r.ended ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-[14rem]">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-medium text-foreground">{r.description}</p>
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                          r.type === "income" ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
                        }`}>
                          {r.type === "income" ? "Receita" : r.type === "credit_card" ? "Cartão" : "Despesa"}
                        </span>
                        {r.kind === "rule" && !r.endDate && !r.ended && (
                          <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">sem data final</span>
                        )}
                        {r.ended && <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">encerrada</span>}
                        {r.pendingConfirmation > 0 && (
                          <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-600">
                            {r.pendingConfirmation} com valor estimado
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {r.variableAmount ? "≈ " : ""}R$ {r.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <span>{frequencyLabels[r.frequency as keyof typeof frequencyLabels] ?? r.frequency}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          desde {new Date(r.startDate).toLocaleDateString("pt-BR")}
                        </span>
                        {r.endDate && <span>até {new Date(r.endDate).toLocaleDateString("pt-BR")}</span>}
                        {r.nextDate && !r.ended && (
                          <span>próximo: {new Date(r.nextDate).toLocaleDateString("pt-BR")}</span>
                        )}
                        <span>{r.count} lançamento(s) gerado(s)</span>
                        <span>{r.category}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.kind === "legacy" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleContinue(r.groupKey)}
                          disabled={continueSeries.isPending}
                          title="Criada com data final: passa a continuar automaticamente"
                        >
                          Continuar sem data final
                        </Button>
                      )}
                      {r.kind === "rule" && !r.ended && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => handleEnd(r.groupKey, r.description)}
                          disabled={endRecurrence.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Encerrar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Para mudar o valor dos próximos meses, edite um lançamento da série e marque
                "Aplicar aos próximos meses".
              </p>
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
