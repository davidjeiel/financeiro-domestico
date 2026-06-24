import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Edit2 } from "lucide-react";
import { toast } from "sonner";

type TransactionType = "income" | "expense" | "credit_card";

interface CategoryForm {
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
}

export default function CategoriesManagement() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CategoryForm>({
    name: "",
    type: "expense",
    icon: "📌",
    color: "#EF4444",
  });

  const { data: categories, isLoading, refetch } = trpc.typology.list.useQuery();
  const createMutation = trpc.typology.create.useMutation();
  const updateMutation = trpc.typology.update.useMutation();
  const deleteMutation = trpc.typology.delete.useMutation();

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    try {
      if (editingId !== null) {
        await updateMutation.mutateAsync({
          id: editingId,
          name: formData.name,
          icon: formData.icon,
          color: formData.color,
        });
        toast.success("Categoria atualizada com sucesso!");
      } else {
        await createMutation.mutateAsync({
          name: formData.name,
          type: formData.type,
          icon: formData.icon,
          color: formData.color,
        });
        toast.success("Categoria criada com sucesso!");
      }

      setFormData({ name: "", type: "expense", icon: "📌", color: "#EF4444" });
      setEditingId(null);
      setIsOpen(false);
      refetch();
    } catch (error: any) {
      const errorMessage = error?.message || error?.data?.code || "Erro ao salvar categoria";
      toast.error(errorMessage);
      console.error("[Categories] Error saving:", error);
    }
  };

  const handleEdit = (category: any) => {
    setFormData({
      name: category.name,
      type: category.type,
      icon: category.icon || "📌",
      color: category.color || "#EF4444",
    });
    setEditingId(category.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja deletar esta categoria?")) return;

    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Categoria deletada com sucesso!");
      refetch();
    } catch (error: any) {
      const errorMessage = error?.message || error?.data?.code || "Erro ao deletar categoria";
      toast.error(errorMessage);
      console.error("[Categories] Error deleting:", error);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData({ name: "", type: "expense", icon: "📌", color: "#EF4444" });
  };

  const groupedCategories = categories?.reduce((acc, cat) => {
    const key = cat.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(cat);
    return acc;
  }, {} as Record<TransactionType, any[]>) || {};

  const typeLabels: Record<TransactionType, string> = {
    income: "Receitas",
    expense: "Despesas",
    credit_card: "Cartão de Crédito",
  };

  const typeColors: Record<TransactionType, string> = {
    income: "bg-green-50 border-green-200",
    expense: "bg-red-50 border-red-200",
    credit_card: "bg-blue-50 border-blue-200",
  };

  return (
    <DashboardLayoutCustom>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Categorias</h1>
            <p className="text-gray-600 mt-1">
              Crie e organize suas categorias de lançamentos
            </p>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingId(null);
                setFormData({ name: "", type: "expense", icon: "📌", color: "#EF4444" });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Editar Categoria" : "Nova Categoria"}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados da categoria
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nome</label>
                  <Input
                    placeholder="Ex: Alimentação"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Tipo</label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value as TransactionType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                      <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Ícone</label>
                  <Input
                    placeholder="Ex: 🍔"
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData({ ...formData, icon: e.target.value })
                    }
                    maxLength={2}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Cor</label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="w-12 h-10"
                    />
                    <Input
                      placeholder="#EF4444"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={handleClose}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingId ? "Atualizar" : "Criar"} Categoria
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Carregando categorias...</div>
        ) : (
          <div className="space-y-6">
            {(Object.entries(groupedCategories) as [TransactionType, any[]][]).map(
              ([type, cats]) => (
                <Card key={type} className={typeColors[type]}>
                  <CardHeader>
                    <CardTitle className="text-lg">{typeLabels[type]}</CardTitle>
                    <CardDescription>
                      {cats.length} categor{cats.length !== 1 ? "ias" : "ia"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {cats.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{category.icon}</span>
                            <div>
                              <p className="font-medium">{category.name}</p>
                              <div
                                className="w-6 h-3 rounded mt-1"
                                style={{ backgroundColor: category.color }}
                              />
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(category)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(category.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        )}
      </div>
    </DashboardLayoutCustom>
  );
}
