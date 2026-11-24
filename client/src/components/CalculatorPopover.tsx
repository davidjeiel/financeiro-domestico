import { useEffect, useRef, useState } from "react";
import { Calculator, Delete } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { evaluateExpression, roundCents, tryEvaluate } from "@/lib/calculator";
import { formatCurrency } from "@/lib/formatting";

const KEYS: { label: string; insert?: string; action?: "clear" | "back" | "equals"; wide?: boolean; variant?: "op" | "fn" }[] = [
  { label: "C", action: "clear", variant: "fn" },
  { label: "(", insert: "(", variant: "fn" },
  { label: ")", insert: ")", variant: "fn" },
  { label: "÷", insert: "÷", variant: "op" },
  { label: "7", insert: "7" },
  { label: "8", insert: "8" },
  { label: "9", insert: "9" },
  { label: "×", insert: "×", variant: "op" },
  { label: "4", insert: "4" },
  { label: "5", insert: "5" },
  { label: "6", insert: "6" },
  { label: "−", insert: "−", variant: "op" },
  { label: "1", insert: "1" },
  { label: "2", insert: "2" },
  { label: "3", insert: "3" },
  { label: "+", insert: "+", variant: "op" },
  { label: "%", insert: "%", variant: "fn" },
  { label: "0", insert: "0" },
  { label: ",", insert: "," },
  { label: "⌫", action: "back", variant: "fn" },
];

/**
 * Ícone de calculadora que abre um popover para fazer contas e, se quiser,
 * levar o resultado para o campo de valor.
 */
export function CalculatorPopover({
  value,
  onApply,
}: {
  /** Valor atual do campo (vira o ponto de partida da conta). */
  value?: string;
  onApply: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const start = Number(value);
      setExpr(Number.isFinite(start) && start > 0 ? String(start).replace(".", ",") : "");
      setError(null);
    }
  }, [open, value]);

  const preview = tryEvaluate(expr);

  const insert = (text: string) => {
    setError(null);
    setExpr(prev => prev + text);
    inputRef.current?.focus();
  };

  const equals = () => {
    try {
      const result = roundCents(evaluateExpression(expr));
      setExpr(String(result).replace(".", ","));
      setError(null);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Expressão inválida");
      return null;
    }
  };

  const apply = () => {
    const result = equals();
    if (result === null) return;
    if (result <= 0) {
      setError("O valor precisa ser maior que zero");
      return;
    }
    onApply(result.toFixed(2));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Calculadora"
          aria-label="Abrir calculadora"
        >
          <Calculator className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3 space-y-2" onOpenAutoFocus={e => {
        e.preventDefault();
        inputRef.current?.focus();
      }}>
        <div className="rounded-md bg-muted px-3 py-2 text-right">
          <input
            ref={inputRef}
            aria-label="Conta"
            inputMode="decimal"
            className="w-full bg-transparent text-right text-lg font-mono outline-none"
            value={expr}
            placeholder="0"
            onChange={e => {
              setError(null);
              setExpr(e.target.value);
            }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation(); // não envia o formulário
                if (e.ctrlKey || e.metaKey) apply();
                else equals();
              }
            }}
          />
          <p className={`text-xs h-4 ${error ? "text-red-600" : "text-muted-foreground"}`}>
            {error ?? (preview !== null && expr.trim() ? `= ${formatCurrency(roundCents(preview))}` : "")}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {KEYS.map(key => (
            <button
              key={key.label}
              type="button"
              onClick={() => {
                if (key.action === "clear") {
                  setExpr("");
                  setError(null);
                } else if (key.action === "back") {
                  setExpr(prev => prev.slice(0, -1));
                  setError(null);
                } else if (key.insert) {
                  insert(key.insert);
                }
              }}
              className={`h-9 rounded-md text-sm font-medium transition-colors ${
                key.variant === "op"
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : key.variant === "fn"
                    ? "bg-muted text-foreground hover:bg-muted/70"
                    : "bg-background border border-border hover:bg-muted"
              }`}
              aria-label={key.action === "back" ? "Apagar" : key.label}
            >
              {key.action === "back" ? <Delete className="w-4 h-4 mx-auto" /> : key.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={equals}>
            =
          </Button>
          <Button type="button" size="sm" onClick={apply} disabled={!expr.trim()}>
            Usar valor
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
