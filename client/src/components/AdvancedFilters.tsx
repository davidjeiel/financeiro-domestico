import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { X, Filter } from 'lucide-react';
import CreditCardMultiSelect from './CreditCardMultiSelect';
import { countCriteria, type FilterCriteria } from '@/lib/filterCriteria';

/** Critérios aplicados com applyFilterCriteria (lib/filterCriteria). */
export type TransactionFilters = FilterCriteria & { accountId?: string };

interface AdvancedFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  accounts?: Array<{ id: number; name: string }>;
  creditCards?: Array<{ id: number; name: string }>;
  /** Categorias existentes (das tipologias e dos lançamentos). */
  categoryOptions?: string[];
  onClearFilters?: () => void;
  /** Dentro de outro painel: sempre aberto, sem o botão de expandir. */
  embedded?: boolean;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  accounts = [],
  creditCards = [],
  categoryOptions,
  onClearFilters,
  embedded = false,
}) => {
  const [expandedState, setIsExpanded] = useState(false);
  const isExpanded = embedded || expandedState;

  const activeCount = countCriteria(filters) + (filters.accountId ? 1 : 0);
  const hasActiveFilters = activeCount > 0;

  const handleFilterChange = (key: keyof TransactionFilters, value: string | undefined) => {
    const next: TransactionFilters = { ...filters, [key]: value === '' ? undefined : value };
    // Escolher um tipo/categoria/cartão pelo select substitui a lista de um filtro salvo.
    if (key === 'type') next.types = undefined;
    if (key === 'category') next.categories = undefined;
    if (key === 'creditCardId') next.creditCardIds = undefined;
    onFiltersChange(next);
  };

  const handleAmountChange = (key: 'minAmount' | 'maxAmount', raw: string) => {
    const value = raw.trim() === '' ? undefined : Number(raw.replace(',', '.'));
    onFiltersChange({ ...filters, [key]: value !== undefined && Number.isFinite(value) ? value : undefined });
  };

  const handleClear = () => {
    onFiltersChange({});
    onClearFilters?.();
    setIsExpanded(false);
  };

  const defaultCategories = {
    income: ["Salário", "Freelance", "Investimentos", "Outros"],
    expense: ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Lazer", "Outros"],
    credit_card: ["Alimentação", "Compras", "Serviços", "Outros"],
  };
  const categories = categoryOptions?.length
    ? categoryOptions
    : filters.type
      ? defaultCategories[filters.type as keyof typeof defaultCategories] || []
      : Array.from(new Set(Object.values(defaultCategories).flat()));

  return (
    <div className="space-y-3">
      {!embedded && (
      <div className="flex items-center gap-2">
        <Button
          variant={hasActiveFilters ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filtros
          {hasActiveFilters && (
            <span className="ml-1 px-2 py-0.5 bg-primary-foreground text-primary rounded text-xs font-medium">
              {activeCount}
            </span>
          )}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
            Limpar
          </Button>
        )}
      </div>
      )}

      {isExpanded && (
        <Card className={embedded ? "p-0 space-y-3 bg-transparent border-0 shadow-none" : "p-4 space-y-3 bg-muted/50"}>
          {/* Type Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Tipo
              </label>
              <Select
                value={filters.types?.length ? 'multi' : filters.type || 'all'}
                onValueChange={(value) =>
                  handleFilterChange('type', value === 'all' ? undefined : (value as 'income' | 'expense' | 'credit_card'))
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {!!filters.types?.length && (
                    <SelectItem value="multi" disabled>{filters.types.length} tipos (filtro salvo)</SelectItem>
                  )}
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Categoria
              </label>
              <Select
                value={filters.categories?.length ? 'multi' : filters.category || 'all'}
                onValueChange={(value) =>
                  handleFilterChange('category', value === 'all' ? undefined : value)
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {!!filters.categories?.length && (
                    <SelectItem value="multi" disabled>{filters.categories.join(", ")}</SelectItem>
                  )}
                  {categories.map((cat: string) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account Filter */}
            {accounts.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Conta
                </label>
                <Select
                  value={filters.accountId || 'all'}
                  onValueChange={(value) =>
                    handleFilterChange('accountId', value === 'all' ? undefined : value)
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Todas as contas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as contas</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Credit Card Filter */}
            {creditCards.length > 0 && filters.type === 'credit_card' ? (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Selecionar Cartões
                </label>
                <CreditCardMultiSelect
                  creditCards={creditCards.map(c => ({
                    id: c.id,
                    name: c.name,
                    lastDigits: (c as any).lastDigits,
                    color: (c as any).color,
                  }))}
                  selectedIds={filters.creditCardIds || []}
                  onSelectionChange={(ids) =>
                    onFiltersChange({
                      ...filters,
                      creditCardId: undefined,
                      creditCardIds: ids.length === 0 ? undefined : ids,
                    })
                  }
                />
              </div>
            ) : creditCards.length > 0 ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Cartão de Crédito
                </label>
                <Select
                  value={filters.creditCardIds?.length ? 'multi' : filters.creditCardId || 'all'}
                  onValueChange={(value) =>
                    handleFilterChange('creditCardId', value === 'all' ? undefined : value)
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Todos os cartões" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os cartões</SelectItem>
                    {!!filters.creditCardIds?.length && (
                      <SelectItem value="multi" disabled>{filters.creditCardIds.length} cartões (filtro salvo)</SelectItem>
                    )}
                    {creditCards.map((card) => (
                      <SelectItem key={card.id} value={card.id.toString()}>
                        {card.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {/* Description Filter */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Descrição
              </label>
              <Input
                placeholder="Buscar por descrição..."
                value={filters.description || ''}
                onChange={(e) =>
                  handleFilterChange('description', e.target.value || undefined)
                }
                className="h-8 text-sm"
              />
            </div>

            {/* Faixa de valores */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Valor mínimo (R$)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={filters.minAmount ?? ''}
                onChange={(e) => handleAmountChange('minAmount', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Valor máximo (R$)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="Sem limite"
                value={filters.maxAmount ?? ''}
                onChange={(e) => handleAmountChange('maxAmount', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
