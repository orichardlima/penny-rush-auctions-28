import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Handshake, Network, Lock, Info } from 'lucide-react';
import type { WithdrawalBalances } from '@/hooks/useWithdrawalBalances';

interface Props {
  balances: WithdrawalBalances;
  loading?: boolean;
  /** Contrato exibido na tela atual — destacado na lista de repasses */
  highlightContractId?: string;
  compact?: boolean;
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const shortId = (id: string) => id.slice(0, 8).toUpperCase();

const WithdrawalBalancesBreakdown: React.FC<Props> = ({
  balances,
  loading,
  highlightContractId,
  compact,
}) => {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  const contracts = balances.contracts || [];

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Repasses da Parceria */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className={compact ? 'pb-2 py-3' : 'pb-2'}>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Handshake className="h-4 w-4 text-primary" />
              Repasses da Parceria
            </CardTitle>
            {!compact && (
              <CardDescription className="text-xs">
                Saldo por contrato — conta para o teto contratual
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-2xl font-bold text-primary">
                {formatPrice(balances.repass_available)}
              </p>
              <p className="text-xs text-muted-foreground">disponível para saque</p>
            </div>

            {balances.repass_reserved > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                {formatPrice(balances.repass_reserved)} reservado em solicitação em andamento
              </p>
            )}

            {contracts.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Detalhe por contrato
                  </p>
                  {contracts.map((c) => (
                    <div
                      key={c.contract_id}
                      className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs ${
                        c.contract_id === highlightContractId
                          ? 'bg-primary/10 border border-primary/20'
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-muted-foreground">
                          #{shortId(c.contract_id)}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0">
                          {c.contract_status}
                        </Badge>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-semibold">{formatPrice(c.available)}</span>
                        {c.repass_reserved > 0 && (
                          <span className="block text-[10px] text-amber-600 dark:text-amber-400">
                            {formatPrice(c.repass_reserved)} reservado
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bônus de Rede */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className={compact ? 'pb-2 py-3' : 'pb-2'}>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Network className="h-4 w-4 text-blue-500" />
              Bônus de Rede
            </CardTitle>
            {!compact && (
              <CardDescription className="text-xs">
                Carteira independente — não consome o teto contratual
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatPrice(balances.bonus_available)}
              </p>
              <p className="text-xs text-muted-foreground">disponível para saque</p>
            </div>

            {balances.bonus_reserved > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                {formatPrice(balances.bonus_reserved)} reservado em solicitação em andamento
              </p>
            )}

            <Separator />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-muted/50 px-2 py-1.5">
                <p className="text-[10px] uppercase text-muted-foreground">Total recebido</p>
                <p className="font-semibold">{formatPrice(balances.bonus_total_credited)}</p>
              </div>
              <div className="rounded-md bg-muted/50 px-2 py-1.5">
                <p className="text-[10px] uppercase text-muted-foreground">Total sacado</p>
                <p className="font-semibold">{formatPrice(balances.bonus_total_withdrawn)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!compact && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-dashed rounded-lg px-3 py-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Os dois saldos são independentes: saques de <strong>Bônus de Rede</strong> não afetam o
            valor recebido nem o teto do seu contrato de parceria.
          </span>
        </div>
      )}
    </div>
  );
};

export default WithdrawalBalancesBreakdown;
