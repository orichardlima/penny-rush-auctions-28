import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Header } from "@/components/Header";

const sb = supabase as any;

export default function LojaShow() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState<boolean | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [v, w, i] = await Promise.all([
        sb.rpc("store_visible_for", { p_user: user.id }),
        sb.from("points_wallets").select("*").eq("user_id", user.id).maybeSingle(),
        sb.from("points_store_items").select("*").eq("status", "ACTIVE").order("featured", { ascending: false }),
      ]);
      setVisible(!!v.data);
      setWallet(w.data);
      setItems(i.data || []);
      setLoading(false);
    })();
  }, [user]);

  const redeem = async (item: any) => {
    if (!wallet || wallet.available_points < item.cost_points) {
      toast.error("Pontos insuficientes");
      return;
    }
    if (!confirm(`Resgatar "${item.name}" por ${item.cost_points} pontos?`)) return;
    setRedeeming(item.id);
    const idem = `redeem:${user!.id}:${item.id}:${Date.now()}`;
    const { error } = await sb.rpc("redeem_create", {
      p_items: [{ item_id: item.id, quantity: 1 }],
      p_shipping: {},
      p_idem: idem,
    });
    if (error) toast.error(error.message);
    else { toast.success("Resgate solicitado! Aguarde aprovação."); navigate("/meus-resgates"); }
    setRedeeming(null);
  };

  if (authLoading || loading) return <><Header /><div className="container mx-auto p-6"><Skeleton className="h-96" /></div></>;

  if (!visible) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-6 max-w-2xl">
          <Alert>
            <AlertTitle>Loja em breve</AlertTitle>
            <AlertDescription>
              A Loja Show ainda não está disponível para o seu perfil. Fique de olho — em breve você poderá trocar seus Pontos Show por recompensas.
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Loja Show</h1>
            <p className="text-muted-foreground text-sm">Troque seus Pontos Show por recompensas.</p>
          </div>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Seus pontos</div>
              <div className="text-2xl font-bold">{wallet?.available_points ?? 0}</div>
              <div className="flex flex-col gap-1 mt-1">
                <Button size="sm" variant="link" className="p-0 h-auto justify-start" onClick={() => navigate("/meus-pontos")}>Ver histórico e progresso →</Button>
                <Button size="sm" variant="link" className="p-0 h-auto justify-start" onClick={() => navigate("/meus-resgates")}>Meus resgates →</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {!items.length ? (
          <Alert><AlertDescription>Nenhum item disponível no momento.</AlertDescription></Alert>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => (
              <Card key={item.id}>
                {item.main_image_url && <img src={item.main_image_url} alt={item.name} className="w-full h-40 object-cover rounded-t-lg" />}
                <CardHeader><CardTitle className="text-base">{item.name}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {item.short_description && <p className="text-sm text-muted-foreground line-clamp-2">{item.short_description}</p>}
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{item.cost_points} pts</Badge>
                    <span className="text-xs text-muted-foreground">{item.stock_available > 0 ? `${item.stock_available} em estoque` : "Esgotado"}</span>
                  </div>
                  <Button
                    className="w-full"
                    disabled={item.stock_available < 1 || redeeming === item.id || (wallet?.available_points ?? 0) < item.cost_points}
                    onClick={() => redeem(item)}
                  >
                    {redeeming === item.id ? "Processando..." : "Resgatar"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
