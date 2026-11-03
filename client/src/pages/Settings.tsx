import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Edit2, Save, X, ExternalLink, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

const typologySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["income", "expense", "credit_card"]),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

type TypologyFormData = z.infer<typeof typologySchema>;

interface TypologyLink {
  url: string;
  title: string;
}

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
  const [selectedParentId, setSelectedParentId] = useState<number | undefined>(undefined);
  const [typologyLinks, setTypologyLinks] = useState<TypologyLink[]>([]);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  // Planilha Google onde os dados ficam salvos
  const { data: spreadsheet } = trpc.spreadsheet.info.useQuery();
  const reloadMutation = trpc.spreadsheet.reload.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      toast.success("Dados recarregados da planilha");
    },
    onError: error => toast.error(`Erro ao recarregar: ${error.message}`),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TypologyFormData>({
    resolver: zodResolver(typologySchema),
    defaultValues: {
      type: "expense",
    },
  });

  const onSubmit = async (data: TypologyFormData) => {
    const linksJson = typologyLinks.length > 0 ? JSON.stringify(typologyLinks) : undefined;
    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          ...data,
          color: selectedColor,
          parentId: selectedParentId,
          links: linksJson,
        });
        setEditingId(null);
        toast.success("Tipologia atualizada com sucesso!");
      } else {
        await createMutation.mutateAsync({
          ...data,
          color: selectedColor,
          parentId: selectedParentId,
          links: linksJson,
        });
        toast.success("Tipologia criada com sucesso!");
      }
      reset();
      setSelectedColor(COLORS[0]);
      setSelectedType("expense");
      setSelectedParentId(undefined);
      setTypologyLinks([]);
      setLinkTitle("");
      setLinkUrl("");
      utils.typology.list.invalidate();
    } catch (error) {
      toast.error("Erro ao salvar tipologia");
      console.error("Erro ao salvar tipologia:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja deletar esta tipologia?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        toast.success("Tipologia deletada com sucesso!");
        utils.typology.list.invalidate();
      } catch (error) {
        toast.error("Erro ao deletar tipologia");
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="typologies">Tipologias</TabsTrigger>
          <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
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

              {/* Categoria pai */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Categoria pai (opcional)
                </label>
                <select
                  value={selectedParentId ?? ""}
                  onChange={(e) =>
                    setSelectedParentId(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  className="input-elegant w-full"
                >
                  <option value="">Nenhuma (categoria raiz)</option>
                  {(typologies ?? [])
                    .filter((t) => t.type === selectedType && t.parentId == null)
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Links */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Links
                </label>
                <div className="space-y-2">
                  {typologyLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <div className="flex-1 truncate">
                        <p className="text-sm font-medium text-foreground truncate">{link.title || "Sem título"}</p>
                        <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTypologyLinks(typologyLinks.filter((_, i) => i !== idx))}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Título do link"
                      value={linkTitle}
                      onChange={(e) => setLinkTitle(e.target.value)}
                      className="input-elegant w-full"
                    />
                    <input
                      type="url"
                      placeholder="URL"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="input-elegant w-full"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (linkTitle.trim() && linkUrl.trim()) {
                        setTypologyLinks([...typologyLinks, { title: linkTitle.trim(), url: linkUrl.trim() }]);
                        setLinkTitle("");
                        setLinkUrl("");
                      }
                    }}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm font-medium w-full"
                  >
                    Adicionar Link
                  </button>
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
                      setSelectedParentId(undefined);
                      setTypologyLinks([]);
                      setLinkTitle("");
                      setLinkUrl("");
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
                        onClick={() => {
                          setEditingId(typology.id);
                          setSelectedColor(typology.color || COLORS[0]);
                          setSelectedType(typology.type);
                          setSelectedParentId(typology.parentId ?? undefined);
                          try {
                            setTypologyLinks(typology.links ? JSON.parse(typology.links) : []);
                          } catch {
                            setTypologyLinks([]);
                          }
                          setLinkTitle("");
                          setLinkUrl("");
                        }}
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
              Planilha Google
            </h2>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Todos os seus dados (lançamentos, cartões, faturas, categorias etc.) ficam
                salvos na planilha <strong>Financeiro Doméstico</strong> do seu Google Drive,
                uma aba por tipo de registro. Não há banco de dados nem servidor.
              </p>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-muted-foreground">
                  Você pode consultar a planilha a qualquer momento. Evite renomear abas ou a
                  primeira linha de cada aba: o aplicativo usa esses nomes para ler os dados.
                  Se editar a planilha diretamente, clique em “Recarregar dados”.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                {spreadsheet?.url && (
                  <Button asChild className="flex-1">
                    <a href={spreadsheet.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Abrir planilha
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => reloadMutation.mutate()}
                  disabled={reloadMutation.isPending}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${reloadMutation.isPending ? "animate-spin" : ""}`}
                  />
                  Recarregar dados
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayoutCustom>
  );
}
