import { describe, expect, it } from "vitest";
import { cardRowStyle, parseHexColor, withAlpha } from "./cardTint";

describe("cor do cartão esmaecida", () => {
  it("lê cores curtas e longas", () => {
    expect(parseHexColor("#F97316")).toEqual([249, 115, 22]);
    expect(parseHexColor("#0f0")).toEqual([0, 255, 0]);
    expect(parseHexColor(" 8a05be ")).toEqual([138, 5, 190]);
  });
  it("cor inválida ou vazia usa o azul padrão", () => {
    expect(parseHexColor(null)).toEqual([59, 130, 246]);
    expect(parseHexColor("vermelho")).toEqual([59, 130, 246]);
  });
  it("aplica a transparência", () => {
    expect(withAlpha("#F97316", 0.16)).toBe("rgba(249, 115, 22, 0.16)");
    expect(withAlpha("#F97316", 3)).toBe("rgba(249, 115, 22, 1)");
  });
  it("fatura mais forte que as compras", () => {
    const inv = cardRowStyle("#F97316", "invoice") as Record<string, string>;
    const buy = cardRowStyle("#F97316", "purchase") as Record<string, string>;
    expect(inv["--row-tint"]).toBe("rgba(249, 115, 22, 0.16)");
    expect(buy["--row-tint"]).toBe("rgba(249, 115, 22, 0.08)");
    expect(buy["--row-tint-hover"]).toBe("rgba(249, 115, 22, 0.16)");
  });
});

import { paymentStatusOf } from "../components/PaymentStatusIcon";

describe("situação do pagamento", () => {
  const today = new Date(2026, 10, 26, 15, 0);
  it("pago, pendente ou atrasado pelo vencimento", () => {
    expect(paymentStatusOf(true, new Date(2026, 0, 1), today)).toBe("paid");
    expect(paymentStatusOf(false, new Date(2026, 10, 26), today)).toBe("pending");
    expect(paymentStatusOf(false, new Date(2026, 10, 25), today)).toBe("overdue");
    expect(paymentStatusOf(false, null, today)).toBe("pending");
  });
});
