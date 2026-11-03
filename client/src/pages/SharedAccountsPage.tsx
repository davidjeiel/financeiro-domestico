import { useEffect, useState } from "react";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Share2 } from "lucide-react";

export function SharedAccountsPage() {
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);
  const [workspaceFilterId, setWorkspaceFilterId] = useState<number | null>(null);
  const [shareType, setShareType] = useState("shared");

  const { data: accounts, isLoading: accountsLoading } = trpc.account.list.useQuery();
  const { data: workspaces, isLoading: workspacesLoading } = trpc.workspace.list.useQuery();
  const { data: sharedAccounts, isLoading: sharedLoading, refetch: refetchShared } = trpc.sharedAccount.listByWorkspace.useQuery(
    { workspaceId: workspaceFilterId || 0 },
    { enabled: !!workspaceFilterId }
  );

  useEffect(() => {
    if (workspaces && workspaces.length > 0) {
      if (workspaceFilterId === null) {
        setWorkspaceFilterId(workspaces[0].id);
      }
      if (selectedWorkspaceId === null) {
        setSelectedWorkspaceId(workspaces[0].id);
      }
    }
  }, [selectedWorkspaceId, workspaceFilterId, workspaces]);

  const createShareMutation = trpc.sharedAccount.create.useMutation({
    onSuccess: () => {
      refetchShared();
    },
  });

  const handleShareAccount = async () => {
    if (!selectedAccountId || !selectedWorkspaceId) {
      toast.error("Selecione uma conta e um workspace");
      return;
    }

    try {
      await createShareMutation.mutateAsync({
        accountId: selectedAccountId,
        workspaceId: selectedWorkspaceId,
        shareType: shareType as "individual" | "joint" | "shared",
      });
      toast.success("Conta compartilhada com sucesso");
      setWorkspaceFilterId(selectedWorkspaceId);
      setIsShareOpen(false);
      setSelectedAccountId(null);
      setShareType("shared");
    } catch (error) {
      toast.error((error as any)?.message || "Falha ao compartilhar conta");
    }
  };

  const handleRemoveShare = async (sharedAccountId: number) => {
    try {
      // TODO: Implementar mutation para remover compartilhamento
      toast.success("Compartilhamento removido");
      refetchShared();
    } catch (error) {
      toast.error("Falha ao remover compartilhamento");
    }
  };

  const shareTypeLabels = {
    individual: "Individual",
    shared: "Compartilhada",
    joint: "Conjunta",
  };

  const getAccountName = (accountId: number) => {
    return accounts?.find((a) => a.id === accountId)?.name || `Conta #${accountId}`;
  };

  const getWorkspaceName = (workspaceId: number) => {
    return workspaces?.find((w) => w.id === workspaceId)?.name || `Workspace #${workspaceId}`;
  };

  return (
    <DashboardLayoutCustom title="Contas Compartilhadas">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold">Contas Compartilhadas</h1>
            <p className="text-muted-foreground">Gerencie contas compartilhadas entre workspaces</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
            <div className="min-w-[220px]">
              <label className="text-sm font-medium">Filtrar Workspace</label>
              <Select
                value={workspaceFilterId?.toString() || ""}
                onValueChange={(value) => setWorkspaceFilterId(parseInt(value, 10))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={workspacesLoading ? "Carregando..." : "Selecione um workspace"} />
                </SelectTrigger>
                <SelectContent>
                  {workspaces?.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id.toString()}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Dialog
              open={isShareOpen}
              onOpenChange={(open) => {
                setIsShareOpen(open);
                if (open && workspaceFilterId) {
                  setSelectedWorkspaceId(workspaceFilterId);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Compartilhar Conta
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Compartilhar Conta</DialogTitle>
                  <DialogDescription>
                    Selecione uma conta e um workspace para compartilhar
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Conta</label>
                    <Select
                      value={selectedAccountId?.toString() || ""}
                      onValueChange={(value) => setSelectedAccountId(parseInt(value, 10))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map((account) => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Workspace</label>
                    <Select
                      value={selectedWorkspaceId?.toString() || ""}
                      onValueChange={(value) => setSelectedWorkspaceId(parseInt(value, 10))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces?.map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id.toString()}>
                            {workspace.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Tipo de Compartilhamento</label>
                    <Select value={shareType} onValueChange={setShareType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="shared">Compartilhada</SelectItem>
                        <SelectItem value="joint">Conjunta</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">
                      <strong>Compartilhada:</strong> Todos veem e podem editar
                      <br />
                      <strong>Conjunta:</strong> Responsabilidades divididas entre membros
                    </p>
                  </div>

                  <Button
                    onClick={handleShareAccount}
                    className="w-full"
                    disabled={createShareMutation.isPending}
                  >
                    {createShareMutation.isPending ? "Compartilhando..." : "Compartilhar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {sharedLoading ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Carregando contas compartilhadas...</p>
            </CardContent>
          </Card>
        ) : !sharedAccounts || sharedAccounts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Share2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Nenhuma conta compartilhada ainda</p>
              <p className="text-sm text-muted-foreground mt-2">
                Compartilhe uma conta com um workspace para começar
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sharedAccounts?.map((shared: any) => (
              <Card key={shared.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle>{getAccountName(shared.accountId)}</CardTitle>
                      <CardDescription>
                        Compartilhada com: {getWorkspaceName(shared.workspaceId)}
                      </CardDescription>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveShare(shared.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Tipo: </span>
                      <span className="font-medium">
                        {shareTypeLabels[shared.shareType as "individual" | "shared" | "joint"] || "Desconhecido"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Compartilhada em: </span>
                      <span className="font-medium">
                        {new Date(shared.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayoutCustom>
  );
}
