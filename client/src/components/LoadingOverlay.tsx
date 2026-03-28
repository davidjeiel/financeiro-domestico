import React from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  status?: "loading" | "success" | "error";
  details?: string;
}

export function LoadingOverlay({
  isVisible,
  message = "Processando...",
  status = "loading",
  details,
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  const statusConfig = {
    loading: {
      icon: Loader2,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20",
    },
    success: {
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
    },
    error: {
      icon: AlertCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/20",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimated = status === "loading";

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className={`${config.bgColor} border ${config.borderColor} rounded-lg p-8 max-w-sm mx-4 text-center`}
      >
        <div className="flex justify-center mb-4">
          <Icon className={`w-12 h-12 ${config.color} ${isAnimated ? "animate-spin" : ""}`} />
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-2">{message}</h3>

        {details && (
          <p className="text-sm text-muted-foreground mb-4">{details}</p>
        )}

        {status === "loading" && (
          <div className="flex justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default LoadingOverlay;
