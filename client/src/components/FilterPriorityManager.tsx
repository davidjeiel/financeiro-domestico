import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GripVertical, Filter, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface FilterPriorityManagerProps {
  filters: Record<string, string>;
  priority: string[];
  onPriorityChange: (priority: string[]) => void;
  onFilterRemove: (columnId: string) => void;
}

const columnLabels: Record<string, string> = {
  transactionDate: 'Data',
  description: 'Descrição',
  category: 'Categoria',
  type: 'Tipo',
  amount: 'Valor',
  isPaid: 'Pago',
};

export const FilterPriorityManager: React.FC<FilterPriorityManagerProps> = ({
  filters,
  priority,
  onPriorityChange,
  onFilterRemove,
}) => {
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const activeFilters = Object.entries(filters).map(([key, value]) => ({ key, value }));

  if (activeFilters.length === 0) {
    return null;
  }

  const handleDragStart = (columnId: string) => {
    setIsDragging(columnId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetColumnId: string) => {
    if (!isDragging || isDragging === targetColumnId) {
      setIsDragging(null);
      return;
    }

    const newPriority = [...priority];
    const draggedIndex = newPriority.indexOf(isDragging);
    const targetIndex = newPriority.indexOf(targetColumnId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      [newPriority[draggedIndex], newPriority[targetIndex]] = [
        newPriority[targetIndex],
        newPriority[draggedIndex],
      ];
      onPriorityChange(newPriority);
    }

    setIsDragging(null);
  };

  const handleRemoveFilter = (columnId: string) => {
    onFilterRemove(columnId);
  };

  const sortedFilters = priority
    .filter((p) => filters[p] !== undefined)
    .map((p) => ({ key: p, value: filters[p] }));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Prioridade de Filtros
          {activeFilters.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-primary-foreground text-primary rounded text-xs font-medium">
              {activeFilters.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground mb-3">
              Arraste para reordenar a prioridade dos filtros
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Filtros no topo têm maior prioridade na ordenação
            </p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sortedFilters.length > 0 ? (
              sortedFilters.map((filter, index) => (
                <Card
                  key={filter.key}
                  draggable
                  onDragStart={() => handleDragStart(filter.key)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(filter.key)}
                  className={`p-3 flex items-center gap-2 cursor-move transition-all ${
                    isDragging === filter.key ? 'opacity-50 bg-muted' : 'hover:bg-muted/50'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {columnLabels[filter.key] || filter.key}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {filter.value}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveFilter(filter.key)}
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum filtro ativo
              </p>
            )}
          </div>

          {sortedFilters.length > 1 && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2">
                Ordem atual de aplicação dos filtros:
              </p>
              <div className="flex flex-wrap gap-1">
                {sortedFilters.map((filter, index) => (
                  <span key={filter.key} className="text-xs bg-muted px-2 py-1 rounded">
                    {index + 1}. {columnLabels[filter.key] || filter.key}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
