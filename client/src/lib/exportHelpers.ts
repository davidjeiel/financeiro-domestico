import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ExportData {
  transactions: Array<{
    id: number;
    date: string;
    description: string;
    category: string;
    type: string;
    amount: number;
    notes?: string;
  }>;
  competency: {
    name: string;
    year: number;
    month: number;
  };
}

/**
 * Exporta dados para arquivo XLSX
 */
export function exportToXLSX(data: ExportData, filename?: string) {
  const workbook = XLSX.utils.book_new();

  // Aba de Transações
  const transactionsSheet = XLSX.utils.json_to_sheet(
    data.transactions.map(t => ({
      'Data': t.date,
      'Descrição': t.description,
      'Categoria': t.category,
      'Tipo': t.type,
      'Valor': t.amount,
      'Notas': t.notes || '',
    }))
  );

  // Aba de Resumo
  const summary = calculateSummary(data.transactions);
  const summarySheet = XLSX.utils.json_to_sheet([
    { 'Métrica': 'Competência', 'Valor': data.competency.name },
    { 'Métrica': 'Total de Receitas', 'Valor': summary.totalIncome },
    { 'Métrica': 'Total de Despesas', 'Valor': summary.totalExpense },
    { 'Métrica': 'Total de Cartão', 'Valor': summary.totalCreditCard },
    { 'Métrica': 'Saldo', 'Valor': summary.balance },
  ]);

  // Aba de Distribuição por Categoria
  const categoryData = calculateCategoryDistribution(data.transactions);
  const categorySheet = XLSX.utils.json_to_sheet(
    categoryData.map(c => ({
      'Categoria': c.category,
      'Tipo': c.type,
      'Total': c.total,
      'Quantidade': c.count,
    }))
  );

  // Adicionar abas ao workbook
  XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transações');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');
  XLSX.utils.book_append_sheet(workbook, categorySheet, 'Por Categoria');

  // Configurar largura das colunas
  transactionsSheet['!cols'] = [
    { wch: 12 }, // Data
    { wch: 25 }, // Descrição
    { wch: 15 }, // Categoria
    { wch: 12 }, // Tipo
    { wch: 12 }, // Valor
    { wch: 20 }, // Notas
  ];

  // Salvar arquivo
  const finalFilename = filename || `financeiro-${data.competency.name.replace(/\s+/g, '-')}.xlsx`;
  XLSX.writeFile(workbook, finalFilename);
}

/**
 * Exporta dados para arquivo CSV
 */
export function exportToCSV(data: ExportData, filename?: string) {
  // Preparar dados para CSV
  const csvData = data.transactions.map(t => ({
    'Data': t.date,
    'Descrição': t.description,
    'Categoria': t.category,
    'Tipo': t.type,
    'Valor': t.amount,
    'Notas': t.notes || '',
  }));

  // Converter para CSV
  const csv = Papa.unparse(csvData);

  // Criar blob e download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  const finalFilename = filename || `financeiro-${data.competency.name.replace(/\s+/g, '-')}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', finalFilename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Calcula resumo das transações
 */
function calculateSummary(transactions: ExportData['transactions']) {
  return {
    totalIncome: transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0),
    totalExpense: transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0),
    totalCreditCard: transactions
      .filter(t => t.type === 'credit_card')
      .reduce((sum, t) => sum + t.amount, 0),
    balance: transactions.reduce((sum, t) => {
      if (t.type === 'income') return sum + t.amount;
      return sum - t.amount;
    }, 0),
  };
}

/**
 * Calcula distribuição por categoria
 */
function calculateCategoryDistribution(transactions: ExportData['transactions']) {
  const distribution: Record<string, { category: string; type: string; total: number; count: number }> = {};

  transactions.forEach(t => {
    const key = `${t.category}-${t.type}`;
    if (!distribution[key]) {
      distribution[key] = {
        category: t.category,
        type: t.type,
        total: 0,
        count: 0,
      };
    }
    distribution[key].total += t.amount;
    distribution[key].count += 1;
  });

  return Object.values(distribution).sort((a, b) => b.total - a.total);
}

/**
 * Prepara dados de transações para exportação
 */
export function prepareExportData(
  transactions: Array<{
    id: number;
    transactionDate: Date;
    description?: string;
    category: string;
    type: 'income' | 'expense' | 'credit_card';
    amount: string | number;
    notes?: string;
  }>,
  competencyName: string,
  year: number,
  month: number
): ExportData {
  return {
    transactions: transactions.map(t => ({
      id: t.id,
      date: new Date(t.transactionDate).toLocaleDateString('pt-BR'),
      description: t.description || '-',
      category: t.category,
      type: getTypeLabel(t.type),
      amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount,
      notes: t.notes,
    })),
    competency: {
      name: competencyName,
      year,
      month,
    },
  };
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'income':
      return 'Receita';
    case 'expense':
      return 'Despesa';
    case 'credit_card':
      return 'Cartão de Crédito';
    default:
      return type;
  }
}
