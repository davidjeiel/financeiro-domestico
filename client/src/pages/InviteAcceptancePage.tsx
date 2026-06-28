import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import DashboardLayoutCustom from "@/components/DashboardLayoutCustom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export function InviteAcceptancePage() {
  const [match, params] = useRoute("/invite/:token");
  const [, navigate] = useLocation();
  const token = match ? params?.token : null;

  const [isProcessing, setIsProcessing] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const acceptInviteMutation = trpc.workspace.invites.accept.useMutation();

  useEffect(() => {
    // Aqui você poderia buscar informações do convite usando o token
    // Por enquanto, apenas validamos que o token existe
    if (!token) {
      setError("Token de convite inválido");
    }
  }, [token]);

  const handleAcceptInvite = async () => {
    if (!token) {
      toast.error("Token de convite inválido");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await acceptInviteMutation.mutateAsync({ token });
      setAccepted(true);
      toast.success("Convite aceito com sucesso!");

      // Redirecionar para workspaces após 2 segundos
      setTimeout(() => {
        navigate("/workspaces");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Falha ao aceitar convite");
      toast.error("Falha ao aceitar convite");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectInvite = () => {
    toast.info("Convite rejeitado");
    navigate("/");
  };

  if (!token) {
    return (
      <DashboardLayoutCustom title="Aceitar Convite">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Convite Inválido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              O token de convite é inválido ou expirou.
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              Voltar para Home
            </Button>
          </CardContent>
        </Card>
      </DashboardLayoutCustom>
    );
  }

  if (error && !accepted) {
    return (
      <DashboardLayoutCustom title="Aceitar Convite">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Erro ao Processar Convite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate("/")} className="w-full">
              Voltar para Home
            </Button>
          </CardContent>
        </Card>
      </DashboardLayoutCustom>
    );
  }

  if (accepted) {
    return (
      <DashboardLayoutCustom title="Aceitar Convite">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Convite Aceito!
            </CardTitle>
            <CardDescription>
              Você foi adicionado ao workspace com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Redirecionando para seus workspaces...
            </p>
            <div className="flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </DashboardLayoutCustom>
    );
  }

  return (
    <DashboardLayoutCustom title="Aceitar Convite">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Você Recebeu um Convite</CardTitle>
          <CardDescription>
            Você foi convidado para participar de um workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">
              <strong>Token:</strong> {token?.substring(0, 20)}...
            </p>
            <p className="text-sm text-muted-foreground">
              Clique em "Aceitar" para se juntar ao workspace e começar a colaborar.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleAcceptInvite}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aceitar
                </>
              )}
            </Button>
            <Button
              onClick={handleRejectInvite}
              variant="outline"
              disabled={isProcessing}
              className="flex-1"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Rejeitar
            </Button>
          </div>
        </CardContent>
      </Card>
    </DashboardLayoutCustom>
  );
}
