import { Shield, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface PartnershipDisclaimerProps {
  variant?: "inline" | "card";
  className?: string;
}

/**
 * Aviso legal canônico do Programa de Parceria.
 * Único ponto oficial em que a palavra "investimento" pode aparecer,
 * exclusivamente para reforçar que a parceria NÃO é investimento financeiro.
 */
export const PartnershipDisclaimer = ({
  variant = "inline",
  className,
}: PartnershipDisclaimerProps) => {
  const message =
    "Esta parceria não constitui investimento financeiro, aplicação financeira, promessa de rentabilidade ou garantia de retorno. Os repasses são variáveis e dependem das regras contratuais e do desempenho da plataforma.";

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
