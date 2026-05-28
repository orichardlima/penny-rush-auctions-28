import { Shield, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface PartnershipDisclaimerProps {
  variant?: "inline" | "card";
  className?: string;
}

/**
 * Aviso legal padronizado do Programa de Parceria.
 * Reforça que não é investimento financeiro e que repasses dependem do faturamento real.
 */
export const PartnershipDisclaimer = ({
  variant = "inline",
  className,
}: PartnershipDisclaimerProps) => {
  const message =
    "Programa de parceria. Os repasses dependem do faturamento real da plataforma. Não há garantia de valor mínimo. Não constitui investimento financeiro.";

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground",
          className
        )}
      >
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="leading-relaxed">{message}</p>
      </div>
    );
  }

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground",
        className
      )}
    >
      <Info className="mt-0.5 h-3 w-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
};
