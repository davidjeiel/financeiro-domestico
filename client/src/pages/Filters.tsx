import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Calendar, Save, Trash2, Plus } from "lucide-react";

const filterSchema = z.object({
  name: z.string().min(1, "Nome do filtro é obrigatório"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minAmount: z.string().optional(),
  maxAmount: z.string().optional(),
});

type FilterFormData = z.infer<typeof filterSchema>;

export default function Filters() {
  const [savedFilters, setSavedFilters] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
  });

  const categories = [
    "Salário",
    "Alimentação",
    "Transporte",
    "Saúde",
    "Educação",
    "Lazer",
    "Utilidades",
    "Outros",
  ];

  const types = [
    { value: "income", label: "Receita" },
    { value: "expense", label: "Despesa" },
    { value: "credit_card", label: "Cartão de Crédito" },
  ];

  const onSubmit = async (data: FilterFormData) => {
    try {
      const newFilter = {
        id: Date.now(),
        ...data,
        categories: selectedCategories,
        types: selectedTypes,
        isDefault: false,
      };
      setSavedFilters([...savedFilters, newFilter]);
      toast.success("Filtro salvo com sucesso!");
      reset();
      setSelectedCategories([]);
      setSelectedTypes([]);
    } catch (error) {
      toast.error("Erro ao salvar filtro");
    }
  };

  const handleDeleteFilter = (id: number) => {
    setSavedFilters(savedFilters.filter(f => f.id !== id));
    toast.success("Filtro removido");
  };

  const handleSetDefault = (id: number) => {
    setSavedFilters(savedFilters.map(f => ({
      ...f,
      isDefault: f.id === id ? !f.isDefault : false,
    })));
  };

  return (
    <DashboardLayoutCustom title="Gerenciar Filtros">
      <div className="space-y-6">
        {/* Criar Novo Filtro */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Criar Novo Filtro</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Nome do Filtro */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Nome do Filtro
              </label>
              <Input
                {...register("name")}
                placeholder="Ex: Últimos 30 dias, Despesas de Alimentação"
                className="input-elegant"
              />
              {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
            </div>

            {/* Período */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Data Inicial
                </label>
                <Input
                  {...register("startDate")}
                  type="date"
                  className="input-elegant"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Data Final
                </label>
                <Input
                  {...register("endDate")}
                  type="date"
                  className="input-elegant"
                />
              </div>
            </div>

            {/* Valores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Valor Mínimo (R$)
                </label>
                <Input
                  {...register("minAmount")}
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  className="input-elegant"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Valor Máximo (R$)
                </label>
                <Input
                  {...register("maxAmount")}
                  type="number"
                  step="0.01"
                  placeholder="9999,99"
                  className="input-elegant"
                />
              </div>
            </div>

            {/* Categorias */}
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">
                Categorias
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categories.map(cat => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedCategories.includes(cat)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCategories([...selectedCategories, cat]);
                        } else {
                          setSelectedCategories(selectedCategories.filter(c => c !== cat));
                        }
                      }}
                    />
                    <span className="text-sm text-foreground">{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tipos */}
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">
                Tipos de Transação
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {types.map(type => (
                  <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedTypes.includes(type.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedTypes([...selectedTypes, type.value]);
                        } else {
                          setSelectedTypes(selectedTypes.filter(t => t !== type.value));
                        }
                      }}
                    />
                    <span className="text-sm text-foreground">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Save className="w-4 h-4 mr-2" />
              Salvar Filtro
            </Button>
          </form>
        </Card>

        {/* Filtros Salvos */}
        {savedFilters.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Filtros Salvos</h2>
            <div className="space-y-3">
              {savedFilters.map(filter => (
                <div
                  key={filter.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-foreground">{filter.name}</p>
                      {filter.isDefault && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">
                          Padrão
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {filter.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          De {new Date(filter.startDate).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {filter.endDate && (
                        <span className="flex items-center gap-1">
                          até {new Date(filter.endDate).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {filter.categories.length > 0 && (
                        <span>{filter.categories.length} categorias</span>
                      )}
                      {filter.types.length > 0 && (
                        <span>{filter.types.length} tipos</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetDefault(filter.id)}
                      className={filter.isDefault ? "bg-primary/10" : ""}
                    >
                      {filter.isDefault ? "✓ Padrão" : "Usar como Padrão"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteFilter(filter.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Informações */}
        <Card className="p-6 bg-primary/10 border border-primary/20">
          <h3 className="font-semibold text-foreground mb-2">Dicas de Uso</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>✓ Crie filtros para visualizar rapidamente transações específicas</li>
            <li>✓ Defina um filtro como padrão para carregá-lo automaticamente</li>
            <li>✓ Combine múltiplas categorias e tipos para filtros mais precisos</li>
            <li>✓ Use intervalos de valores para análises de gastos</li>
          </ul>
        </Card>
      </div>
    </DashboardLayoutCustom>
  );
}
