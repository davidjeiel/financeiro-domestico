import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const typologySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["income", "expense", "credit_card"]),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

type TypologyFormData = z.infer<typeof typologySchema>;

const COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#6366F1", "#14B8A6", "#F97316",
];

export default function Settings() {
  const { data: typologies, isLoading } = trpc.typology.list.useQuery();
  const createMutation = trpc.typology.create.useMutation();
  const updateMutation = trpc.typology.update.useMutation();
  const deleteMutation = trpc.typology.delete.useMutation();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("typologies");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedType, setSelectedType] = useState<"income" | "expense" | "credit_card">("expense");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TypologyFormData>({
    resolver: zodResolver(typologySchema),
    defaultValues: {
      type: "expense",
    },
  });

  const onSubmit = async (data: TypologyFormData) => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          ...data,
          color: selectedColor,
        });
        setEditingId(null);
      } else {
        await createMutation.mutateAsync({
          ...data,
          color: selectedColor,
        });
      }
      reset();
      setSelectedColor(COLORS[0]);
      setSelectedType("expense");
      utils.typology.list.invalidate();
    } catch (error) {
      console.error("Erro ao salvar tipologia:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja deletar esta tipologia?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        utils.typology.list.invalidate();
      } catch (error) {
        console.error("Erro ao deletar tipologia:", error);
      }
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "income":
        return "Receita";
      case "expense":
        return "Despesa";
      case "credit_card":
        return "Cartão";
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "income":
        return "bg-green-500/10 text-green-500";
      case "expense":
        return "bg-red-500/10 text-red-500";
      case "credit_card":
        return "bg-blue-500/10 text-blue-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  if (isLoading) {
    return (
      <DashboardLayoutCustom>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayoutCustom>
    );
  }

  return (
    <DashboardLayoutCustom title="Configurações">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="typologies">Tipologias</TabsTrigger>
          <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
          <TabsTrigger value="github">GitHub</TabsTrigger>
        </TabsList>

        {/* Tipologias Tab */}
        <TabsContent value="typologies" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              Criar Nova Tipologia
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Nome
                  </label>
                  <input
                    {...register("name")}
                    type="text"
                    placeholder="Ex: Alimentação"
                    className="input-elegant w-full"
                  />
                  {errors.name && (
                    <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Tipo
                  </label>
                  <select
                    {...register("type")}
                    onChange={(e) => {
                      setSelectedType(e.target.value as typeof selectedType);
                      register("type").onChange(e);
                    }}
                    className="input-elegant w-full"
                  >
                    <option value="income">Receita</option>
                    <option value="expense">Despesa</option>
                    <option value="credit_card">Cartão de Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Descrição
                  </label>
                  <input
                    {...register("description")}
                    type="text"
                    placeholder="Descrição opcional"
                    className="input-elegant w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Ícone (emoji)
                  </label>
                  <input
                    {...register("icon")}
                    type="text"
                    placeholder="🍔"
                    className="input-elegant w-full"
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Cor
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        selectedColor === color
                          ? "border-foreground"
                          : "border-border"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      reset();
                      setSelectedColor(COLORS[0]);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                )}
                <Button
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingId ? "Atualizar" : "Criar"} Tipologia
                </Button>
              </div>
            </form>
          </Card>

          {/* Tipologias List */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              Tipologias Existentes
            </h2>
            {typologies && typologies.length > 0 ? (
              <div className="space-y-3">
                {typologies.map((typology) => (
                  <div
                    key={typology.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                        style={{ backgroundColor: typology.color || "#3B82F6" }}
                      >
                        {typology.icon || "•"}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{typology.name}</p>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(typology.type)}`}>
                            {getTypeLabel(typology.type)}
                          </span>
                          {typology.description && (
                            <span className="text-xs text-muted-foreground">
                              {typology.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingId(typology.id)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors text-foreground"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(typology.id)}
                        className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma tipologia criada ainda
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Google Sheets Tab */}
        <TabsContent value="sheets" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              Integração com Google Sheets
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  ID da Planilha Google
                </label>
                <input
                  type="text"
                  placeholder="Cole o ID da sua planilha aqui"
                  className="input-elegant w-full"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Encontre o ID na URL da sua planilha: https://docs.google.com/spreadsheets/d/{'{ID}'}
                </p>
              </div>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Conectar Google Sheets
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* GitHub Tab */}
        <TabsContent value="github" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              Integração com GitHub
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  URL do Repositório
                </label>
                <input
                  type="text"
                  placeholder="https://github.com/usuario/repositorio"
                  className="input-elegant w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Token de Acesso (Personal Access Token)
                </label>
                <input
                  type="password"
                  placeholder="Seu token do GitHub"
                  className="input-elegant w-full"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Crie um token em: https://github.com/settings/tokens
                </p>
              </div>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Conectar GitHub
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayoutCustom>
  );
}
