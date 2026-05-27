import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/formatting";
import { Plus, Trash2, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import LoadingOverlay from "@/components/LoadingOverlay";
import TransactionLinksManager from "@/components/TransactionLinksManager";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const transactionSchema = z.object({
  type: z.enum(["income", "expense", "credit_card"]),
  category: z.string().min(1, "Categoria é obrigatória"),
  description: z.string().optional(),
  amount: z.string().min(1, "Valor é obrigatório"),
  transactionDate: z.string().min(1, "Data é obrigatória"),
  creditCardId: z.string().optional(),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

const CATEGORIES = {
  income: ["Salário", "Freelance", "Investimentos", "Outros"],
  expense: ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Lazer", "Outros"],
  credit_card: ["Alimentação", "Compras", "Serviços", "Outros"],
};

export default function Transactions() {
  const { data: currentCompetency } = trpc.competency.current.useQuery();
  const { data: transactions, isLoading } = trpc.transaction.list.useQuery(
    { competencyId: currentCompetency?.id || 0 },
    { enabled: !!currentCompetency }
  );
  const { data: creditCards } = trpc.creditCard.list.useQuery();
  const createMutation = trpc.transaction.create.useMutation();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"income" | "expense" | "credit_card">("expense");
  const [newTransactionId, setNewTransactionId] = useState<number | null>(null);
  const [links, setLinks] = useState<Array<{ url: string; title?: string; description?: string }>>([]);
  const setLinksMutation = trpc.transactionLinks.setAll.useMutation();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "expense",
      transactionDate: new Date().toISOString().split("T")[0],
    },
  });

  const watchType = watch("type");

  const onSubmit = async (data: TransactionFormData) => {
    if (!currentCompetency) return;

    try {
      const result = await createMutation.mutateAsync({
        competencyId: currentCompetency.id,
        type: data.type,
        category: data.category,
        description: data.description,
        amount: data.amount,
        transactionDate: new Date(data.transactionDate),
        creditCardId: data.creditCardId ? parseInt(data.creditCardId) : undefined,
        notes: data.notes,
      });

      // Se houver links a salvar, salve-os
      if (links.length > 0 && result?.id) {
        try {
          await setLinksMutation.mutateAsync({
            transactionId: result.id,
            links: links,
          });
        } catch (linkError) {
          console.warn("Erro ao salvar links:", linkError);
        }
      }

      toast.success("Lançamento criado com sucesso!");
      reset();
      setLinks([]);
      setNewTransactionId(null);
      setOpen(false);
      utils.transaction.list.invalidate({ competencyId: currentCompetency.id });
    } catch (error) {
      toast.error("Erro ao criar lançamento");
      console.error("Erro ao criar lançamento:", error);
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
    <DashboardLayoutCustom title="Lançamentos">
      <LoadingOverlay
        isVisible={createMutation.isPending}
        message="Salvando lançamento"
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
                Novo Lançamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Lançamento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Type Selection */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Tipo
                  </label>
                  <select
                    {...register("type")}
                    onChange={(e) => {
                      setSelectedType(e.target.value as typeof selectedType);
                      register("type").onChange(e);
                    }}
                    className="input-elegant w-full"
                  >
                    <option value="income">Receita</option>
                    <option value="expense">Despesa</option>
                    <option value="credit_card">Cartão de Crédito</option>
                  </select>
                  {errors.type && <p className="text-red-600 text-sm mt-1">{errors.type.message}</p>}
                </div>

                {/* Category */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Categoria
                  </label>
                  <select
                    {...register("category")}
                    className="input-elegant w-full"
                  >
                    <option value="">Selecione uma categoria</option>
                    {CATEGORIES[watchType as keyof typeof CATEGORIES]?.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {errors.category && <p className="text-red-600 text-sm mt-1">{errors.category.message}</p>}
                </div>

                {/* Credit Card (if applicable) */}
                {watchType === "credit_card" && creditCards && creditCards.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Cartão de Crédito
                    </label>
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
                    placeholder="Descrição do lançamento"
                    className="input-elegant w-full"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Valor
                  </label>
                  <input
                    {...register("amount")}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="input-elegant w-full"
                  />
                  {errors.amount && <p className="text-red-600 text-sm mt-1">{errors.amount.message}</p>}
                </div>

                {/* Date */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Data
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
                    rows={3}
                  />
                </div>

                {/* Links Manager */}
                <div className="border-t pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-muted-foreground" />
                        <label className="text-sm font-medium text-foreground">Links Relacionados</label>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={(e) => {
                          e.preventDefault();
                          // Toggle link input form
                          const linkInput = document.getElementById('new-link-url');
                          if (linkInput) {
                            linkInput.focus();
                          }
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Link
                      </Button>
                    </div>

                    {/* Quick Link Input */}
                    <div className="space-y-2 p-3 bg-muted rounded-lg">
                      <input
                        id="new-link-url"
                        type="url"
                        placeholder="https://exemplo.com"
                        className="input-elegant w-full text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const urlInput = e.currentTarget;
                            const titleInput = document.getElementById('new-link-title') as HTMLInputElement;
                            if (urlInput.value.trim()) {
                              try {
                                new URL(urlInput.value);
                                setLinks([...links, {
                                  url: urlInput.value,
                                  title: titleInput?.value || undefined,
                                }]);
                                urlInput.value = '';
                                if (titleInput) titleInput.value = '';
                                toast.success('Link adicionado!');
                              } catch {
                                toast.error('URL inválida');
                              }
                            }
                          }
                        }}
                      />
                      <input
                        id="new-link-title"
                        type="text"
                        placeholder="Título do link (opcional)"
                        className="input-elegant w-full text-sm"
                      />
                    </div>

                    {/* Links List */}
                    {links.length > 0 && (
                      <div className="space-y-2">
                        {links.map((link, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-2 p-2 bg-muted rounded border border-border text-sm"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {link.title || link.url}
                              </p>
                              {link.title && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {link.url}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.preventDefault();
                                setLinks(links.filter((_, i) => i !== idx));
                                toast.success('Link removido');
                              }}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="flex-1"
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
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Lançamentos - {currentCompetency?.name}
          </h2>
          {transactions && transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Data</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Descrição</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Categoria</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Tipo</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-border hover:bg-muted">
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
                            ? "bg-green-100 text-green-700"
                            : transaction.type === "expense"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Nenhum lançamento nesta competência
            </p>
          )}
        </Card>
      </div>
    </DashboardLayoutCustom>
  );
}
