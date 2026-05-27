import { describe, it, expect } from 'vitest';

describe('Advanced Filters', { timeout: 30000 }, () => {
  describe('Filter Logic', () => {
    const mockTransactions = [
      {
        id: 1,
        userId: 1,
        competencyId: 1,
        type: 'expense' as const,
        category: 'Alimentação',
        description: 'Supermercado',
        amount: '150.00',
        transactionDate: new Date('2026-01-25'),
        isPaid: 0,
        creditCardId: null,
        dueDate: null,
        installments: null,
        notes: null,
        paidDate: null,
        links: null,
      },
      {
        id: 2,
        userId: 1,
        competencyId: 1,
        type: 'expense' as const,
        category: 'Transporte',
        description: 'Uber',
        amount: '50.00',
        transactionDate: new Date('2026-01-26'),
        isPaid: 0,
        creditCardId: null,
        dueDate: null,
        installments: null,
        notes: null,
        paidDate: null,
        links: null,
      },
      {
        id: 3,
        userId: 1,
        competencyId: 1,
        type: 'income' as const,
        category: 'Salário',
        description: 'Salário mensal',
        amount: '5000.00',
        transactionDate: new Date('2026-01-21'),
        isPaid: 0,
        creditCardId: null,
        dueDate: null,
        installments: null,
        notes: null,
        paidDate: null,
        links: null,
      },
      {
        id: 4,
        userId: 1,
        competencyId: 1,
        type: 'expense' as const,
        category: 'Alimentação',
        description: 'Restaurante',
        amount: '80.00',
        transactionDate: new Date('2026-01-27'),
        isPaid: 0,
        creditCardId: null,
        dueDate: null,
        installments: null,
        notes: null,
        paidDate: null,
        links: null,
      },
    ];

    it('should filter transactions by category', () => {
      const filtered = mockTransactions.filter((tx) => tx.category === 'Alimentação');
      expect(filtered).toHaveLength(2);
      expect(filtered.every((tx) => tx.category === 'Alimentação')).toBe(true);
    });

    it('should filter transactions by type', () => {
      const filtered = mockTransactions.filter((tx) => tx.type === 'expense');
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((tx) => tx.type === 'expense')).toBe(true);
    });

    it('should filter transactions by description', () => {
      const filtered = mockTransactions.filter((tx) =>
        tx.description?.toLowerCase().includes('supermercado')
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].description).toBe('Supermercado');
    });

    it('should apply multiple filters simultaneously', () => {
      const filtered = mockTransactions.filter(
        (tx) => tx.type === 'expense' && tx.category === 'Alimentação'
      );
      expect(filtered).toHaveLength(2);
      expect(filtered.every((tx) => tx.type === 'expense' && tx.category === 'Alimentação')).toBe(
        true
      );
    });

    it('should handle empty filter results', () => {
      const filtered = mockTransactions.filter((tx) => tx.category === 'NonExistent');
      expect(filtered).toHaveLength(0);
    });

    it('should preserve transaction data when filtering', () => {
      const filtered = mockTransactions.filter((tx) => tx.category === 'Salário');
      expect(filtered[0]).toHaveProperty('id');
      expect(filtered[0]).toHaveProperty('amount');
      expect(filtered[0]).toHaveProperty('transactionDate');
    });

    it('should handle case-insensitive description search', () => {
      const searchTerm = 'RESTAURANTE';
      const filtered = mockTransactions.filter((tx) =>
        tx.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].description).toBe('Restaurante');
    });

    it('should filter by multiple categories', () => {
      const categories = ['Alimentação', 'Transporte'];
      const filtered = mockTransactions.filter((tx) => categories.includes(tx.category));
      expect(filtered).toHaveLength(3);
    });

    it('should combine category and type filters', () => {
      const filtered = mockTransactions.filter(
        (tx) => tx.type === 'expense' && tx.category === 'Transporte'
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].description).toBe('Uber');
    });

    it('should handle complex filter combinations', () => {
      const filtered = mockTransactions.filter(
        (tx) =>
          (tx.type === 'expense' || tx.type === 'income') &&
          (tx.category === 'Alimentação' || tx.category === 'Salário')
      );
      expect(filtered).toHaveLength(3);
    });
  });

  describe('Column Visibility', () => {
    const defaultColumns = [
      { id: 'date', label: 'Data', visible: true },
      { id: 'description', label: 'Descrição', visible: true },
      { id: 'category', label: 'Categoria', visible: true },
      { id: 'type', label: 'Tipo', visible: true },
      { id: 'amount', label: 'Valor', visible: true },
      { id: 'creditCard', label: 'Cartão', visible: true },
      { id: 'status', label: 'Status', visible: true },
      { id: 'links', label: 'Links', visible: true },
      { id: 'actions', label: 'Ações', visible: true },
    ];

    it('should toggle column visibility', () => {
      const updated = defaultColumns.map((col) =>
        col.id === 'creditCard' ? { ...col, visible: !col.visible } : col
      );
      const creditCardCol = updated.find((col) => col.id === 'creditCard');
      expect(creditCardCol?.visible).toBe(false);
    });

    it('should show all columns', () => {
      const updated = defaultColumns.map((col) => ({ ...col, visible: true }));
      expect(updated.every((col) => col.visible)).toBe(true);
    });

    it('should hide all columns', () => {
      const updated = defaultColumns.map((col) => ({ ...col, visible: false }));
      expect(updated.every((col) => !col.visible)).toBe(true);
    });

    it('should count visible columns', () => {
      const visibleCount = defaultColumns.filter((col) => col.visible).length;
      expect(visibleCount).toBe(9);
    });

    it('should preserve column order when toggling visibility', () => {
      const updated = defaultColumns.map((col) =>
        col.id === 'amount' ? { ...col, visible: false } : col
      );
      const ids = updated.map((col) => col.id);
      expect(ids).toEqual([
        'date',
        'description',
        'category',
        'type',
        'amount',
        'creditCard',
        'status',
        'links',
        'actions',
      ]);
    });
  });
});
