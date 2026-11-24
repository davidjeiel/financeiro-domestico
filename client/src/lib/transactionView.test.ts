import { afterEach, describe, expect, it, vi } from "vitest";
import { monthRange, readViewMode, saveViewMode } from "./transactionView";

describe("visão dos lançamentos", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calcula o intervalo do mês, inclusive fevereiro bissexto e dezembro", () => {
    expect(monthRange(2026, 3)).toEqual({ start: "2026-03-01", end: "2026-03-31" });
    expect(monthRange(2028, 2)).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(monthRange(2026, 12)).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });

  it("guarda a última escolha e usa competência por padrão", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    expect(readViewMode()).toBe("competency");
    saveViewMode("monthly");
    expect(readViewMode()).toBe("monthly");
    saveViewMode("competency");
    expect(readViewMode()).toBe("competency");
  });

  it("sem localStorage, cai em competência", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(readViewMode()).toBe("competency");
    expect(() => saveViewMode("monthly")).not.toThrow();
  });
});
