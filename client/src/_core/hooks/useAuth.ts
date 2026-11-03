import { trpc } from "@/lib/trpc";
import { signIn } from "@/data/session";
import { useCallback, useMemo, useState } from "react";

export function useAuth() {
  const utils = trpc.useUtils();
  const [loginError, setLoginError] = useState<Error | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  /** Abre o login do Google. Deve ser chamado a partir de um clique. */
  const login = useCallback(async () => {
    setLoginError(null);
    setLoggingIn(true);
    try {
      await signIn();
      await utils.invalidate();
    } catch (error) {
      setLoginError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoggingIn(false);
    }
  }, [utils]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      utils.auth.me.setData(undefined, null);
      utils.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending || loggingIn,
      error: loginError ?? meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    loggingIn,
    loginError,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    login,
    logout,
  };
}
