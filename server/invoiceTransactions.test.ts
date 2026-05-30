import { describe, it, expect } from 'vitest';

/**
 * Testes para vinculação de transações a faturas e agrupamento por data de vencimento
 */

describe('Invoice Transactions Linking', () => {
  it('should link credit card transactions to invoices based on dates', () => {
    // Mock data
    const invoice = {
      id: 1,
      creditCardId: 1,
      closingDate: new Date('2026-03-01'),
      dueDate: new Date('2026-03-15'),
    };

    const transactions = [
      {
        id: 1,
        type: 'credit_card',
        creditCardId: 1,
        transactionDate: new Date('2026-03-05'), // Entre fechamento e vencimento
        amount: '100.00',
      },
      {
        id: 2,
        type: 'credit_card',
        creditCardId: 1,
        transactionDate: new Date('2026-02-28'), // Antes do fechamento
        amount: '50.00',
      },
      {
        id: 3,
        type: 'credit_card',
        creditCardId: 1,
        transactionDate: new Date('2026-03-20'), // Depois do vencimento
        amount: '75.00',
      },
      {
        id: 4,
        type: 'credit_card',
        creditCardId: 2, // Cartão diferente
        transactionDate: new Date('2026-03-10'),
        amount: '200.00',
      },
    ];

    // Simular lógica de vinculação
    const linkedTransactions = transactions.filter((t) => {
      const txDate = new Date(t.transactionDate);
      const closingDate = new Date(invoice.closingDate);
      const dueDate = new Date(invoice.dueDate);

      return (
        t.type === 'credit_card' &&
        t.creditCardId === invoice.creditCardId &&
        txDate >= closingDate &&
        txDate <= dueDate
      );
    });

    expect(linkedTransactions).toHaveLength(1);
    expect(linkedTransactions[0].id).toBe(1);
  });

  it('should group credit card transactions by invoice due date', () => {
    const invoices = [
      {
        id: 1,
        creditCardId: 1,
        closingDate: new Date('2026-03-01'),
        dueDate: new Date('2026-03-15'),
      },
      {
        id: 2,
        creditCardId: 1,
        closingDate: new Date('2026-04-01'),
        dueDate: new Date('2026-04-15'),
      },
    ];

    const transactions = [
      {
        id: 1,
        type: 'credit_card',
        creditCardId: 1,
        transactionDate: new Date('2026-03-05'),
        amount: '100.00',
      },
      {
        id: 2,
        type: 'credit_card',
        creditCardId: 1,
        transactionDate: new Date('2026-03-10'),
        amount: '50.00',
      },
      {
        id: 3,
        type: 'credit_card',
        creditCardId: 1,
        transactionDate: new Date('2026-04-05'),
        amount: '75.00',
      },
      {
        id: 4,
        type: 'income',
        creditCardId: null,
        transactionDate: new Date('2026-03-15'),
        amount: '1000.00',
      },
    ];

    // Helper para obter data de vencimento
    const getInvoiceDueDate = (transaction: any): Date | null => {
      if (transaction.type !== 'credit_card') return null;

      const txDate = new Date(transaction.transactionDate);
      const invoice = invoices.find((inv) => {
        const closingDate = new Date(inv.closingDate);
        const dueDate = new Date(inv.dueDate);
        return (
          inv.creditCardId === transaction.creditCardId &&
          txDate >= closingDate &&
          txDate <= dueDate
        );
      });

      return invoice ? new Date(invoice.dueDate) : null;
    };

    // Simular agrupamento
    const grouped = [...transactions].sort((a, b) => {
      const aIsCC = a.type === 'credit_card';
      const bIsCC = b.type === 'credit_card';

      // Se ambas são cartão, ordenar por data de vencimento
      if (aIsCC && bIsCC) {
        const aDueDate = getInvoiceDueDate(a)?.getTime() || 0;
        const bDueDate = getInvoiceDueDate(b)?.getTime() || 0;
        if (aDueDate !== bDueDate) return aDueDate - bDueDate;
        // Se mesma data de vencimento, ordenar por data da transação
        return (
          new Date(a.transactionDate).getTime() -
          new Date(b.transactionDate).getTime()
        );
      }

      // Cartões vem primeiro
      if (aIsCC) return -1;
      if (bIsCC) return 1;

      // Não cartões ordenados por data
      return (
        new Date(b.transactionDate).getTime() -
        new Date(a.transactionDate).getTime()
      );
    });

    // Verificar que cartões vêm primeiro
    expect(grouped[0].type).toBe('credit_card');
    expect(grouped[1].type).toBe('credit_card');
    expect(grouped[2].type).toBe('credit_card');
    expect(grouped[3].type).toBe('income');

    // Verificar que cartões estão agrupados por data de vencimento
    const cardTransactions = grouped.filter((t) => t.type === 'credit_card');
    const dueDate1 = getInvoiceDueDate(cardTransactions[0]);
    const dueDate2 = getInvoiceDueDate(cardTransactions[1]);
    const dueDate3 = getInvoiceDueDate(cardTransactions[2]);

    expect(dueDate1?.getTime()).toBeLessThanOrEqual(dueDate2?.getTime() || 0);
    expect(dueDate2?.getTime()).toBeLessThanOrEqual(dueDate3?.getTime() || 0);
  });

  it('should handle transactions without matching invoices', () => {
    const invoices = [
      {
        id: 1,
        creditCardId: 1,
        closingDate: new Date('2026-03-01'),
        dueDate: new Date('2026-03-15'),
      },
    ];

    const transactions = [
      {
        id: 1,
        type: 'credit_card',
        creditCardId: 1,
        transactionDate: new Date('2026-02-15'), // Antes de qualquer fatura
        amount: '100.00',
      },
    ];

    // Helper para obter data de vencimento
    const getInvoiceDueDate = (transaction: any): Date | null => {
      if (transaction.type !== 'credit_card') return null;

      const txDate = new Date(transaction.transactionDate);
      const invoice = invoices.find((inv) => {
        const closingDate = new Date(inv.closingDate);
        const dueDate = new Date(inv.dueDate);
        return (
          inv.creditCardId === transaction.creditCardId &&
          txDate >= closingDate &&
          txDate <= dueDate
        );
      });

      return invoice ? new Date(invoice.dueDate) : null;
    };

    const dueDate = getInvoiceDueDate(transactions[0]);
    expect(dueDate).toBeNull();
  });

  it('should correctly filter transactions by invoice', () => {
    const invoice = {
      id: 1,
      creditCardId: 1,
      closingDate: new Date('2026-03-01'),
      dueDate: new Date('2026-03-15'),
    };

    const filters = {
      creditCardId: '1',
      category: 'Alimentação',
      description: 'Supermercado',
    };

    const transactions = [
      {
        id: 1,
        type: 'credit_card',
        creditCardId: 1,
        transactionDate: new Date('2026-03-05'),
        category: 'Alimentação',
        description: 'Supermercado X',
        amount: '100.00',
      },
      {
        id: 2,
        type: 'credit_card',
        creditCardId: 1,
        transactionDate: new Date('2026-03-10'),
        category: 'Compras',
        description: 'Loja de roupas',
        amount: '50.00',
      },
      {
        id: 3,
        type: 'credit_card',
        creditCardId: 2,
        transactionDate: new Date('2026-03-05'),
        category: 'Alimentação',
        description: 'Restaurante',
        amount: '75.00',
      },
    ];

    // Simular lógica de filtro
    const filtered = transactions.filter((t) => {
      const txDate = new Date(t.transactionDate);
      const closingDate = new Date(invoice.closingDate);
      const dueDate = new Date(invoice.dueDate);

      return (
        t.type === 'credit_card' &&
        t.creditCardId === invoice.creditCardId &&
        txDate >= closingDate &&
        txDate <= dueDate &&
        (!filters.creditCardId ||
          t.creditCardId === parseInt(filters.creditCardId)) &&
        (!filters.category || t.category === filters.category) &&
        (!filters.description ||
          t.description?.toLowerCase().includes(filters.description.toLowerCase()))
      );
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
  });
});
