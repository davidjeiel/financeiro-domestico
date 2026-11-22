import { useState } from "react";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  LogIn,
  Mail,
  Pencil,
  Plus,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { isPickerConfigured, pickSharedSpreadsheet } from "@/data/google";
import { useSwitchWorkspace } from "@/components/workspace/useWorkspaces";
import { PersonBadge } from "@/components/workspace/PersonBadge";

const COLORS = [
  "#3B82F6", "#EC4899", "#10B981", "#F59E0B", "#8B5CF6",
  "#06B6D4", "#EF4444", "#14B8A6", "#F97316", "#6366F1",
];

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function WorkspacesPage() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.workspace.list.useQuery();
  const { data: active } = trpc.workspace.active.useQuery();
  const { data: people = [] } = trpc.people.list.useQuery();
  const { switchTo, isSwitching } = useSwitchWorkspace();

  const createMutation = trpc.workspace.create.useMutation();
  const renameMutation = trpc.workspace.renameActive.useMutation();
  const inviteMutation = trpc.people.invite.useMutation();
  const guestMutation = trpc.people.addGuest.useMutation();
  const updatePersonMutation = trpc.people.update.useMutation();
  const removePersonMutation = trpc.people.remove.useMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string; color: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [picking, setPicking] = useState(false);

  const isShared = active?.kind === "shared";
  const visiblePeople = people.filter(p => p.status !== "removed");

  const refreshPeople = () => utils.people.list.invalidate();

  const handleCreate = async () => {
    try {
      const workspace = await createMutation.mutateAsync({ name: newName });
      await utils.invalidate();
      toast.success(`Área "${workspace.name}" criada. Agora convide quem vai lançar com você.`);
      setCreateOpen(false);
      setNewName("");
    } catch (error) {
      toast.error(errorMessage(error, "Falha ao criar a área de trabalho"));
    }
  };

  const handleJoinWithPicker = async () => {
    setPicking(true);
    try {
      const id = await pickSharedSpreadsheet();
      if (!id) return;
      await switchTo(id);
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível abrir a área escolhida"));
    } finally {
      setPicking(false);
    }
  };

  const handleRename = async () => {
    try {
      await renameMutation.mutateAsync({ name: renameValue });
      await utils.workspace.invalidate();
      setRenameOpen(false);
      toast.success("Área renomeada");
    } catch (error) {
      toast.error(errorMessage(error, "Falha ao renomear"));
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inviteMutation.mutateAsync({ email: inviteEmail, name: inviteName || undefined });
      toast.success(`Convite enviado para ${inviteEmail} pelo Google Drive.`);
      setInviteEmail("");
      setInviteName("");
      refreshPeople();
    } catch (error) {
      toast.error(errorMessage(error, "Falha ao enviar o convite"));
    }
  };

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await guestMutation.mutateAsync({ name: guestName });
      toast.success(`${guestName} adicionada como responsável`);
      setGuestName("");
      refreshPeople();
    } catch (error) {
      toast.error(errorMessage(error, "Falha ao adicionar pessoa"));
    }
  };

  const handleSavePerson = async () => {
    if (!editing) return;
    try {
      await updatePersonMutation.mutateAsync(editing);
      setEditing(null);
      refreshPeople();
      utils.transaction.invalidate();
    } catch (error) {
      toast.error(errorMessage(error, "Falha ao salvar"));
    }
  };

  const handleRemove = async (id: number, name: string) => {
    if (!window.confirm(`Remover ${name} desta área? Os lançamentos antigos continuam mostrando o nome.`)) {
      return;
    }
    try {
      await removePersonMutation.mutateAsync({ id });
      toast.success(`${name} removida da área`);
      refreshPeople();
    } catch (error) {
      toast.error(errorMessage(error, "Falha ao remover"));
    }
  };

  const copyLink = async () => {
    if (!active?.joinLink) return;
    try {
      await navigator.clipboard.writeText(active.joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Copie o link manualmente.");
    }
  };

  const statusBadge = (p: (typeof people)[number]) => {
    if (p.isMe) return <Badge variant="secondary">Você</Badge>;
    if (p.status === "invited") return <Badge variant="outline">Convite pendente</Badge>;
    if (p.status === "guest") return <Badge variant="outline">Sem acesso</Badge>;
    return null;
  };

  return (
    <DashboardLayoutCustom title="Áreas de trabalho">
      <div className="space-y-6 max-w-4xl">
        <p className="text-muted-foreground">
          Cada área tem a sua própria planilha. Use a área <strong>Pessoal</strong> para suas contas e
          crie uma <strong>área compartilhada</strong> para lançar contas junto com outra pessoa —
          os dois veem os mesmos lançamentos e cada lançamento indica quem é o responsável pelo
          pagamento.
        </p>

        {/* Lista de áreas */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Suas áreas</CardTitle>
              <CardDescription>Escolha em qual área você está lançando.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={handleJoinWithPicker} disabled={picking || !isPickerConfigured()}
                title={isPickerConfigured() ? undefined : "Configure VITE_GOOGLE_API_KEY e VITE_GOOGLE_APP_ID"}>
                {picking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                Entrar em área compartilhada comigo
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nova área compartilhada
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}
            {list?.workspaces.map(w => (
              <div
                key={w.id}
                className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                  w.isActive ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {w.kind === "shared" ? (
                    <Users className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <User className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{w.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {w.kind === "personal"
                        ? "Só você"
                        : w.ownedByMe
                          ? "Compartilhada · criada por você"
                          : `Compartilhada · de ${w.ownerName ?? w.ownerEmail ?? "outra pessoa"}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={w.url} target="_blank" rel="noreferrer" title="Abrir planilha"
                    className="p-2 rounded-md hover:bg-muted text-muted-foreground">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {w.isActive ? (
                    <Badge>Ativa</Badge>
                  ) : (
                    <Button size="sm" variant="outline" disabled={isSwitching}
                      onClick={() => switchTo(w.id).catch(err => toast.error(errorMessage(err, "Falha ao abrir")))}>
                      Abrir
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {!isPickerConfigured() && (
              <p className="text-xs text-muted-foreground pt-2">
                Para entrar em áreas criadas por outra pessoa, o app precisa das variáveis
                VITE_GOOGLE_API_KEY e VITE_GOOGLE_APP_ID (veja o README).
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pessoas da área ativa */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Pessoas em “{active?.name ?? "…"}”</CardTitle>
              <CardDescription>
                Quem pode ser escolhido como responsável pelos lançamentos desta área.
              </CardDescription>
            </div>
            {isShared && (
              <Button variant="ghost" size="sm" onClick={() => { setRenameValue(active?.name ?? ""); setRenameOpen(true); }}>
                <Pencil className="w-4 h-4 mr-1" /> Renomear área
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="divide-y divide-border rounded-lg border">
              {visiblePeople.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <PersonBadge person={{ ...p, isMe: false }} className="font-medium" />
                    {p.email && <p className="text-xs text-muted-foreground truncate ml-4">{p.email}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(p)}
                    {p.role === "admin" && <Badge variant="outline">Dono</Badge>}
                    <Button size="icon" variant="ghost" title="Editar"
                      onClick={() => setEditing({ id: p.id, name: p.name, color: p.color })}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {!p.isMe && p.role !== "admin" && (
                      <Button size="icon" variant="ghost" title="Remover" className="text-destructive"
                        disabled={removePersonMutation.isPending}
                        onClick={() => handleRemove(p.id, p.name)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {isShared ? (
              <div className="space-y-3">
                <form onSubmit={handleInvite} className="space-y-2">
                  <Label className="flex items-center gap-2"><Mail className="w-4 h-4" /> Convidar pela conta Google</Label>
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Input type="email" required placeholder="email@gmail.com" value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)} />
                    <Input placeholder="Nome (opcional)" value={inviteName}
                      onChange={e => setInviteName(e.target.value)} />
                    <Button type="submit" disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                      Convidar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A planilha desta área é compartilhada pelo Google Drive com permissão de edição e a
                    pessoa recebe um e-mail com o link de entrada.
                  </p>
                </form>
                {active?.joinLink && (
                  <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
                    <span className="truncate flex-1" title={active.joinLink}>{active.joinLink}</span>
                    <Button size="sm" variant="outline" onClick={copyLink}>
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span className="ml-1">{copied ? "Copiado" : "Copiar link"}</span>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Esta é a sua área pessoal. Para outra pessoa lançar contas com você, crie uma
                <button className="text-primary hover:underline mx-1" onClick={() => setCreateOpen(true)}>
                  área compartilhada
                </button>
                e convide-a.
              </div>
            )}

            <form onSubmit={handleAddGuest} className="space-y-2">
              <Label className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Pessoa sem acesso ao app</Label>
              <div className="flex gap-2">
                <Input required placeholder="Ex: Mãe, Filho, Diarista…" value={guestName}
                  onChange={e => setGuestName(e.target.value)} />
                <Button type="submit" variant="outline" disabled={guestMutation.isPending}>Adicionar</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Aparece como opção de responsável, mas não recebe acesso à planilha.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Nova área */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova área compartilhada</DialogTitle>
            <DialogDescription>
              Cria uma planilha separada no seu Google Drive para as contas compartilhadas. Você
              poderá convidar pessoas em seguida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ws-name">Nome</Label>
            <Input id="ws-name" autoFocus placeholder="Ex: Casa, Família Silva, Viagem 2027"
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && newName.trim() && handleCreate()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar e abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renomear área */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear área</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancelar</Button>
            <Button onClick={handleRename} disabled={!renameValue.trim() || renameMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar pessoa */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar pessoa</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="person-name">Nome</Label>
                <Input id="person-name" value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button key={c} type="button" aria-label={c}
                      className={`w-7 h-7 rounded-full border-2 ${editing.color.toUpperCase() === c ? "border-foreground" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setEditing({ ...editing, color: c })} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSavePerson} disabled={!editing?.name.trim() || updatePersonMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayoutCustom>
  );
}
