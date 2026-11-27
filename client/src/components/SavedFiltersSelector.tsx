import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Save, Settings2, Trash2 } from "lucide-react";
import { Link } from "wouter";
import {
  compactCriteria,
  countCriteria,
  describeCriteria,
  savedFilterToState,
  stateToSavedFilter,
  type FilterCriteria,
} from "@/lib/filterCriteria";

export type AppliedSavedFilter = ReturnType<typeof savedFilterToState> & { id: number; name: string };

interface SavedFiltersProps {
  /** Datas e critérios atuais da tela (o que será salvo). */
  currentDates: { startDate?: string; endDate?: string };
  currentCriteria: FilterCriteria;
  /** Aplica um filtro salvo: troca datas e critérios da tela. */
  onApply: (filter: AppliedSavedFilter) => void;
  cardName?: (id: number) => string | undefined;
}

export default function SavedFiltersSelector({ currentDates, currentCriteria, onApply, cardName }: SavedFiltersProps) {
  const utils = trpc.useUtils();
  const { data: savedFilters = [], isLoading } = trpc.savedFilter.list.useQuery();
  const createMutation = trpc.savedFilter.create.useMutation();
  const deleteMutation = trpc.savedFilter.delete.useMutation();

  const [selectedFilterId, setSelectedFilterId] = useState<string>("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState("");

  // O seletor só mostra um filtro enquanto a tela estiver com os critérios dele;
  // ao mexer nos filtros (ou limpar), volta para "Aplicar filtro salvo...".
  const sameState = (id: string) => {
    const row = savedFilters.find(f => f.id === Number(id));
    if (!row) return false;
    const st = savedFilterToState(row);
    return (
      st.startDate === (currentDates.startDate ?? "") &&
      st.endDate === (currentDates.endDate ?? "") &&
      JSON.stringify(compactCriteria(st.criteria)) === JSON.stringify(compactCriteria(currentCriteria))
    );
  };
  const shownFilterId = selectedFilterId && sameState(selectedFilterId) ? selectedFilterId : "";

  const hasSomething = !!currentDates.startDate || !!currentDates.endDate || countCriteria(currentCriteria) > 0;
  const summary = [
    currentDates.startDate || currentDates.endDate
      ? `Período: ${currentDates.startDate ? new Date(`${currentDates.startDate}T00:00`).toLocaleDateString("pt-BR") : "início"} a ${currentDates.endDate ? new Date(`${currentDates.endDate}T00:00`).toLocaleDateString("pt-BR") : "hoje"}`
      : null,
    ...describeCriteria(currentCriteria, cardName),
  ].filter(Boolean) as string[];

  const handleSelectFilter = (filterId: string) => {
    setSelectedFilterId(filterId);
    const selected = savedFilters.find(f => f.id === Number(filterId));
    if (!selected) return;
    onApply({ id: selected.id, name: selected.name, ...savedFilterToState(selected) });
    toast.success(`Filtro "${selected.name}" aplicado.`);
  };

  const handleSaveFilter = async () => {
    if (!filterName.trim()) return;
    try {
      const created = await createMutation.mutateAsync(stateToSavedFilter(filterName, currentDates, currentCriteria));
      await utils.savedFilter.list.invalidate();
      setSelectedFilterId(String(created.id));
      setFilterName("");
      setShowSaveDialog(false);
      toast.success("Filtro salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar filtro");
    }
  };

  const handleDeleteFilter = async (filterId: number) => {
    if (!confirm("Excluir este filtro salvo?")) return;
    try {
      await deleteMutation.mutateAsync({ id: filterId });
      await utils.savedFilter.list.invalidate();
      setSelectedFilterId("");
      toast.success("Filtro excluído.");
    } catch {
      toast.error("Erro ao excluir filtro");
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={shownFilterId} onValueChange={handleSelectFilter}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Aplicar filtro salvo..." />
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <div className="p-2 text-sm text-muted-foreground">Carregando...</div>
          ) : savedFilters.length > 0 ? (
            savedFilters.map(filter => (
              <SelectItem key={filter.id} value={String(filter.id)}>
                {filter.name}
                {filter.isDefault ? " (padrão)" : ""}
              </SelectItem>
            ))
          ) : (
            <div className="p-2 text-sm text-muted-foreground">Nenhum filtro salvo</div>
          )}
        </SelectContent>
      </Select>

      {shownFilterId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDeleteFilter(Number(shownFilterId))}
          className="text-red-500 hover:text-red-600"
          title="Excluir este filtro salvo"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}

      {savedFilters.length > 0 && (
        <Button variant="ghost" size="sm" asChild title="Editar filtros salvos e escolher o padrão">
          <Link href="/filters">
            <Settings2 className="w-4 h-4 mr-1" />
            Gerenciar
          </Link>
        </Button>
      )}

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!hasSomething}
            title={hasSomething ? "Salvar os filtros atuais" : "Preencha algum filtro para salvar"}
          >
            <Save className="w-4 h-4" />
            Salvar filtro
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar filtros atuais</DialogTitle>
            <DialogDescription>Ficam disponíveis aqui, em "Aplicar filtro salvo".</DialogDescription>
          </DialogHeader>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-0.5">
            {summary.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              handleSaveFilter();
            }}
          >
            <div>
              <label className="form-label block mb-2">Nome do filtro</label>
              <Input
                autoFocus
                placeholder="Ex: Mercado no cartão"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                className="input-elegant"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !filterName.trim()}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
