import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBidLots, sourceLabel } from "@/hooks/useBidLots";
import { Clock, Infinity as InfinityIcon } from "lucide-react";

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysUntil(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function MyBidLotsCard() {
  const { lots, loading } = useBidLots();

  if (loading) return null;
  if (lots.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Meus lances ativos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Lances comprados e bônus de planos vencem em 30 dias. Outros bônus não expiram.
        </p>
        <div className="divide-y divide-border">
          {lots.map((lot) => {
            const days = daysUntil(lot.expires_at);
            const isUrgent = days !== null && days <= 7;
            return (
              <div key={lot.id} className="flex items-center justify-between py-2 gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{sourceLabel(lot.source)}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    {lot.expires_at ? (
                      <>
                        Expira em {formatDate(lot.expires_at)}
                        {days !== null && days >= 0 && (
                          <span>· {days} dia{days === 1 ? "" : "s"}</span>
                        )}
                      </>
                    ) : (
                      <span className="flex items-center gap-1">
                        <InfinityIcon className="h-3 w-3" /> Sem validade
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant={isUrgent ? "destructive" : "secondary"} className="shrink-0">
                  {Number(lot.remaining_amount).toLocaleString("pt-BR")}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
