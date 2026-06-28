import { useState } from "react";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Plus, Edit2, Users, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const workspaceSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  type: z.enum(["personal", "family", "business"]),
});

type WorkspaceFormData = z.infer<typeof workspaceSchema>;

export function WorkspacesPage() {

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<WorkspaceFormData>({
    name: "",
    description: "",
    type: "personal",
  });

  const { data: workspaces, isLoading, refetch } = trpc.workspace.list.useQuery();
  const createMutation = trpc.workspace.create.useMutation();
  const updateMutation = trpc.workspace.update.useMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkspaceFormData>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: formData,
  });

  const handleCreate = async (data: WorkspaceFormData) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success("Workspace criado com sucesso");
      reset();
      setIsCreateOpen(false);
      refetch();
    } catch (error) {
      toast.error("Falha ao criar workspace");
    }
  };

  const handleEdit = async (data: WorkspaceFormData) => {
    if (!editingId) return;
    try {
      await updateMutation.mutateAsync({
        id: editingId,
        ...data,
      });
      toast.success("Workspace atualizado com sucesso");
      reset();
      setIsEditOpen(false);
      setEditingId(null);
      refetch();
    } catch (error) {
      toast.error("Falha ao atualizar workspace");
    }
  };

  const startEdit = (workspace: any) => {
    setEditingId(workspace.id);
    setFormData({
      name: workspace.name,
      description: workspace.description || "",
      type: workspace.type,
    });
    setIsEditOpen(true);
  };

  const typeLabels = {
    personal: "Pessoal",
    family: "Família",
    business: "Negócio",
  };

  return (
    <DashboardLayoutCustom>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Workspaces</h1>
            <p className="text-muted-foreground">Gerencie seus espaços de trabalho colaborativos</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Workspace</DialogTitle>
                <DialogDescription>
                  Crie um novo espaço de trabalho para colaborar com outras pessoas
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Finanças Familiares"
                    {...register("name")}
                  />
                  {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                </div>

                <div>
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o propósito deste workspace"
                    {...register("description")}
                  />
                </div>

                <div>
                  <Label htmlFor="type">Tipo</Label>
                  <Select defaultValue="personal" onValueChange={(value) => setFormData({ ...formData, type: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Pessoal</SelectItem>
                      <SelectItem value="family">Família</SelectItem>
                      <SelectItem value="business">Negócio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Workspace"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Carregando workspaces...</p>
          </div>
        ) : !workspaces || workspaces.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Nenhum workspace criado ainda</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {workspaces.map((workspace) => (
              <Card key={workspace.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle>{workspace.name}</CardTitle>
                      <CardDescription>{workspace.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(workspace)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {}}
                  >
                    <Users className="w-4 h-4" />
                  </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Tipo: </span>
                      <span className="font-medium">{typeLabels[workspace.type as keyof typeof typeLabels]}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Criado em: </span>
                      <span className="font-medium">
                        {new Date(workspace.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Workspace</DialogTitle>
              <DialogDescription>
                Atualize as informações do seu workspace
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleEdit)} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  placeholder="Ex: Finanças Familiares"
                  {...register("name")}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>

              <div>
                <Label htmlFor="edit-description">Descrição (opcional)</Label>
                <Textarea
                  id="edit-description"
                  placeholder="Descreva o propósito deste workspace"
                  {...register("description")}
                />
              </div>

              <div>
                <Label htmlFor="edit-type">Tipo</Label>
                <Select defaultValue={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as any })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Pessoal</SelectItem>
                    <SelectItem value="family">Família</SelectItem>
                    <SelectItem value="business">Negócio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Atualizando..." : "Atualizar Workspace"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayoutCustom>
  );
}
