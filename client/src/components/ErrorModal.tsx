import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertCircle, HelpCircle, Lock, Wifi, FileQuestion } from "lucide-react";

export interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorType?: "invalid_sheet_id" | "auth_failed" | "network_error" | "permission_denied" | "unknown";
  errorMessage?: string;
  details?: string;
  onRetry?: () => void;
}

const errorConfig = {
  invalid_sheet_id: {
    title: "ID da Planilha Inválido",
    icon: FileQuestion,
    description: "O ID da planilha fornecido não é válido ou não foi encontrado.",
    solutions: [
      "Verifique se o ID foi copiado corretamente da URL da planilha",
      "Certifique-se de que a planilha ainda existe e não foi deletada",
      "Tente copiar o ID novamente diretamente do navegador",
    ],
  },
  auth_failed: {
    title: "Falha na Autenticação",
    icon: Lock,
    description: "Não foi possível autenticar com sua conta Google.",
    solutions: [
      "Verifique se você está logado com a conta Google correta",
      "Tente fazer logout e login novamente",
      "Verifique se sua sessão Google não expirou",
      "Limpe os cookies do navegador e tente novamente",
    ],
  },
  network_error: {
    title: "Erro de Conexão",
    icon: Wifi,
    description: "Não foi possível conectar ao Google Sheets.",
    solutions: [
      "Verifique sua conexão com a internet",
      "Tente novamente em alguns momentos",
      "Verifique se o Google Sheets está acessível",
      "Desabilite VPN ou proxy se estiver usando",
    ],
  },
  permission_denied: {
    title: "Permissão Negada",
    icon: Lock,
    description: "Você não tem permissão para acessar esta planilha.",
    solutions: [
      "Verifique se você tem acesso de leitura/escrita na planilha",
      "Peça ao proprietário da planilha para compartilhá-la com você",
      "Certifique-se de que está usando a conta Google correta",
      "Verifique as permissões de compartilhamento da planilha",
    ],
  },
  unknown: {
    title: "Erro Desconhecido",
    icon: AlertCircle,
    description: "Ocorreu um erro inesperado ao conectar com Google Sheets.",
    solutions: [
      "Tente novamente em alguns momentos",
      "Verifique o console do navegador para mais detalhes",
      "Entre em contato com o suporte se o problema persistir",
    ],
  },
};

export function ErrorModal({
  isOpen,
  onClose,
  errorType = "unknown",
  errorMessage,
  details,
  onRetry,
}: ErrorModalProps) {
  const config = errorConfig[errorType];
  const Icon = config.icon;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md bg-card text-card-foreground border-border">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <Icon className="w-6 h-6 text-destructive" />
            <AlertDialogTitle className="text-foreground">{config.title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-muted-foreground">
            {errorMessage || config.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Detalhes do Erro */}
        {details && (
          <div className="bg-muted/50 border border-border rounded-lg p-3 my-4">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground font-mono break-words">{details}</p>
            </div>
          </div>
        )}

        {/* Soluções Sugeridas */}
        <div className="bg-muted/30 border border-border rounded-lg p-4 my-4">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            Possíveis Soluções:
          </h4>
          <ul className="space-y-2">
            {config.solutions.map((solution, index) => (
              <li key={index} className="flex gap-2 text-xs text-muted-foreground">
                <span className="text-primary font-bold flex-shrink-0">{index + 1}.</span>
                <span>{solution}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Ações */}
        <div className="flex gap-3 justify-end mt-6">
          <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80">
            Fechar
          </AlertDialogCancel>
          {onRetry && (
            <AlertDialogAction
              onClick={onRetry}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Tentar Novamente
            </AlertDialogAction>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ErrorModal;
