import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownCircle, ArrowUpCircle, Gift, RotateCcw, Clock, ShieldAlert, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LedgerEntry } from "@/hooks/usePointsLedger";

const META: Record<string, { label: (e: LedgerEntry) => string; icon: any; className: string }> = {
  EARN_AUCTION: {
    label: (e) => `Leilão: ${e.auction_title ?? "participação"}`,
    icon: ArrowUpCircle,
    className: "text-emerald-600",
  },
  EARN_CAMPAIGN: { label: () => "Campanha promocional", icon: Gift, className: "text-emerald-600" },
  RESERVE_REDEMPTION: { label: () => "Resgate na Loja (reserva)", icon: ArrowDownCircle, className: "text-amber-600" },
  CONFIRM_REDEMPTION: { label: () => "Resgate confirmado", icon: ArrowDownCircle, className: "text-rose-600" },
  RELEASE_REDEMPTION: { label: () => "Devolução de resgate", icon: RotateCcw, className: "text-emerald-600" },
  ADMIN_CREDIT: { label: (e) => e.reason || "Ajuste da equipe (crédito)", icon: ArrowUpCircle, className: "text-emerald-600" },
  ADMIN_DEBIT: { label: (e) => e.reason || "Ajuste da equipe (débito)", icon: ArrowDownCircle, className: "text-rose-600" },
  ORDER_REVERSAL: { label: () => "Estorno de pedido", icon: ShieldAlert, className: "text-rose-600" },
  CHARGEBACK_REVERSAL: { label: () => "Estorno por chargeback", icon: ShieldAlert, className: "text-rose-600" },
  FRAUD_REVERSAL: { label: () => "Estorno por fraude", icon: ShieldAlert, className: "text-rose-600" },
  EXPIRATION: { label: () => "Expiração de pontos", icon: Clock, className: "text-muted-foreground" },
  CORRECTION: { label: (e) => e.reason || "Correção", icon: RotateCcw, className: "text-muted-foreground" },
};

export function PointsHistoryList({ entries, loading }: { entries: LedgerEntry[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" />
          Histórico de movimentações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Você ainda não gerou pontos. Compre lances e participe de leilões para começar.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map(e => {
              const meta = META[e.transaction_type] ?? { label: (x: LedgerEntry) => x.transaction_type, icon: History, className: "text-muted-foreground" };
              const Icon = meta.icon;
              const positive = e.points_delta > 0;
              return (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <Icon className={`h-5 w-5 shrink-0 ${meta.className}`} aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{meta.label(e)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR })}
                      {" · saldo depois: "}{Number(e.available_after).toLocaleString("pt-BR")} pts
                    </div>
                  </div>
                  <div className={`text-sm font-semibold shrink-0 ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                    {positive ? "+" : ""}{Number(e.points_delta).toLocaleString("pt-BR")} pts
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
