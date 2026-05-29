import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ColumnHeaderProps {
  label: string;
  columnId: string;
  sortColumn?: string | null;
  sortOrder?: 'asc' | 'desc';
  onSort?: (columnId: string, order: 'asc' | 'desc') => void;
  onFilter?: (columnId: string, value: string | undefined) => void;
  filterType?: 'text' | 'select' | 'date';
  filterOptions?: Array<{ label: string; value: string }>;
  currentFilterValue?: string;
}

export const ColumnHeader: React.FC<ColumnHeaderProps> = ({
  label,
  columnId,
  sortColumn,
  sortOrder,
  onSort,
  onFilter,
  filterType = 'text',
  filterOptions = [],
  currentFilterValue,
}) => {
  const [filterValue, setFilterValue] = useState(currentFilterValue || '');
  const isSorted = sortColumn === columnId;

  const handleSort = (order: 'asc' | 'desc') => {
    onSort?.(columnId, order);
  };

  const handleFilterChange = (value: string) => {
    setFilterValue(value);
    onFilter?.(columnId, value || undefined);
  };

  const handleClearFilter = () => {
    setFilterValue('');
    onFilter?.(columnId, undefined);
  };

  return (
    <div className="flex items-center gap-1 group">
      <span className="font-semibold">{label}</span>
      
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Filter className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3" align="start">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Ordenar</p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={isSorted && sortOrder === 'asc' ? 'default' : 'outline'}
                onClick={() => handleSort('asc')}
                className="flex-1 gap-1"
              >
                <ArrowUp className="w-3 h-3" />
                A-Z
              </Button>
              <Button
                size="sm"
                variant={isSorted && sortOrder === 'desc' ? 'default' : 'outline'}
                onClick={() => handleSort('desc')}
                className="flex-1 gap-1"
              >
                <ArrowDown className="w-3 h-3" />
                Z-A
              </Button>
            </div>

            <div className="border-t pt-2 mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Filtrar</p>
              
              {filterType === 'text' && (
                <div className="space-y-2">
                  <Input
                    placeholder={`Filtrar por ${label.toLowerCase()}...`}
                    value={filterValue}
                    onChange={(e) => handleFilterChange(e.target.value)}
                    className="h-8 text-sm"
                  />
                  {filterValue && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearFilter}
                      className="w-full text-xs"
                    >
                      Limpar filtro
                    </Button>
                  )}
                </div>
              )}

              {filterType === 'select' && (
                <div className="space-y-2">
                  <Select value={filterValue || 'all'} onValueChange={handleFilterChange}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filterValue && filterValue !== 'all' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearFilter}
                      className="w-full text-xs"
                    >
                      Limpar filtro
                    </Button>
                  )}
                </div>
              )}

              {filterType === 'date' && (
                <div className="space-y-2">
                  <Input
                    type="date"
                    value={filterValue}
                    onChange={(e) => handleFilterChange(e.target.value)}
                    className="h-8 text-sm"
                  />
                  {filterValue && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearFilter}
                      className="w-full text-xs"
                    >
                      Limpar filtro
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
