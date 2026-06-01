import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Edit2, Save, X, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import ErrorModal from "@/components/ErrorModal";
import LoadingOverlay from "@/components/LoadingOverlay";

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

  // Google Sheets
  const [sheetId, setSheetId] = useState("");
  const [isConnectingSheets, setIsConnectingSheets] = useState(false);
  const [sheetsConnected, setSheetsConnected] = useState(false);
  const [sheetsError, setSheetsError] = useState<{
    type: "invalid_sheet_id" | "auth_failed" | "network_error" | "permission_denied" | "unknown";
    message: string;
    details?: string;
  } | null>(null);

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

  const handleConnectGoogleSheets = async () => {
    if (!sheetId.trim()) {
      setSheetsError({
        type: "invalid_sheet_id",
        message: "Por favor, insira um ID de planilha válido",
      });
      return;
    }

    setIsConnectingSheets(true);
    setSheetsError(null);

    try {
      // Simular validação do ID
      if (sheetId.length < 20) {
        setSheetsError({
          type: "invalid_sheet_id",
          message: "O ID da planilha parece ser inválido",
          details: "IDs de planilhas do Google Sheets geralmente têm mais de 20 caracteres",
        });
        setIsConnectingSheets(false);
        return;
      }

      // Simular conexão
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simular sucesso
      setSheetsConnected(true);
      toast.success("Conectado ao Google Sheets com sucesso!");
      setSheetId("");
    } catch (error: any) {
      let errorType: "invalid_sheet_id" | "auth_failed" | "network_error" | "permission_denied" | "unknown" = "unknown";
      let message = "Erro ao conectar com Google Sheets";
      let details = "";

      if (error.message?.includes("auth")) {
        errorType = "auth_failed";
        message = "Falha na autenticação com Google";
      } else if (error.message?.includes("network")) {
        errorType = "network_error";
        message = "Erro de conexão com Google Sheets";
      } else if (error.message?.includes("permission")) {
        errorType = "permission_denied";
        message = "Você não tem permissão para acessar esta planilha";
      } else if (error.message?.includes("invalid")) {
        errorType = "invalid_sheet_id";
        message = "ID da planilha inválido";
      }

      setSheetsError({
        type: errorType,
        message,
        details: error.message,
      });
    } finally {
      setIsConnectingSheets(false);
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
      <LoadingOverlay
        isVisible={isConnectingSheets}
        message="Conectando ao Google Sheets"
        details="Aguarde enquanto validamos sua planilha..."
        status="loading"
      />

      <ErrorModal
        isOpen={!!sheetsError}
        onClose={() => setSheetsError(null)}
        errorType={sheetsError?.type}
        errorMessage={sheetsError?.message}
        details={sheetsError?.details}
        onRetry={handleConnectGoogleSheets}
      />

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
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
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
              Integração com Google Sheets
            </h2>
            <div className="space-y-4">
              {sheetsConnected && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-green-600 font-medium">
                    Conectado ao Google Sheets com sucesso!
                  </p>
                </div>
              )}

              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-600 font-medium mb-2">Como conectar:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Crie uma nova planilha no Google Sheets</li>
                  <li>Copie o ID da URL (entre /d/ e /edit)</li>
                  <li>Cole o ID abaixo e clique em Conectar</li>
                  <li>Autorize o acesso quando solicitado</li>
                </ol>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  ID da Planilha Google
                </label>
                <input
                  type="text"
                  placeholder="Ex: 1BxiMVs0XRA5nFMKUVfIvWJlsvaTreeqrZIHbSzOqVQ"
                  className="input-elegant w-full"
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  disabled={isConnectingSheets}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Encontre o ID na URL: https://docs.google.com/spreadsheets/d/{'{ID}'}/edit
                </p>
              </div>

              <Button
                onClick={handleConnectGoogleSheets}
                disabled={isConnectingSheets || !sheetId.trim()}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isConnectingSheets ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Conectar Google Sheets
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayoutCustom>
  );
}
