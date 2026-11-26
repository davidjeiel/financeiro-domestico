import { useEffect, useState } from "react";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Info, Loader2, Save } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  competencyEndDayFor,
  competencyOfDate,
  competencyPeriod,
  getMonthName,
  normalizeStartDay,
  shiftCompetency,
} from "@/data/competencyLogic";

const PRESETS: { day: number; label: string; hint: string }[] = [
  { day: 1, label: "1º ao último dia", hint: "Mês do calendário (padrão)" },
  { day: 5, label: "5 ao 4", hint: "Ex.: salário no 5º dia útil" },
  { day: 21, label: "21 ao 20", hint: "Ex.: alinhado ao fechamento do cartão" },
  { day: 30, label: "30 ao 29", hint: "Ex.: salário no fim do mês" },
];

const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function describeCompetency(startDay: number) {
  if (startDay === 1) return "Do dia 1º ao último dia de cada mês (mês do calendário).";
  return (
    `Do dia ${startDay} de um mês ao dia ${competencyEndDayFor(startDay)} do mês seguinte. ` +
    `A competência leva o nome do mês em que começa` +
    (startDay > 28 ? "; em meses mais curtos ela começa no último dia do mês." : ".")
  );
}

export default function CompetencyConfig() {
  const utils = trpc.useUtils();
  const { data: config, isLoading } = trpc.competency.config.useQuery();
  const saveMutation = trpc.competency.setStartDay.useMutation();

  const [startDay, setStartDay] = useState(1);
  const [raw, setRaw] = useState("1");
  useEffect(() => {
    if (config) {
      setStartDay(config.startDay);
      setRaw(String(config.startDay));
    }
  }, [config]);

  const valid = /^\d+$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 31;
  const changed = !!config && valid && startDay !== config.startDay;

  const { data: preview, isFetching: previewLoading } = trpc.competency.previewStartDay.useQuery(
    { startDay },
    { enabled: changed }
  );

  const choose = (day: number) => {
    setStartDay(day);
    setRaw(String(day));
  };

  const handleSave = async () => {
    try {
      const result = await saveMutation.mutateAsync({ startDay });
      // Muda a competência atual e o conteúdo de todas as competências.
      await utils.invalidate();
      toast.success(
        result.moved > 0
          ? `Competência atualizada. ${result.moved} lançamento(s) foram para a competência da data deles.`
          : "Competência atualizada."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar a configuração");
    }
  };

  // Próximas competências a partir da de hoje, com o dia escolhido.
  const today = competencyOfDate(new Date(), startDay);
  const periods = Array.from({ length: 6 }, (_, i) => {
    const { year, month } = shiftCompetency(today.year, today.month, i);
    return { year, month, ...competencyPeriod(year, month, startDay) };
  });

  return (
    <DashboardLayoutCustom title="Configurar Competência">
      <div className="space-y-6 max-w-3xl">
        <Card className="p-6 bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground mb-2">Configuração atual</h3>
              <p className="text-sm text-muted-foreground">
                {isLoading || !config ? "Carregando…" : describeCompetency(config.startDay)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Período da competência</h2>
            <p className="text-sm text-muted-foreground mt-1">
              A competência agrupa os lançamentos pela data. Ela começa no dia escolhido e termina na
              véspera desse dia no mês seguinte. Compras no cartão continuam entrando pela fatura
              (pelo vencimento).
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="start-day" className="text-sm font-medium text-foreground mb-2 block">
                Dia de início
              </label>
              <Input
                id="start-day"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={raw}
                onChange={e => {
                  setRaw(e.target.value);
                  if (/^\d+$/.test(e.target.value)) setStartDay(normalizeStartDay(Number(e.target.value)));
                }}
              />
              {!valid && <p className="text-red-600 text-sm mt-1">Informe um dia entre 1 e 31.</p>}
            </div>
            <div>
              <span className="text-sm font-medium text-foreground mb-2 block">Dia de término</span>
              <p className="h-9 flex items-center px-3 rounded-md border border-border bg-muted/40 text-sm">
                {startDay === 1 ? "Último dia do mês" : `Dia ${competencyEndDayFor(startDay)} do mês seguinte`}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {PRESETS.map(p => (
              <button
                key={p.day}
                type="button"
                onClick={() => choose(p.day)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  startDay === p.day ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                }`}
              >
                <span className="block text-sm font-medium">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.hint}</span>
              </button>
            ))}
          </div>

          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <h4 className="font-medium text-foreground mb-3">Próximas competências</h4>
            <ul className="space-y-1 text-sm">
              {periods.map(p => (
                <li key={`${p.year}-${p.month}`} className="flex justify-between gap-4">
                  <span className="font-medium">
                    {getMonthName(p.month)} {p.year}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {fmt(p.start)} a {fmt(p.end)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {changed && (
            <p className="text-sm rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              {previewLoading || !preview ? (
                "Calculando quantos lançamentos mudam de competência…"
              ) : preview.affected > 0 ? (
                <>
                  Ao salvar, <strong>{preview.affected} lançamento(s)</strong> (fora do cartão) vão para a
                  competência que a data deles indica.
                </>
              ) : (
                "Nenhum lançamento existente muda de competência."
              )}
            </p>
          )}

          <Button
            onClick={handleSave}
            disabled={!changed || saveMutation.isPending}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar configuração
          </Button>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4">Como funciona</h3>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Pela data. </span>
              Com início no dia 30, um lançamento de 15/12 fica na competência de Novembro (30/11 a 29/12).
              Ao mudar a data de um lançamento, ele muda de competência junto.
            </p>
            <p>
              <span className="font-medium text-foreground">Cartão de crédito. </span>
              As compras vão para a fatura pelo dia de fechamento do cartão, e a fatura entra na
              competência que contém o vencimento.
            </p>
            <p>
              <span className="font-medium text-foreground">Área compartilhada. </span>
              A configuração vale para todos os participantes da área.
            </p>
          </div>
        </Card>
      </div>
    </DashboardLayoutCustom>
  );
}
