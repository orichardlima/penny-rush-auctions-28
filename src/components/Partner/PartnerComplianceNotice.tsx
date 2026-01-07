import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PartnerComplianceNoticeProps {
  variant?: 'default' | 'compact';
}

export const PartnerComplianceNotice = ({ variant = 'default' }: PartnerComplianceNoticeProps) => {
  if (variant === 'compact') {
    return (
      <p className="text-xs text-muted-foreground text-center mt-4 px-4">
        ⚠️ Os valores dependem do desempenho da plataforma. Não há garantia de retorno ou prazo.
      </p>
    );
  }

  return (
    <Alert className="bg-warning/10 border-warning/30">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertDescription className="text-sm text-muted-foreground">
        <strong>Aviso Importante:</strong> Este sistema não representa investimento financeiro. 
        Os valores recebidos dependem do desempenho da plataforma. 
        Não há garantia de retorno, rentabilidade ou prazo.
      </AlertDescription>
    </Alert>
  );
};
