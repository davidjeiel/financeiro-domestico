import React from "react";
import { Loader2 } from "lucide-react";

export interface LoadingCardProps {
  message?: string;
  fullHeight?: boolean;
}

export function LoadingCard({
  message = "Carregando...",
  fullHeight = false,
}: LoadingCardProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-8 ${
        fullHeight ? "min-h-96" : ""
      }`}
    >
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default LoadingCard;
