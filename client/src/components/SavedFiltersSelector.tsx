import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";

interface SavedFiltersProps {
  currentFilters: {
    startDate?: string;
    endDate?: string;
    categories?: string[];
    types?: string[];
    minAmount?: number;
    maxAmount?: number;
  };
  onFilterSelect: (filter: any) => void;
  onFilterSave: (filterName: string) => void;
}

export default function SavedFiltersSelector({
  currentFilters,
  onFilterSelect,
  onFilterSave,
}: SavedFiltersProps) {
  const { data: savedFilters, isLoading } = (trpc.savedFilter?.list?.useQuery?.() || { data: [], isLoading: false }) as any;
  const createMutation = (trpc.savedFilter?.create?.useMutation?.() || { mutateAsync: async () => {} }) as any;
  const deleteMutation = (trpc.savedFilter?.delete?.useMutation?.() || { mutateAsync: async () => {} }) as any;
  const deleteAllMutation = (trpc.savedFilter?.deleteAll?.useMutation?.() || { mutateAsync: async () => {} }) as any;
  const utils = trpc.useUtils?.() as any;

  const [selectedFilterId, setSelectedFilterId] = useState<string>("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSelectFilter = (filterId: string) => {
    setSelectedFilterId(filterId);
    const selected = savedFilters?.find((f: any) => f.id === parseInt(filterId));
    if (selected) {
      const filter = {
        startDate: selected.startDate
          ? new Date(selected.startDate).toISOString().split("T")[0]
          : "",
        endDate: selected.endDate
          ? new Date(selected.endDate).toISOString().split("T")[0]
          : "",
        categories: selected.categories
          ? JSON.parse(selected.categories)
          : undefined,
        types: selected.types ? JSON.parse(selected.types) : undefined,
        minAmount: selected.minAmount ? parseFloat(selected.minAmount) : undefined,
        maxAmount: selected.maxAmount ? parseFloat(selected.maxAmount) : undefined,
      };
      onFilterSelect(filter);
      toast.success(`Filtro "${selected.name}" carregado e aplicado!`);
    }
  };

  const handleSaveFilter = async () => {
    if (!filterName.trim()) {
      toast.error("Nome do filtro é obrigatório");
      return;
    }

    setIsSaving(true);
    try {
      await createMutation.mutateAsync({
        name: filterName,
        startDate: currentFilters.startDate
          ? new Date(currentFilters.startDate)
          : undefined,
        endDate: currentFilters.endDate
          ? new Date(currentFilters.endDate)
          : undefined,
        categories: currentFilters.categories,
        types: currentFilters.types as any,
        minAmount: currentFilters.minAmount,
        maxAmount: currentFilters.maxAmount,
      } as any);

      await utils.savedFilter.list.invalidate();
      setFilterName("");
      setShowSaveDialog(false);
      toast.success("Filtro salvo e aplicado com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar filtro");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFilter = async (filterId: number) => {
    if (!confirm("Tem certeza que deseja deletar este filtro?")) return;

    try {
      await deleteMutation.mutateAsync({ id: filterId });
      await utils.savedFilter.list.invalidate();
      setSelectedFilterId("");
      toast.success("Filtro deletado com sucesso!");
    } catch (error) {
      toast.error("Erro ao deletar filtro");
    }
  };

  const handleDeleteAllFilters = async () => {
    if (!confirm("Tem certeza que deseja deletar TODOS os filtros salvos? Esta ação não pode ser desfeita.")) return;

    try {
      await deleteAllMutation.mutateAsync();
      await utils.savedFilter.list.invalidate();
      setSelectedFilterId("");
      toast.success("Todos os filtros foram deletados!");
    } catch (error) {
      toast.error("Erro ao deletar filtros");
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Selector */}
      <Select value={selectedFilterId} onValueChange={handleSelectFilter}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Selecionar filtro salvo..." />
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <div className="p-2 text-sm text-muted-foreground">Carregando...</div>
          ) : savedFilters && savedFilters.length > 0 ? (
            savedFilters.map((filter: any) => (
              <SelectItem key={filter.id} value={filter.id.toString()}>
                {filter.name}
              </SelectItem>
            ))
          ) : (
            <div className="p-2 text-sm text-muted-foreground">
              Nenhum filtro salvo
            </div>
          )}
        </SelectContent>
      </Select>

      {/* Delete Button */}
      {selectedFilterId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            handleDeleteFilter(parseInt(selectedFilterId))
          }
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          title="Deletar este filtro"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}

      {/* Delete All Button */}
      {savedFilters && savedFilters.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleDeleteAllFilters}
          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          title="Deletar todos os filtros salvos"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Limpar Tudo
        </Button>
      )}

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar Filtro
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar Filtro Atual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome do Filtro
              </label>
              <Input
                placeholder="Ex: Despesas de Alimentação"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveFilter}
                disabled={isSaving || !filterName.trim()}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
