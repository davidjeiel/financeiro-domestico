/**
 * Formatting utilities for the financial app
 */

export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function getMonthName(month: number): string {
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return months[month - 1] || "";
}

export function getCompetencyName(year: number, month: number): string {
  return `${getMonthName(month)} ${year}`;
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}


/**
 * Converte uma data para string no formato YYYY-MM-DD usando um timezone especificado
 * @param date - Data a converter (padrão: data atual)
 * @param timezone - Timezone IANA (padrão: 'America/Sao_Paulo')
 */
export function getLocalDateString(date: Date = new Date(), timezone: string = 'America/Sao_Paulo'): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone
  });
  
  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value || '01';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const year = parts.find(p => p.type === 'year')?.value || '2024';
  
  return `${year}-${month}-${day}`;
}

/**
 * Converte uma data para string no formato YYYY-MM-DD usando o timezone de São Paulo
 * Isso garante que a data seja sempre correta independente do timezone do navegador
 * @deprecated Use getLocalDateString com timezone específico
 */
export function getLocalDateStringSaoPaulo(date: Date = new Date()): string {
  return getLocalDateString(date, 'America/Sao_Paulo');
}
