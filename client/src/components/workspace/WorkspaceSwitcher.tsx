import { trpc } from "@/lib/trpc";
import { Users, User } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useSwitchWorkspace } from "./useWorkspaces";

/** Seletor da área de trabalho ativa, exibido na barra lateral. */
export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { data } = trpc.workspace.list.useQuery(undefined, { staleTime: 60_000 });
  const { switchTo, isSwitching } = useSwitchWorkspace();
  const active = data?.workspaces.find(w => w.isActive);
  const Icon = active?.kind === "shared" ? Users : User;

  if (compact) {
    return (
      <Link
        href="/workspaces"
        title={`Área de trabalho: ${active?.name ?? "…"}`}
        className="flex justify-center p-2 rounded-lg hover:bg-muted"
      >
        <Icon className="w-5 h-5" />
      </Link>
    );
  }

  return (
    <div className="space-y-1">
      <label htmlFor="workspace-switcher" className="text-xs text-muted-foreground flex items-center gap-1">
        <Icon className="w-3.5 h-3.5" /> Área de trabalho
      </label>
      <select
        id="workspace-switcher"
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        value={data?.activeId ?? ""}
        disabled={!data || isSwitching}
        onChange={async e => {
          try {
            await switchTo(e.target.value);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível trocar de área");
          }
        }}
      >
        {!data && <option value="">Carregando…</option>}
        {data?.workspaces.map(w => (
          <option key={w.id} value={w.id}>
            {w.kind === "shared" ? `👥 ${w.name}` : `👤 ${w.name}`}
          </option>
        ))}
      </select>
      <Link href="/workspaces" className="text-xs text-primary hover:underline">
        Gerenciar áreas e pessoas
      </Link>
    </div>
  );
}
