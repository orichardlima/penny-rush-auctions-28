import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { useStoreCatalog } from "@/hooks/useStoreCatalog";
import { useStoreCart } from "@/hooks/useStoreCart";
import { CartDrawer } from "@/components/Loja/CartDrawer";
import { ShoppingBag, Coins, Check } from "lucide-react";

const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");

export default function LojaShow() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { items, categories, wallet, visible, loading } = useStoreCatalog();
  const { items: cartItems, totalItems, addItem } = useStoreCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const availablePoints = Number(wallet?.available_points ?? 0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?redirect=/loja-show");
  }, [authLoading, user, navigate]);

  const filtered = useMemo(() => {
    if (categoryId === "all") return items;
    return items.filter(i => i.category_id === categoryId);
  }, [items, categoryId]);

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-24" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <Skeleton className="h-96" /><Skeleton className="h-96" /><Skeleton className="h-96" />
          </div>
        </div>
      </>
    );
  }

  if (!visible) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-6 max-w-2xl">
          <Alert>
            <AlertTitle>Loja em breve</AlertTitle>
            <AlertDescription>
              A Loja Show ainda não está disponível para o seu perfil. Em breve você poderá trocar seus Pontos Show por recompensas.
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="Loja Show — Troque seus Pontos por prêmios"
        description="Vitrine exclusiva de prêmios do Show de Lances. Troque seus Pontos Show por eletrônicos, gadgets e mais."
      />
      <Header />
      <div className="bg-[hsl(230_36%_98%)] min-h-screen">
        <div className="container mx-auto px-4 md:px-6 py-10 md:py-14 max-w-6xl space-y-12">
          {/* Cabeçalho boutique */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-primary/20 pb-8">
            <div>
              <h1 className="font-serif-display text-4xl md:text-5xl font-medium italic text-foreground">
                Loja Show
              </h1>
              <p className="text-primary tracking-[0.3em] text-[10px] font-bold uppercase mt-2">
                Onde seus lances valem prêmios
              </p>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {/* Categorias */}
              {categories.length > 0 && (
                <div className="hidden md:flex gap-6 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  <button
                    onClick={() => setCategoryId("all")}
                    className={`pb-1 transition-colors ${categoryId === "all" ? "text-primary border-b border-primary" : "hover:text-primary"}`}
                  >
                    Destaques
                  </button>
                  {categories.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setCategoryId(c.id)}
                      className={`pb-1 transition-colors ${categoryId === c.id ? "text-primary border-b border-primary" : "hover:text-primary"}`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Saldo */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-primary-glow blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative flex items-center gap-4 bg-card border border-primary/30 px-5 py-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter">Saldo atual</span>
                    <span className="text-xl font-light text-foreground">
                      {fmt(availablePoints)} <span className="text-primary font-bold">PTS</span>
                    </span>
                  </div>
                  <div className="w-10 h-10 flex items-center justify-center bg-primary/10 rounded-full">
                    <Coins className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </div>

              {/* Carrinho */}
              <Button
                variant="outline"
                onClick={() => setCartOpen(true)}
                className="relative border-primary/30 hover:border-primary hover:bg-primary/5 h-[62px] px-4"
              >
                <ShoppingBag className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Filtros mobile */}
          {categories.length > 0 && (
            <div className="md:hidden flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              <button
                onClick={() => setCategoryId("all")}
                className={`whitespace-nowrap px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${categoryId === "all" ? "bg-primary text-primary-foreground border-primary" : "border-primary/20 text-muted-foreground"}`}
              >
                Destaques
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={`whitespace-nowrap px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${categoryId === c.id ? "bg-primary text-primary-foreground border-primary" : "border-primary/20 text-muted-foreground"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          {filtered.length === 0 ? (
            <Alert><AlertDescription>Nenhum item disponível nesta categoria.</AlertDescription></Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
              {filtered.map((item, idx) => {
                const inCart = cartItems.find(c => c.item_id === item.id);
                const soldOut = item.stock_available < 1;
                const canAfford = availablePoints >= item.cost_points;
                const highlight = item.featured || idx === 1;
                const stockLabel =
                  soldOut ? "ESGOTADO" :
                  item.stock_available <= 2 ? "ÚLTIMAS PEÇAS" :
                  item.stock_available <= 5 ? "POUCAS UNIDADES" :
                  "DISPONÍVEL";

                return (
                  <article
                    key={item.id}
                    className={`group relative bg-card border transition-all duration-500 ${
                      highlight
                        ? "border-primary/30 shadow-xl shadow-primary/5 hover:border-primary/60"
                        : "border-primary/10 hover:border-primary/50"
                    }`}
                  >
                    <button
                      onClick={() => navigate(`/loja-show/${item.slug}`)}
                      className="relative aspect-square w-full bg-[hsl(45_40%_97%)] overflow-hidden block"
                      aria-label={`Ver detalhes de ${item.name}`}
                    >
                      <span className={`absolute top-5 left-5 z-10 px-3 py-1 text-[9px] font-bold tracking-widest ${
                        soldOut
                          ? "bg-muted text-muted-foreground"
                          : item.stock_available <= 5
                          ? "bg-primary text-primary-foreground"
                          : "bg-card/90 backdrop-blur text-primary border border-primary/20"
                      }`}>
                        {stockLabel}
                      </span>
                      {item.main_image_url ? (
                        <img
                          src={item.main_image_url}
                          alt={item.name}
                          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs uppercase tracking-widest text-muted-foreground">
                          Sem imagem
                        </div>
                      )}
                    </button>

                    <div className="p-6 md:p-8 space-y-6">
                      <div className="space-y-1">
                        <h3 className="font-serif-display text-2xl text-foreground leading-tight">
                          {item.name}
                        </h3>
                        {item.brand && (
                          <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest">
                            {item.brand}
                          </p>
                        )}
                      </div>

                      <div className="flex items-end gap-2">
                        <span className="font-serif-display text-4xl font-bold text-primary leading-none">
                          {fmt(item.cost_points)}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground uppercase pb-1 tracking-widest">
                          pontos
                        </span>
                      </div>

                      <Button
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
                        disabled={soldOut}
                        variant={highlight ? "default" : "outline"}
                        className={`w-full py-6 text-[10px] font-bold uppercase tracking-[0.3em] transition-all duration-300 ${
                          highlight
                            ? "bg-foreground text-background hover:bg-primary hover:text-primary-foreground"
                            : "border-foreground/80 text-foreground hover:bg-foreground hover:text-background"
                        }`}
                      >
                        {soldOut
                          ? "Esgotado"
                          : inCart
                          ? <><Check className="h-3 w-3 mr-2" /> No carrinho ({inCart.quantity})</>
                          : "Adicionar ao carrinho"}
                      </Button>

                      {!canAfford && !soldOut && (
                        <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest">
                          Faltam {fmt(item.cost_points - availablePoints)} pts
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <p className="text-center text-[10px] text-muted-foreground font-medium uppercase tracking-[0.4em] pt-8">
            Resgate sujeito a disponibilidade, análise e termos de uso
          </p>
        </div>
      </div>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} availablePoints={availablePoints} />
    </>
  );
}
