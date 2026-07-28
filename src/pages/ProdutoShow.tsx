import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { useStoreCatalog } from "@/hooks/useStoreCatalog";
import { useStoreCart } from "@/hooks/useStoreCart";
import { CartDrawer } from "@/components/Loja/CartDrawer";
import { ArrowLeft, ShoppingBag, Coins, Check, Truck, ShieldCheck } from "lucide-react";

const sb = supabase as any;
const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");

export default function ProdutoShow() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { wallet } = useStoreCatalog();
  const { items: cartItems, totalItems, addItem } = useStoreCart();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const availablePoints = Number(wallet?.available_points ?? 0);

  useEffect(() => {
    if (!authLoading && !user) navigate(`/auth?redirect=/loja-show/${slug}`);
  }, [authLoading, user, slug, navigate]);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      setLoading(true);
      const { data } = await sb
        .from("points_store_items")
        .select("*")
        .eq("slug", slug)
        .eq("status", "ACTIVE")
        .maybeSingle();
      setItem(data);
      setLoading(false);
    })();
  }, [slug]);

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-6 grid md:grid-cols-2 gap-8 max-w-6xl">
          <Skeleton className="aspect-square" />
          <Skeleton className="h-96" />
        </div>
      </>
    );
  }

  if (!item) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-6 max-w-xl">
          <Alert><AlertDescription>Produto não encontrado.</AlertDescription></Alert>
          <Button variant="link" className="mt-4" onClick={() => navigate("/loja-show")}>← Voltar à loja</Button>
        </div>
      </>
    );
  }

  const inCart = cartItems.find(c => c.item_id === item.id);
  const soldOut = item.stock_available < 1;
  const canAfford = availablePoints >= item.cost_points;

  return (
    <>
      <SEOHead
        title={`${item.name} — Loja Show`}
        description={item.short_description || `Resgate ${item.name} com ${fmt(item.cost_points)} Pontos Show.`}
      />
      <Header />
      <div className="bg-[hsl(230_36%_98%)] min-h-screen">
        <div className="container mx-auto px-4 md:px-6 py-8 max-w-6xl">
          <Link to="/loja-show" className="inline-flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.3em] text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="h-3 w-3" /> Voltar à loja
          </Link>

          <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
            <div className="bg-[hsl(45_40%_97%)] aspect-square border border-primary/10 overflow-hidden">
              {item.main_image_url ? (
                <img src={item.main_image_url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Sem imagem</div>
              )}
            </div>

            <div className="space-y-8">
              {item.brand && (
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.3em]">{item.brand}</p>
              )}
              <h1 className="font-serif-display text-4xl md:text-5xl text-foreground italic leading-tight">
                {item.name}
              </h1>

              <div className="flex items-end gap-3 border-b border-primary/20 pb-6">
                <span className="font-serif-display text-6xl font-bold text-primary leading-none">
                  {fmt(item.cost_points)}
                </span>
                <span className="text-xs font-bold text-muted-foreground uppercase pb-2 tracking-widest">pontos</span>
              </div>

              {item.short_description && (
                <p className="text-base text-muted-foreground leading-relaxed">{item.short_description}</p>
              )}
              {item.full_description && (
                <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                  {item.full_description}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Truck className="h-4 w-4 text-primary" />
                  {item.estimated_days ? `Envio em até ${item.estimated_days} dias` : "Envio pela plataforma"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Resgate seguro e auditado
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  <span>{soldOut ? "Esgotado" : `${item.stock_available} em estoque`}</span>
                  <span className="flex items-center gap-1"><Coins className="h-3 w-3" /> Você tem {fmt(availablePoints)} pts</span>
                </div>

                <Button
                  size="lg"
                  disabled={soldOut}
                  onClick={() => {
                    addItem({
                      item_id: item.id,
                      slug: item.slug,
                      name: item.name,
                      cost_points: item.cost_points,
                      main_image_url: item.main_image_url,
                      stock_available: item.stock_available,
                      per_user_limit: item.per_user_limit,
                    });
                    setCartOpen(true);
                  }}
                  className="w-full h-14 text-[10px] font-bold uppercase tracking-[0.3em]"
                >
                  {soldOut
                    ? "Esgotado"
                    : inCart
                    ? <><Check className="h-4 w-4 mr-2" /> Adicionado — abrir carrinho</>
                    : "Adicionar ao carrinho"}
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  disabled={soldOut || !canAfford}
                  onClick={() => {
                    addItem({
                      item_id: item.id,
                      slug: item.slug,
                      name: item.name,
                      cost_points: item.cost_points,
                      main_image_url: item.main_image_url,
                      stock_available: item.stock_available,
                      per_user_limit: item.per_user_limit,
                    });
                    navigate("/loja-show/checkout");
                  }}
                  className="w-full h-14 text-[10px] font-bold uppercase tracking-[0.3em] border-foreground/80 text-foreground hover:bg-foreground hover:text-background"
                >
                  Resgatar agora
                </Button>

                {!canAfford && !soldOut && (
                  <p className="text-xs text-center text-muted-foreground">
                    Faltam <strong className="text-foreground">{fmt(item.cost_points - availablePoints)} pontos</strong>. Continue dando lances para acumular.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} availablePoints={availablePoints} />
    </>
  );
}
