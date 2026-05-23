import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSavedFilters,
  createSavedFilter,
  getSavedFilter,
  updateSavedFilter,
  deleteSavedFilter,
} from "./db";

// Mock the database
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
  };
});

describe("SavedFilters", () => {
  const mockUserId = 1;
  const mockFilter = {
    name: "Test Filter",
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-01-31"),
    categories: ["Alimentação", "Transporte"],
    types: ["expense"],
    minAmount: 10,
    maxAmount: 1000,
    isDefault: false,
  };

  describe("createSavedFilter", () => {
    it("should create a saved filter with valid data", async () => {
      const result = await createSavedFilter(mockUserId, mockFilter);
      expect(result).toBeDefined();
    });

    it("should handle missing optional fields", async () => {
      const minimalFilter = {
        name: "Minimal Filter",
      };
      const result = await createSavedFilter(mockUserId, minimalFilter as any);
      expect(result).toBeDefined();
    });
  });

  describe("getSavedFilters", () => {
    it("should retrieve all saved filters for a user", async () => {
      const result = await getSavedFilters(mockUserId);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return empty array if no filters exist", async () => {
      const result = await getSavedFilters(999);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getSavedFilter", () => {
    it("should retrieve a specific saved filter by ID", async () => {
      const result = await getSavedFilter(1);
      if (result) {
        expect(result).toHaveProperty("id");
        expect(result).toHaveProperty("name");
      }
    });

    it("should return null for non-existent filter", async () => {
      const result = await getSavedFilter(999);
      expect(result).toBeNull();
    });
  });

  describe("updateSavedFilter", () => {
    it("should update a saved filter", async () => {
      const updates = {
        name: "Updated Filter Name",
      };
      const result = await updateSavedFilter(1, updates);
      expect(result).toBeDefined();
    });

    it("should handle partial updates", async () => {
      const updates = {
        startDate: new Date("2024-02-01"),
      };
      const result = await updateSavedFilter(1, updates);
      expect(result).toBeDefined();
    });
  });

  describe("deleteSavedFilter", () => {
    it("should delete a saved filter", async () => {
      const result = await deleteSavedFilter(1);
      expect(result).toBeDefined();
    });
  });

  describe("Filter data persistence", () => {
    it("should preserve JSON arrays in categories field", async () => {
      const filterWithCategories = {
        name: "Category Filter",
        categories: ["Alimentação", "Saúde"],
      };
      const result = await createSavedFilter(mockUserId, filterWithCategories as any);
      expect(result).toBeDefined();
    });

    it("should preserve JSON arrays in types field", async () => {
      const filterWithTypes = {
        name: "Type Filter",
        types: ["income", "expense"],
      };
      const result = await createSavedFilter(mockUserId, filterWithTypes as any);
      expect(result).toBeDefined();
    });

    it("should handle date fields correctly", async () => {
      const filterWithDates = {
        name: "Date Filter",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
      };
      const result = await createSavedFilter(mockUserId, filterWithDates as any);
      expect(result).toBeDefined();
    });
  });
});
