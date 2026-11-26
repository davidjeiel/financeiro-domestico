import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, LogIn, Users } from "lucide-react";
import { isPickerConfigured, pickSharedSpreadsheet } from "@/data/google";
import { useSwitchWorkspace } from "@/components/workspace/useWorkspaces";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Link de convite: /join/<id da planilha>.
 *
 * Se o app já tiver acesso à planilha, entra direto. Senão (primeira vez do
 * convidado), pede que a pessoa libere a planilha no seletor do Google.
 */
export function JoinWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { switchTo } = useSwitchWorkspace();
  const [state, setState] = useState<"trying" | "need-picker" | "picking" | "error">("trying");
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  const enter = async () => {
    const workspace = await switchTo(id, { silent: true });
    navigate("/lancamentos");
    return workspace;
  };

  useEffect(() => {
    if (!isAuthenticated || tried.current || !id) return;
    tried.current = true;
    enter().catch(() => setState("need-picker"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, id]);

  const handlePick = async () => {
    setState("picking");
    setError(null);
    try {
      const picked = await pickSharedSpreadsheet(id);
      if (!picked) {
        setState("need-picker");
        return;
      }
      if (picked !== id) {
        // Escolheu outra planilha: abre a escolhida mesmo assim.
        await switchTo(picked, { silent: true });
        navigate("/lancamentos");
        return;
      }
      await enter();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.includes("ainda não tem acesso")
          ? "A planilha foi selecionada, mas o Google não a liberou para o app. Confira se você " +
              `entrou no app com o e-mail que recebeu o convite${user?.email ? ` (agora: ${user.email})` : ""}. ` +
              "Se for o mesmo, avise quem mantém o app: a chave de API precisa ter a Google Picker API " +
              "liberada e ser do mesmo projeto do Client ID."
          : message
      );
      setState("error");
    }
  };

  return (
    <DashboardLayoutCustom title="Entrar na área compartilhada">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> Convite para área compartilhada
          </CardTitle>
          <CardDescription>
            Os lançamentos desta área ficam numa planilha compartilhada com você pelo Google Drive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "trying" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Abrindo a área…
            </p>
          )}
          {(state === "need-picker" || state === "picking" || state === "error") && (
            <>
              <p className="text-sm">
                Para o app conseguir ler e gravar nesta planilha, selecione-a uma vez na janela do
                Google que vai abrir e clique em <strong>Selecionar</strong>.
              </p>
              {!isPickerConfigured() && (
                <p className="text-sm text-destructive">
                  O seletor do Google não está configurado neste site (VITE_GOOGLE_API_KEY e
                  VITE_GOOGLE_APP_ID). Peça para quem mantém o app configurar.
                </p>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={handlePick} disabled={state === "picking" || !isPickerConfigured()}>
                {state === "picking" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4 mr-2" />
                )}
                Liberar acesso e entrar
              </Button>
              <p className="text-xs text-muted-foreground">
                Não recebeu acesso? Confira se entrou com o mesmo e-mail que recebeu o convite
                {user?.email ? <> — você está como <strong>{user.email}</strong></> : null}.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </DashboardLayoutCustom>
  );
}
