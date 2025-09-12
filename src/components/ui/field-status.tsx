import React from 'react';
import { Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldStatusProps {
  isValidating: boolean;
  isValid?: boolean;
  isAvailable?: boolean;
  hasError?: boolean;
  message?: string;
  className?: string;
}

export const FieldStatus: React.FC<FieldStatusProps> = ({
  isValidating,
  isValid,
  isAvailable,
  hasError,
  message,
  className
}) => {
  if (isValidating) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Verificando disponibilidade...</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-orange-600", className)}>
        <AlertTriangle className="h-4 w-4" />
        <span>{message || "Erro na verificação. Tente novamente."}</span>
      </div>
    );
  }

  if (isValid === false) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-destructive", className)}>
        <X className="h-4 w-4" />
        <span>{message || "Formato inválido"}</span>
      </div>
    );
  }

  if (isAvailable === false) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-destructive", className)}>
        <X className="h-4 w-4" />
        <span>{message || "Já está em uso"}</span>
      </div>
    );
  }

  if (isAvailable === true) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-green-600", className)}>
        <Check className="h-4 w-4" />
        <span>{message || "Disponível"}</span>
      </div>
    );
  }

  return null;
};