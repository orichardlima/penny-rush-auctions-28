import { useState } from 'react';
import { Users, Copy, Check, Gift, Clock, XCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ReferralBonus } from '@/hooks/usePartnerData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PartnerReferralSectionProps {
  referralBonuses: ReferralBonus[];
  totalBonusAvailable: number;
}

export const PartnerReferralSection = ({ 
  referralBonuses, 
  totalBonusAvailable 
}: PartnerReferralSectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const referralLink = user ? `${window.location.origin}/parceiro?ref=${user.id.slice(0, 8)}` : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({
        title: "Link copiado!",
        description: "O link de indicação foi copiado para a área de transferência."
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link."
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <Badge className="bg-success/20 text-success border-success/30 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Disponível
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pendente
          </Badge>
        );
      case 'USED':
        return (
          <Badge className="bg-muted text-muted-foreground flex items-center gap-1">
            <Check className="h-3 w-3" />
            Utilizado
          </Badge>
        );
      case 'BLOCKED':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Bloqueado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Bônus de Indicação
        </CardTitle>
        <CardDescription>
          Sistema separado do contrato de participação. Ganhe 10% do valor de cada pacote indicado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Link Section */}
        <div className="p-4 bg-muted/30 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gift className="h-4 w-4" />
            <span>Seu link de indicação:</span>
          </div>
          <div className="flex gap-2">
            <code className="flex-1 px-3 py-2 bg-background rounded-md text-sm font-mono truncate border border-border">
              {referralLink}
            </code>
            <Button 
              onClick={handleCopyLink}
              variant="outline"
              size="icon"
              className="shrink-0"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-primary/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(totalBonusAvailable)}
            </p>
            <p className="text-sm text-muted-foreground">Disponível para saque</p>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg text-center">
            <p className="text-2xl font-bold text-foreground">
              {referralBonuses.length}
            </p>
            <p className="text-sm text-muted-foreground">Total de indicações</p>
          </div>
        </div>

        {/* Bonus History */}
        {referralBonuses.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor Pacote</TableHead>
                <TableHead className="text-right">Bônus (10%)</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referralBonuses.slice(0, 10).map((bonus) => (
                <TableRow key={bonus.id}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(bonus.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(bonus.package_value))}
                  </TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    {formatCurrency(Number(bonus.bonus_value))}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(bonus.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhuma indicação ainda.</p>
            <p className="text-sm">Compartilhe seu link para começar a ganhar!</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          ⚠️ O bônus de indicação é independente do contrato de participação em receita.
        </p>
      </CardContent>
    </Card>
  );
};
