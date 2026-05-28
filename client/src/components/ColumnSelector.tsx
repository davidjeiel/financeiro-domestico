import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Settings2 } from 'lucide-react';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

interface ColumnSelectorProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  onSort?: (columnId: string, order: 'asc' | 'desc') => void;
}

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  columns,
  onColumnsChange,
  onSort,
}) => {
  const handleToggleColumn = (columnId: string) => {
    const updated = columns.map((col) =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    onColumnsChange(updated);
  };

  const handleShowAll = () => {
    const updated = columns.map((col) => ({ ...col, visible: true }));
    onColumnsChange(updated);
  };

  const handleHideAll = () => {
    const updated = columns.map((col) => ({ ...col, visible: false }));
    onColumnsChange(updated);
  };

  const handleSort = (columnId: string, order: 'asc' | 'desc') => {
    onSort?.(columnId, order);
  };

  const visibleCount = columns.filter((col) => col.visible).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          title="Organizar colunas"
        >
          <Settings2 className="w-4 h-4" />
          Colunas ({visibleCount})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium">Exibir colunas</p>
            <div className="flex gap-1">
              <button
                onClick={handleShowAll}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Todas
              </button>
              <span className="text-xs text-muted-foreground">/</span>
              <button
                onClick={handleHideAll}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Nenhuma
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 p-1 hover:bg-muted rounded"
              >
                <Checkbox
                  id={`col-${column.id}`}
                  checked={column.visible}
                  onCheckedChange={() => handleToggleColumn(column.id)}
                />
                <label
                  htmlFor={`col-${column.id}`}
                  className="text-sm cursor-pointer flex-1"
                >
                  {column.label}
                </label>
                <div className="flex gap-0.5 ml-auto">
                  <button
                    onClick={() => handleSort(column.id, 'asc')}
                    className="text-xs px-1.5 py-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
                    title="Ordenar A-Z ou 1-9"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleSort(column.id, 'desc')}
                    className="text-xs px-1.5 py-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
                    title="Ordenar Z-A ou 9-1"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
