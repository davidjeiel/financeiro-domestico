import { useState } from "react";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Mail, Clock } from "lucide-react";
import { useLocation, useRoute } from "wouter";

export function WorkspaceMembersPage() {
  const [match, params] = useRoute("/workspace-members/:id");
  const workspaceId = match ? parseInt(params?.id || "0", 10) : 0;

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");

  const { data: members, isLoading: membersLoading, refetch: refetchMembers } = trpc.workspace.members.list.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 }
  );

  const { data: pendingInvites, isLoading: invitesLoading, refetch: refetchInvites } = trpc.workspace.invites.getPending.useQuery(
    { email: "" },
    { enabled: false }
  );

  const addMemberMutation = trpc.workspace.members.add.useMutation();
  const removeMemberMutation = trpc.workspace.members.remove.useMutation();
  const updateRoleMutation = trpc.workspace.members.updateRole.useMutation();

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email é obrigatório");
      return;
    }

    try {
      await addMemberMutation.mutateAsync({
        workspaceId,
        email: inviteEmail,
        role: inviteRole as "owner" | "editor" | "viewer",
      });
      toast.success("Convite enviado com sucesso");
      setInviteEmail("");
      setInviteRole("viewer");
      setIsInviteOpen(false);
      refetchMembers();
      refetchInvites();
    } catch (error) {
      toast.error("Falha ao enviar convite");
    }
  };

  const handleRemoveMember = async (userId: number) => {
    try {
      await removeMemberMutation.mutateAsync({
        memberId: userId,
      });
      toast.success("Membro removido com sucesso");
      refetchMembers();
    } catch (error) {
      toast.error("Falha ao remover membro");
    }
  };

  const handleUpdateRole = async (userId: number, newRole: string) => {
    try {
      await updateRoleMutation.mutateAsync({
        memberId: userId,
        role: newRole as "owner" | "editor" | "viewer",
      });
      toast.success("Role atualizado com sucesso");
      refetchMembers();
    } catch (error) {
      toast.error("Falha ao atualizar role");
    }
  };

  const roleLabels = {
    owner: "Proprietário",
    editor: "Editor",
    viewer: "Visualizador",
  };

  if (workspaceId === 0) {
    return (
      <DashboardLayoutCustom title="Gerenciamento de Membros">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Workspace não encontrado</p>
        </div>
      </DashboardLayoutCustom>
    );
  }

  return (
    <DashboardLayoutCustom title="Gerenciamento de Membros">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Membros do Workspace</h1>
            <p className="text-muted-foreground">Gerencie os membros e suas permissões</p>
          </div>
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Convidar Membro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Novo Membro</DialogTitle>
                <DialogDescription>
                  Envie um convite por email para adicionar um novo membro ao workspace
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="role">Permissão</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Visualizador</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="owner">Proprietário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleInviteMember} className="w-full" disabled={addMemberMutation.isPending}>
                  {addMemberMutation.isPending ? "Enviando..." : "Enviar Convite"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Membros */}
        <div>
          <h2 className="text-xl font-bold mb-4">Membros Ativos</h2>
          {membersLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Carregando membros...</p>
              </CardContent>
            </Card>
          ) : !members || members.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Nenhum membro adicionado ainda</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {members.map((member) => (
                <Card key={member.id}>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium">Membro #{member.userId}</p>
                        <p className="text-sm text-muted-foreground">Adicionado em {new Date(member.joinedAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Select
                          value={member.role}
                          onValueChange={(value) => handleUpdateRole(member.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="owner">Proprietário</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Convites Pendentes */}
        <div>
          <h2 className="text-xl font-bold mb-4">Convites Pendentes</h2>
          {invitesLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Carregando convites...</p>
              </CardContent>
            </Card>
          ) : !pendingInvites || pendingInvites.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Nenhum convite pendente</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingInvites.map((invite) => (
                <Card key={invite.id}>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <p className="font-medium">{invite.email}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>
                            Expira em {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString("pt-BR") : "N/A"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {roleLabels[invite.role as keyof typeof roleLabels]}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayoutCustom>
  );
}
