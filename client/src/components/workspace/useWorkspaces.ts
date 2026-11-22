import { trpc } from "@/lib/trpc";
import { useCallback } from "react";
import { toast } from "sonner";

/** Troca de área de trabalho: recarrega todos os dados da nova planilha. */
export function useSwitchWorkspace() {
  const utils = trpc.useUtils();
  const mutation = trpc.workspace.switch.useMutation();

  const switchTo = useCallback(
    async (id: string | null, opts: { silent?: boolean } = {}) => {
      const workspace = await mutation.mutateAsync({ id });
      await utils.invalidate();
      if (!opts.silent) toast.success(`Área de trabalho: ${workspace.name}`);
      return workspace;
    },
    [mutation, utils]
  );

  return { switchTo, isSwitching: mutation.isPending };
}

/** Pessoas ativas/convidadas/sem acesso da área, para escolher responsável. */
export function usePeople() {
  const query = trpc.people.list.useQuery(undefined, { staleTime: 30_000 });
  const people = query.data ?? [];
  const selectable = people.filter(p => p.status !== "removed");
  const byId = new Map(people.map(p => [p.id, p]));
  return { ...query, people, selectable, byId };
}
