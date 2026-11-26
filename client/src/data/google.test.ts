import { describe, expect, it } from "vitest";
import { resolveAppId } from "./google";

const CLIENT = "123456789012-abc123.apps.googleusercontent.com";

describe("resolveAppId", () => {
  it("usa o número do projeto configurado", () => {
    expect(resolveAppId("987654321098", CLIENT)).toBe("987654321098");
  });

  it("ignora um ID textual de projeto e usa o número do Client ID", () => {
    expect(resolveAppId("financeiro-domestico-4521", CLIENT)).toBe("123456789012");
  });

  it("ignora o próprio Client ID colado no lugar do número", () => {
    expect(resolveAppId(CLIENT, CLIENT)).toBe("123456789012");
  });

  it("deriva do Client ID quando não configurado", () => {
    expect(resolveAppId(undefined, CLIENT)).toBe("123456789012");
    expect(resolveAppId("  ", CLIENT)).toBe("123456789012");
  });

  it("sem Client ID reconhecível, mantém o valor configurado", () => {
    expect(resolveAppId("abc", undefined)).toBe("abc");
    expect(resolveAppId(undefined, undefined)).toBeUndefined();
  });
});
