import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError, unstable_localLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { appRouter } from "./data/router";
import { createContext } from "./data/trpc";
import { loadGoogleIdentity } from "./data/google";
import "./index.css";

const queryClient = new QueryClient();

// Pré-carrega o script de login do Google para o popup abrir direto no clique.
loadGoogleIdentity().catch(error => console.error(error));

// Sessão expirada: recarrega o usuário atual para que o app mostre a tela de login.
const showLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (error.message !== UNAUTHED_ERR_MSG) return;
  queryClient.invalidateQueries({ queryKey: [["auth", "me"]] });
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    showLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    showLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// Sem backend: os procedimentos tRPC rodam no navegador e gravam na planilha Google.
const trpcClient = trpc.createClient({
  links: [
    unstable_localLink({
      router: appRouter,
      createContext,
      transformer: superjson,
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
