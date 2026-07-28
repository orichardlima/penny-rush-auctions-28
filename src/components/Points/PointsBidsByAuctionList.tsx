import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, CheckCircle2, Trophy, Gavel, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AuctionBidsRow } from "@/hooks/usePointsBidsByAuction";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export function PointsBidsByAuctionList({
  rows,
  loading,
}: {
  rows: AuctionBidsRow[];
  loading: boolean;
}) {
  const navigate = useNavigate();

  const waiting = rows.filter((r) => r.status === "waiting");
  const converted = rows.filter((r) => r.status === "converted");
  const won = rows.filter((r) => r.status === "won");

  const sum = (arr: AuctionBidsRow[]) => arr.reduce((n, r) => n + r.bid_count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gavel className="h-4 w-4 text-primary" />
          Meus lances por leilão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <Clock className="h-3.5 w-3.5" /> Aguardando
            </div>
            <div className="mt-1 text-foreground">
              <strong>{sum(waiting)}</strong> lances em <strong>{waiting.length}</strong> leilões ativos
            </div>
          </div>
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Convertidos
            </div>
            <div className="mt-1 text-foreground">
              <strong>{sum(converted)}</strong> lances em <strong>{converted.length}</strong> leilões finalizados
            </div>
          </div>
          <div className="rounded-md border border-muted p-3">
            <div className="flex items-center gap-1 text-muted-foreground font-medium">
              <Trophy className="h-3.5 w-3.5" /> Sem ponto (vitórias)
            </div>
            <div className="mt-1 text-foreground">
              <strong>{sum(won)}</strong> lances em <strong>{won.length}</strong> leilões vencidos
            </div>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Você ainda não deu lances pagos elegíveis. Compre lances por PIX e participe de leilões para começar a acumular Pontos Show.
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.auction_id} className="flex items-center gap-3 py-3">
                <div className="h-12 w-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                      <Gavel className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.bid_count} {r.bid_count === 1 ? "lance pago" : "lances pagos"} • último em {fmtDate(r.last_bid_at)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {r.status === "waiting" && (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                      <Clock className="h-3 w-3 mr-1" /> Aguardando
                    </Badge>
                  )}
                  {r.status === "converted" && (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Convertido
                    </Badge>
                  )}
                  {r.status === "won" && (
                    <Badge variant="outline" className="text-muted-foreground">
                      <Trophy className="h-3 w-3 mr-1" /> Vitória sua
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => navigate(`/auction/${r.auction_id}`)}
                  >
                    Ver <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Aguardando</strong>: leilão ainda ativo, os lances podem virar Ponto Show quando terminar.{" "}
          <strong className="text-foreground">Convertido</strong>: leilão finalizado e você não venceu — os lances entraram no seu progresso.{" "}
          <strong className="text-foreground">Vitória sua</strong>: você ganhou o leilão, então esses lances não geram pontos.
        </p>
      </CardContent>
    </Card>
  );
}
