import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { X, Filter } from 'lucide-react';
// CATEGORIES será passado como prop ou definido localmente

export interface TransactionFilters {
  category?: string;
  accountId?: string;
  creditCardId?: string;
  type?: 'income' | 'expense' | 'credit_card';
  description?: string;
}

interface AdvancedFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  accounts?: Array<{ id: number; name: string }>;
  creditCards?: Array<{ id: number; name: string }>;
  onClearFilters?: () => void;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  accounts = [],
  creditCards = [],
  onClearFilters,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  const handleFilterChange = (key: keyof TransactionFilters, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value === '' ? undefined : value,
    });
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
  const categories = filters.type
    ? defaultCategories[filters.type as keyof typeof defaultCategories] || []
    : Object.values(defaultCategories).flat();

  return (
    <div className="space-y-3">
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
              {Object.values(filters).filter((v) => v !== undefined && v !== '').length}
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

      {isExpanded && (
        <Card className="p-4 space-y-3 bg-muted/50">
          {/* Type Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Tipo
              </label>
              <Select
                value={filters.type || ''}
                onValueChange={(value) =>
                  handleFilterChange('type', value || undefined)
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os tipos</SelectItem>
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
                value={filters.category || ''}
                onValueChange={(value) =>
                  handleFilterChange('category', value || undefined)
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as categorias</SelectItem>
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
                  value={filters.accountId || ''}
                  onValueChange={(value) =>
                    handleFilterChange('accountId', value || undefined)
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Todas as contas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as contas</SelectItem>
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
            {creditCards.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Cartão de Crédito
                </label>
                <Select
                  value={filters.creditCardId || ''}
                  onValueChange={(value) =>
                    handleFilterChange('creditCardId', value || undefined)
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Todos os cartões" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os cartões</SelectItem>
                    {creditCards.map((card) => (
                      <SelectItem key={card.id} value={card.id.toString()}>
                        {card.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
          </div>
        </Card>
      )}
    </div>
  );
};
