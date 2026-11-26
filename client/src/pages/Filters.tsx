import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Calendar, Loader2, Pencil, Play, Plus, Save, Star, Trash2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { buildTransactionsUrl } from "@/lib/transactionFilters";
import {
  countCriteria,
  describeCriteria,
  savedFilterToState,
  selectedCardIds,
  selectedCategories,
  selectedTypes,
  stateToSavedFilter,
  type TxType,
} from "@/lib/filterCriteria";

type FormState = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  types: TxType[];
  categories: string[];
  creditCardIds: number[];
};

const EMPTY: FormState = {
  name: "",
  description: "",
  startDate: "",
  endDate: "",
  minAmount: "",
  maxAmount: "",
  types: [],
  categories: [],
  creditCardIds: [],
};

const TYPES: { value: TxType; label: string }[] = [
  { value: "income", label: "Receita" },
  { value: "expense", label: "Despesa" },
  { value: "credit_card", label: "Cartão de Crédito" },
];

const toAmount = (raw: string) => {
  if (!raw.trim()) return undefined;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

const toggle = <T,>(list: T[], value: T, on: boolean) => (on ? [...list, value] : list.filter(v => v !== value));

export default function Filters() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: savedFilters = [], isLoading } = trpc.savedFilter.list.useQuery();
  const { data: typologies = [] } = trpc.typology.list.useQuery();
  const { data: creditCards = [] } = trpc.creditCard.list.useQuery();
  const createMutation = trpc.savedFilter.create.useMutation();
  const updateMutation = trpc.savedFilter.update.useMutation();
  const deleteMutation = trpc.savedFilter.delete.useMutation();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nameError, setNameError] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }));

  const categories = Array.from(
    new Set(typologies.filter(t => t.isActive !== 0 && !t.parentId).map(t => t.name).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const cardName = (id: number) => creditCards.find(c => c.id === id)?.name;

  const criteria = {
    description: form.description,
    types: form.types,
    categories: form.categories,
    creditCardIds: form.creditCardIds,
    minAmount: toAmount(form.minAmount),
    maxAmount: toAmount(form.maxAmount),
  };
  const isEmpty = !form.startDate && !form.endDate && countCriteria(criteria) === 0;
  const saving = createMutation.isPending || updateMutation.isPending;

  const resetForm = () => {
    setForm(EMPTY);
    setEditingId(null);
    setNameError(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    if (isEmpty) {
      toast.error("Preencha ao menos um critério (descrição, período, valor, tipo, categoria ou cartão).");
      return;
    }
    const min = criteria.minAmount;
    const max = criteria.maxAmount;
    if (min !== undefined && max !== undefined && min > max) {
      toast.error("O valor mínimo é maior que o máximo.");
      return;
    }
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      toast.error("A data inicial é depois da final.");
      return;
    }
    const input = stateToSavedFilter(form.name, { startDate: form.startDate, endDate: form.endDate }, criteria);
    try {
      if (editingId) {
        const { name, ...rest } = input;
        await updateMutation.mutateAsync({ id: editingId, name, criteria: rest });
        toast.success("Filtro atualizado.");
      } else {
        await createMutation.mutateAsync(input);
        toast.success("Filtro salvo.");
      }
      await utils.savedFilter.list.invalidate();
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar filtro");
    }
  };

  const startEdit = (filter: (typeof savedFilters)[number]) => {
    const state = savedFilterToState(filter);
    setForm({
      name: filter.name,
      description: state.criteria.description ?? "",
      startDate: state.startDate,
      endDate: state.endDate,
      minAmount: state.criteria.minAmount?.toString() ?? "",
      maxAmount: state.criteria.maxAmount?.toString() ?? "",
      types: selectedTypes(state.criteria),
      categories: selectedCategories(state.criteria),
      creditCardIds: selectedCardIds(state.criteria),
    });
    setEditingId(filter.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este filtro salvo?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      await utils.savedFilter.list.invalidate();
      if (editingId === id) resetForm();
      toast.success("Filtro excluído.");
    } catch {
      toast.error("Erro ao excluir filtro");
    }
  };

  const handleSetDefault = async (id: number, isDefault: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, isDefault });
      await utils.savedFilter.list.invalidate();
      toast.success(isDefault ? "Filtro padrão definido: abre junto com Lançamentos." : "Filtro deixou de ser padrão.");
    } catch {
      toast.error("Erro ao atualizar filtro");
    }
  };

  const br = (d: string) => new Date(`${d}T00:00`).toLocaleDateString("pt-BR");

  return (
    <DashboardLayoutCustom title="Gerenciar Filtros">
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            {editingId ? <Pencil className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
            <h2 className="text-xl font-semibold text-foreground">{editingId ? "Editar filtro" : "Criar novo filtro"}</h2>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label block mb-2">Nome do filtro</label>
                <Input
                  value={form.name}
                  onChange={e => {
                    set("name", e.target.value);
                    setNameError(false);
                  }}
                  placeholder="Ex: Mercado no cartão"
                  className="input-elegant"
                />
                {nameError && <p className="text-red-500 text-sm mt-1">Nome do filtro é obrigatório</p>}
              </div>
              <div>
                <label className="form-label block mb-2">Descrição contém</label>
                <Input
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  placeholder="Ex: mercado (ignora acentos e maiúsculas)"
                  className="input-elegant"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label block mb-2">Data inicial</label>
                <Input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} className="input-elegant" />
              </div>
              <div>
                <label className="form-label block mb-2">Data final</label>
                <Input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} className="input-elegant" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label block mb-2">Valor mínimo (R$)</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.minAmount}
                  onChange={e => set("minAmount", e.target.value)}
                  placeholder="0,00"
                  className="input-elegant"
                />
              </div>
              <div>
                <label className="form-label block mb-2">Valor máximo (R$)</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.maxAmount}
                  onChange={e => set("maxAmount", e.target.value)}
                  placeholder="Sem limite"
                  className="input-elegant"
                />
              </div>
            </div>

            <div>
              <label className="form-label block mb-3">Tipos de movimentação</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {TYPES.map(type => (
                  <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.types.includes(type.value)}
                      onCheckedChange={checked => set("types", toggle(form.types, type.value, !!checked))}
                    />
                    <span className="text-sm text-foreground">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label block mb-3">Categorias</label>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {categories.map(cat => (
                    <label key={cat} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={form.categories.includes(cat)}
                        onCheckedChange={checked => set("categories", toggle(form.categories, cat, !!checked))}
                      />
                      <span className="text-sm text-foreground">{cat}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {creditCards.length > 0 && (
              <div>
                <label className="form-label block mb-3">Cartões</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {creditCards.map(card => (
                    <label key={card.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={form.creditCardIds.includes(card.id)}
                        onCheckedChange={checked => set("creditCardIds", toggle(form.creditCardIds, card.id, !!checked))}
                      />
                      <span className="text-sm text-foreground">{card.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar edição
                </Button>
              )}
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {editingId ? "Salvar alterações" : "Salvar filtro"}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Filtros salvos</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : savedFilters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum filtro salvo. Crie um acima ou use "Salvar filtro" no painel de filtros de Lançamentos.
            </p>
          ) : (
            <div className="space-y-3">
              {savedFilters.map(filter => {
                const state = savedFilterToState(filter);
                const parts = describeCriteria(state.criteria, cardName);
                return (
                  <div
                    key={filter.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground">{filter.name}</p>
                        {filter.isDefault === 1 && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">Padrão</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {(state.startDate || state.endDate) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {state.startDate ? `De ${br(state.startDate)}` : "Desde o início"}
                            {state.endDate ? ` até ${br(state.endDate)}` : ""}
                          </span>
                        )}
                        {parts.map(p => (
                          <span key={p}>{p}</span>
                        ))}
                        {!state.startDate && !state.endDate && parts.length === 0 && <span>Sem critérios</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" onClick={() => navigate(buildTransactionsUrl({ filtro: filter.id }))}>
                        <Play className="w-4 h-4 mr-1" />
                        Aplicar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(filter)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetDefault(filter.id, filter.isDefault !== 1)}
                        className={filter.isDefault === 1 ? "border-primary text-primary" : ""}
                        title="Abrir Lançamentos já com este filtro"
                      >
                        <Star className={`w-4 h-4 mr-1 ${filter.isDefault === 1 ? "fill-current" : ""}`} />
                        {filter.isDefault === 1 ? "Padrão" : "Usar como padrão"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(filter.id)} title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6 bg-primary/10 border border-primary/20">
          <h3 className="font-semibold text-foreground mb-2">Dicas de uso</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>✓ "Aplicar" abre Lançamentos já filtrado; os critérios aparecem como etiquetas removíveis.</li>
            <li>✓ O filtro padrão é aplicado ao abrir Lançamentos quando não há outro filtro ativo.</li>
            <li>✓ Sem datas, o filtro vale para o mês aberto em Lançamentos.</li>
            <li>✓ Vários tipos, categorias ou cartões marcados valem como "qualquer um deles".</li>
          </ul>
        </Card>
      </div>
    </DashboardLayoutCustom>
  );
}
