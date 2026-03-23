import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatting";
import { Plus, Edit2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const creditCardSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  lastDigits: z.string().optional(),
  cutoffDay: z.string().min(1, "Dia do corte é obrigatório"),
  dueDay: z.string().min(1, "Dia do vencimento é obrigatório"),
  limit: z.string().optional(),
  color: z.string().optional(),
});

type CreditCardFormData = z.infer<typeof creditCardSchema>;

const COLORS = [
  "#3B82F6", // Blue
  "#EF4444", // Red
  "#10B981", // Green
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
];

export default function CreditCards() {
  const { data: creditCards, isLoading } = trpc.creditCard.list.useQuery();
  const createMutation = trpc.creditCard.create.useMutation();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreditCardFormData>({
    resolver: zodResolver(creditCardSchema),
  });

  const onSubmit = async (data: CreditCardFormData) => {
    try {
      await createMutation.mutateAsync({
        name: data.name,
        lastDigits: data.lastDigits,
        cutoffDay: parseInt(data.cutoffDay),
        dueDay: parseInt(data.dueDay),
        limit: data.limit,
        color: selectedColor,
      });

      reset();
      setOpen(false);
      setSelectedColor(COLORS[0]);
      utils.creditCard.list.invalidate();
    } catch (error) {
      console.error("Erro ao criar cartão:", error);
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
    <DashboardLayoutCustom title="Cartões de Crédito">
      <div className="space-y-6">
        {/* Add Card Dialog */}
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Novo Cartão
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Cartão de Crédito</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Nome do Cartão
                  </label>
                  <input
                    {...register("name")}
                    type="text"
                    placeholder="Ex: Cartão Visa"
                    className="input-elegant w-full"
                  />
                  {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
                </div>

                {/* Last Digits */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Últimos 4 Dígitos
                  </label>
                  <input
                    {...register("lastDigits")}
                    type="text"
                    placeholder="1234"
                    maxLength={4}
                    className="input-elegant w-full"
                  />
                </div>

                {/* Cutoff Day */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Dia do Corte
                  </label>
                  <input
                    {...register("cutoffDay")}
                    type="number"
                    min="1"
                    max="31"
                    placeholder="10"
                    className="input-elegant w-full"
                  />
                  {errors.cutoffDay && <p className="text-red-600 text-sm mt-1">{errors.cutoffDay.message}</p>}
                </div>

                {/* Due Day */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Dia do Vencimento
                  </label>
                  <input
                    {...register("dueDay")}
                    type="number"
                    min="1"
                    max="31"
                    placeholder="20"
                    className="input-elegant w-full"
                  />
                  {errors.dueDay && <p className="text-red-600 text-sm mt-1">{errors.dueDay.message}</p>}
                </div>

                {/* Limit */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Limite (opcional)
                  </label>
                  <input
                    {...register("limit")}
                    type="number"
                    step="0.01"
                    placeholder="5000.00"
                    className="input-elegant w-full"
                  />
                </div>

                {/* Color Selection */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Cor
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-10 h-10 rounded-lg border-2 transition-all ${
                          selectedColor === color
                            ? "border-foreground"
                            : "border-border"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
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
                    {createMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Credit Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {creditCards && creditCards.length > 0 ? (
            creditCards.map((card) => (
              <div
                key={card.id}
                className="p-6 rounded-xl border-2 text-white relative overflow-hidden"
                style={{
                  backgroundColor: card.color || "#3B82F6",
                  borderColor: card.color || "#3B82F6",
                }}
              >
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <circle cx="50" cy="50" r="40" fill="white" />
                  </svg>
                </div>

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-12">
                    <div>
                      <p className="text-sm opacity-75">Cartão de Crédito</p>
                      <h3 className="text-2xl font-bold">{card.name}</h3>
                    </div>
                    <div className="text-3xl font-bold opacity-50">💳</div>
                  </div>

                  {card.lastDigits && (
                    <p className="text-lg font-mono mb-6">•••• •••• •••• {card.lastDigits}</p>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-6 border-t border-white border-opacity-30 pt-4">
                    <div>
                      <p className="text-xs opacity-75">Corte</p>
                      <p className="text-lg font-semibold">Dia {card.cutoffDay}</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-75">Vencimento</p>
                      <p className="text-lg font-semibold">Dia {card.dueDay}</p>
                    </div>
                  </div>

                  {card.limit && (
                    <div className="text-sm opacity-75">
                      Limite: {formatCurrency(card.limit)}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full">
              <Card className="p-12 text-center">
                <p className="text-muted-foreground mb-4">Nenhum cartão cadastrado</p>
                <p className="text-sm text-muted-foreground">
                  Crie seu primeiro cartão para começar a registrar despesas
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DashboardLayoutCustom>
  );
}
