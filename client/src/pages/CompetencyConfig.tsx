import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Calendar, Info, Save } from "lucide-react";

const competencyConfigSchema = z.object({
  startDay: z.number().min(1).max(31),
  endDay: z.number().min(0).max(31),
});

type CompetencyConfigData = z.infer<typeof competencyConfigSchema>;

export default function CompetencyConfig() {
  const [currentConfig, setCurrentConfig] = useState<{ startDay: number; endDay: number }>({
    startDay: 1,
    endDay: 0,
  });

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<CompetencyConfigData>({
    resolver: zodResolver(competencyConfigSchema),
    defaultValues: currentConfig,
  });

  const startDay = watch("startDay");
  const endDay = watch("endDay");

  useEffect(() => {
    // Carregar configuração atual do usuário (seria feito via API)
    // Por enquanto, apenas inicializa com valores padrão
  }, []);

  const onSubmit = async (data: CompetencyConfigData) => {
    try {
      setCurrentConfig(data);
      toast.success("Configuração de competência atualizada com sucesso!");
    } catch (error) {
      toast.error("Erro ao atualizar configuração");
    }
  };

  const getCompetencyDescription = () => {
    if (startDay === 1 && endDay === 0) {
      return "Competência padrão: 1º ao último dia de cada mês";
    } else if (startDay === 21 && endDay === 20) {
      return "Competência personalizada: 21º de um mês ao 20º do mês seguinte";
    } else if (endDay === 0) {
      return `Competência personalizada: ${startDay}º de um mês ao último dia do mês`;
    } else if (startDay < endDay) {
      return `Competência personalizada: ${startDay}º ao ${endDay}º de cada mês`;
    } else {
      return `Competência personalizada: ${startDay}º de um mês ao ${endDay}º do mês seguinte`;
    }
  };

  return (
    <DashboardLayoutCustom title="Configurar Competência">
      <div className="space-y-6">
        {/* Configuração Atual */}
        <Card className="p-6 bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground mb-2">Configuração Atual</h3>
              <p className="text-sm text-muted-foreground">{getCompetencyDescription()}</p>
            </div>
          </div>
        </Card>

        {/* Formulário de Configuração */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Definir Período de Competência</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Informação */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-600">
                <strong>O que é competência?</strong> É o período contábil usado para agrupar suas transações.
                Por padrão, é de 1º a 28/29/30/31 de cada mês. Você pode customizar para períodos como 21 a 20.
              </p>
            </div>

            {/* Dia de Início */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Dia de Início da Competência
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="1"
                  max="31"
                  {...register("startDay", { valueAsNumber: true })}
                  className="input-elegant w-32"
                />
                <span className="text-sm text-muted-foreground">de cada mês</span>
              </div>
              {errors.startDay && (
                <p className="text-red-600 text-sm mt-1">{errors.startDay.message}</p>
              )}
            </div>

            {/* Dia de Fim */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Dia de Fim da Competência
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="0"
                  max="31"
                  {...register("endDay", { valueAsNumber: true })}
                  className="input-elegant w-32"
                />
                <span className="text-sm text-muted-foreground">
                  (0 = último dia do mês)
                </span>
              </div>
              {errors.endDay && (
                <p className="text-red-600 text-sm mt-1">{errors.endDay.message}</p>
              )}
            </div>

            {/* Exemplos */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-medium text-foreground mb-3">Exemplos Comuns:</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    setValue("startDay", 1);
                    setValue("endDay", 0);
                  }}
                  className="block w-full text-left p-2 rounded hover:bg-background transition-all"
                >
                  • <strong>1º ao último dia</strong> - Competência mensal padrão
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue("startDay", 21);
                    setValue("endDay", 20);
                  }}
                  className="block w-full text-left p-2 rounded hover:bg-background transition-all"
                >
                  • <strong>21º ao 20º</strong> - Período de fatura de cartão
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue("startDay", 5);
                    setValue("endDay", 4);
                  }}
                  className="block w-full text-left p-2 rounded hover:bg-background transition-all"
                >
                  • <strong>5º ao 4º</strong> - Período customizado
                </button>
              </div>
            </div>

            {/* Visualização */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-medium text-foreground mb-2">Visualização:</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {Array.from({ length: 12 }, (_, i) => {
                  const month = i + 1;
                  const monthName = new Date(2026, month - 1).toLocaleDateString("pt-BR", {
                    month: "short",
                  });
                  return (
                    <div key={month} className="p-2 rounded bg-background text-center">
                      <div className="font-medium text-foreground">{monthName}</div>
                      <div className="text-muted-foreground">
                        {startDay} → {endDay === 0 ? "fim" : endDay}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Save className="w-4 h-4 mr-2" />
              Salvar Configuração
            </Button>
          </form>
        </Card>

        {/* Informações Adicionais */}
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4">Como Funciona</h3>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">Alocação de Transações</p>
              <p>Cada transação é automaticamente alocada à competência correta baseado em sua data.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Período Cruzado</p>
              <p>
                Se você definir 21 a 20, uma transação em 15/03 será alocada à competência "Fevereiro/Março"
                (que vai de 21/02 a 20/03).
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Cartão de Crédito</p>
              <p>
                Útil para sincronizar com períodos de fatura de cartão de crédito, garantindo que todas as
                despesas apareçam na competência correta.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayoutCustom>
  );
}
