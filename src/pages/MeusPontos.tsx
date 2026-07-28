import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Store, ShoppingBag, Info } from "lucide-react";
import { Header } from "@/components/Header";
import { usePointsWallet } from "@/hooks/usePointsWallet";
import { usePointsLedger } from "@/hooks/usePointsLedger";
import { PointsProgressCard } from "@/components/Points/PointsProgressCard";
import { PointsHistoryList } from "@/components/Points/PointsHistoryList";

export default function MeusPontos() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { wallet, progress, storeVisible, loading } = usePointsWallet();
  const { entries, loading: ledgerLoading } = usePointsLedger(30);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  if (authLoading || loading || !wallet || !progress) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4 md:p-6 space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }


  const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-4xl">
        {/* Cabeçalho didático */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Meus Pontos Show
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Você ganha <strong>1 Ponto Show</strong> a cada <strong>{progress.bids_per_point} lances pagos</strong> usados em leilões que você <strong>não venceu</strong>.
          </p>
        </div>

        {/* Cartão de saldo */}
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Saldo disponível</div>
                <div className="text-4xl md:text-5xl font-bold text-primary">{fmt(wallet.available_points)}</div>
                <div className="text-xs text-muted-foreground mt-1">pontos prontos para trocar</div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Total acumulado</div>
                  <div className="font-semibold">{fmt(wallet.lifetime_earned)} pts</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Já trocados</div>
                  <div className="font-semibold">{fmt(wallet.lifetime_redeemed)} pts</div>
                </div>
              </div>
            </div>
            {storeVisible && (
              <div className="flex flex-wrap gap-2 mt-4">
                <Button onClick={() => navigate("/loja-show")} className="gap-2">
                  <Store className="h-4 w-4" /> Ir para a Loja Show
                </Button>
                <Button variant="outline" onClick={() => navigate("/meus-resgates")} className="gap-2">
                  <ShoppingBag className="h-4 w-4" /> Meus resgates
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progresso do próximo ponto */}
        <PointsProgressCard progress={progress} />

        {/* Histórico */}
        <PointsHistoryList entries={entries} loading={ledgerLoading} />

        {/* Como funciona */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <p><strong className="text-foreground">1.</strong> Compre lances pagos por PIX.</p>
            <p><strong className="text-foreground">2.</strong> Use esses lances em leilões da plataforma.</p>
            <p><strong className="text-foreground">3.</strong> Se você <strong>não vencer</strong>, cada <strong>{progress.bids_per_point} lances pagos</strong> viram <strong>1 Ponto Show</strong>. Vitórias, lances gratuitos e bônus não contam.</p>
            <p><strong className="text-foreground">4.</strong> Troque seus pontos por recompensas na Loja Show.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
