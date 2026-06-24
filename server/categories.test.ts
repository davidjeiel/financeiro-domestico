import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("Categories (Typologies)", () => {
  let testUserId: number;

  beforeAll(async () => {
    // Criar usuário de teste
    await db.upsertUser({
      openId: `test-user-${Date.now()}`,
      name: "Test User",
      email: "test@example.com",
      loginMethod: "test",
      lastSignedIn: new Date(),
    });

    const user = await db.getUserByOpenId(`test-user-${Date.now()}`);
    if (user) {
      testUserId = user.id;
    }
  });

  it("should create default typologies for new user", async () => {
    await db.createDefaultTypologies(testUserId);

    const typologies = await db.getTypologiesByUser(testUserId);
    expect(typologies.length).toBeGreaterThan(0);
    expect(typologies.some((t) => t.name === "Salário")).toBe(true);
    expect(typologies.some((t) => t.name === "Alimentação")).toBe(true);
  });

  it("should get typologies by user and type", async () => {
    const incomeTypologies = await db.getTypologiesByUserAndType(testUserId, "income");
    expect(incomeTypologies.length).toBeGreaterThan(0);
    expect(incomeTypologies.every((t) => t.type === "income")).toBe(true);
  });

  it("should create custom typology", async () => {
    const result = await db.createTypology({
      userId: testUserId,
      name: "Custom Category",
      type: "expense",
      icon: "🎯",
      color: "#FF6B6B",
      isActive: 1,
      order: 99,
    });

    expect(result).toBeDefined();

    const typologies = await db.getTypologiesByUser(testUserId);
    expect(typologies.some((t) => t.name === "Custom Category")).toBe(true);
  });

  it("should update typology", async () => {
    const typologies = await db.getTypologiesByUserAndType(testUserId, "expense");
    const firstTypology = typologies[0];

    if (firstTypology) {
      await db.updateTypology(firstTypology.id, {
        name: "Updated Category",
        color: "#00FF00",
      });

      const updated = await db.getTypologiesByUser(testUserId);
      const updatedTypology = updated.find((t) => t.id === firstTypology.id);
      expect(updatedTypology?.name).toBe("Updated Category");
      expect(updatedTypology?.color).toBe("#00FF00");
    }
  });

  it("should delete typology", async () => {
    const typologies = await db.getTypologiesByUser(testUserId);
    const lastTypology = typologies[typologies.length - 1];

    if (lastTypology) {
      await db.deleteTypology(lastTypology.id);

      const updated = await db.getTypologiesByUser(testUserId);
      expect(updated.some((t) => t.id === lastTypology.id)).toBe(false);
    }
  });

  it("should have correct default categories structure", async () => {
    const typologies = await db.getTypologiesByUser(testUserId);

    const incomeCategories = typologies.filter((t) => t.type === "income");
    const expenseCategories = typologies.filter((t) => t.type === "expense");
    const creditCardCategories = typologies.filter((t) => t.type === "credit_card");

    expect(incomeCategories.length).toBeGreaterThan(0);
    expect(expenseCategories.length).toBeGreaterThan(0);
    expect(creditCardCategories.length).toBeGreaterThan(0);

    // Verificar se todas têm ícone e cor
    typologies.forEach((t) => {
      expect(t.icon).toBeTruthy();
      expect(t.color).toBeTruthy();
      expect(t.isActive).toBe(1);
    });
  });
});
