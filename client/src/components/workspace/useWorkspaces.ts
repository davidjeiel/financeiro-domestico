import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

/** Troca de área de trabalho: recarrega todos os dados da nova planilha. */
export function useSwitchWorkspace() {
  const queryClient = useQueryClient();
  const mutation = trpc.workspace.switch.useMutation();

  const switchTo = useCallback(
    async (id: string | null, opts: { silent?: boolean } = {}) => {
      const workspace = await mutation.mutateAsync({ id });
      // Apaga o cache em vez de só invalidar: os ids são de cada planilha, e
      // dados da área anterior não podem aparecer (nem ser escolhidos) na nova.
      // resetQueries volta todas as consultas ao estado inicial (sem dados) e
      // busca de novo as que estão na tela.
      await queryClient.resetQueries();
      if (!opts.silent) toast.success(`Área de trabalho: ${workspace.name}`);
      return workspace;
    },
    [mutation, queryClient]
  );

  return { switchTo, isSwitching: mutation.isPending };
}

/** Id (planilha) da área de trabalho ativa; `undefined` enquanto carrega. */
export function useActiveWorkspaceId() {
  return trpc.workspace.active.useQuery().data?.id;
}

/** Pessoas ativas/convidadas/sem acesso da área, para escolher responsável. */
export function usePeople() {
  const query = trpc.people.list.useQuery(undefined, { staleTime: 30_000 });
  const people = query.data ?? [];
  const selectable = people.filter(p => p.status !== "removed");
  const byId = new Map(people.map(p => [p.id, p]));
  return { ...query, people, selectable, byId };
}
