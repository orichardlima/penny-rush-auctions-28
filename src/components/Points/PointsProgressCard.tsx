import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import type { PointsProgressData } from "@/hooks/usePointsWallet";

export function PointsProgressCard({
  progress,
  bonusUsedOrPending = 0,
}: {
  progress: PointsProgressData;
  bonusUsedOrPending?: number;
}) {
  const ratio = progress.bids_per_point || 12;
  const consumed = Math.max(0, Math.min(ratio, progress.eligible_bids_remaining));
  const pending = Math.max(0, progress.pending_eligible_bids || 0);
  const missing = ratio - consumed;
  const pct = (consumed / ratio) * 100;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          Progresso do próximo Ponto Show
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="text-sm text-muted-foreground">
            <span className="text-2xl font-bold text-foreground">{consumed}</span>
            <span className="mx-1">/</span>
            <span>{ratio} lances base elegíveis</span>
          </div>
          <div className="text-sm font-medium text-primary">
            {missing > 0 ? `Faltam ${missing}` : "Pronto!"}
          </div>
        </div>
        <Progress value={pct} className="h-2" />
        {pending > 0 && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">{pending}</strong> lances base estão em validação porque os leilões ainda estão ativos.
          </div>
        )}
        {bonusUsedOrPending > 0 && (
          <div className="rounded-md border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">{bonusUsedOrPending}</strong> lances bônus foram usados nestes leilões e <strong>não geram pontos</strong>.
          </div>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">
          Somente <strong>lances base</strong> (comprados com R$ pagos) consumidos em leilões que você <strong>não venceu</strong> contam.
          Lances gratuitos, bônus e vitórias não geram pontos.
        </p>
      </CardContent>
    </Card>
  );
}
