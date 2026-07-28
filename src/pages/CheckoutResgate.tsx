import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { useStoreCatalog } from "@/hooks/useStoreCatalog";
import { useStoreCart } from "@/hooks/useStoreCart";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Coins, ShieldCheck, Edit2 } from "lucide-react";

const sb = supabase as any;
const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");

export default function CheckoutResgate() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { wallet, loading: catalogLoading, refresh } = useStoreCatalog();
  const { items, totalPoints, clearCart } = useStoreCart();
  const [submitting, setSubmitting] = useState(false);
  const availablePoints = Number(wallet?.available_points ?? 0);
  const hasAddress = !!(profile?.cep && profile?.street && profile?.number && profile?.city && profile?.state);
  const insufficient = totalPoints > availablePoints;

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?redirect=/loja-show/checkout");
  }, [authLoading, user, navigate]);

  const handleSubmit = async () => {
    if (!items.length) { toast.error("Carrinho vazio"); return; }
    if (insufficient) { toast.error("Pontos insuficientes"); return; }
    if (!hasAddress) { toast.error("Endereço incompleto no perfil"); return; }

    setSubmitting(true);
    const shipping = {
      cep: profile!.cep,
      street: profile!.street,
      number: profile!.number,
      complement: profile!.complement || null,
      neighborhood: profile!.neighborhood,
      city: profile!.city,
      state: profile!.state,
      recipient_name: profile!.full_name,
      recipient_phone: profile!.phone || null,
    };
    const p_items = items.map(i => ({ item_id: i.item_id, quantity: i.quantity }));
    const p_idem = `redeem:${user!.id}:${Date.now()}`;

    const { error } = await sb.rpc("redeem_create", { p_items, p_shipping: shipping, p_idem });
    setSubmitting(false);

    if (error) {
      toast.error(error.message || "Falha ao criar resgate");
      return;
    }

    toast.success("Resgate solicitado! Aguarde aprovação.", {
      description: "Você receberá atualizações à medida que seu pedido for processado.",
    });
    clearCart();
    refresh();
    navigate("/meus-pontos");
  };

  if (authLoading || catalogLoading) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-6 max-w-4xl space-y-4">
          <Skeleton className="h-64" /><Skeleton className="h-40" />
        </div>
      </>
    );
  }

  if (!items.length) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-6 max-w-xl space-y-4">
          <Alert>
            <AlertTitle>Carrinho vazio</AlertTitle>
            <AlertDescription>Adicione itens da loja antes de finalizar um resgate.</AlertDescription>
          </Alert>
          <Button onClick={() => navigate("/loja-show")}>← Ir para a Loja Show</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Checkout — Loja Show" description="Finalize seu resgate de Pontos Show." />
      <Header />
      <div className="bg-[hsl(230_36%_98%)] min-h-screen">
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-12 max-w-5xl">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.3em] text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="h-3 w-3" /> Continuar comprando
          </button>

          <div className="mb-10">
            <h1 className="font-serif-display text-4xl md:text-5xl italic text-foreground">Finalizar resgate</h1>
            <p className="text-primary tracking-[0.3em] text-[10px] font-bold uppercase mt-2">
              Revise seus itens e endereço de entrega
            </p>
          </div>

          <div className="grid md:grid-cols-[1fr_360px] gap-8">
            {/* Coluna esquerda */}
            <div className="space-y-6">
              {/* Endereço */}
              <section className="bg-card border border-primary/15 p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h2 className="text-xs font-bold uppercase tracking-[0.3em]">Endereço de entrega</h2>
                  </div>
                  <Button variant="ghost" size="sm" className="text-[10px] uppercase tracking-widest gap-1" onClick={() => navigate("/dashboard?tab=profile")}>
                    <Edit2 className="h-3 w-3" /> Editar
                  </Button>
                </div>
                {hasAddress ? (
                  <div className="text-sm text-foreground/80 space-y-0.5">
                    <div className="font-medium text-foreground">{profile!.full_name}</div>
                    <div>{profile!.street}, {profile!.number}{profile!.complement ? ` — ${profile!.complement}` : ""}</div>
                    <div>{profile!.neighborhood} — {profile!.city}/{profile!.state}</div>
                    <div className="text-muted-foreground">CEP {profile!.cep}</div>
                    {profile!.phone && <div className="text-muted-foreground">Tel: {profile!.phone}</div>}
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertTitle>Endereço incompleto</AlertTitle>
                    <AlertDescription>
                      Complete seu endereço no perfil para receber o prêmio.{" "}
                      <button onClick={() => navigate("/dashboard?tab=profile")} className="underline font-medium">Atualizar perfil</button>
                    </AlertDescription>
                  </Alert>
                )}
              </section>

              {/* Itens */}
              <section className="bg-card border border-primary/15 p-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.3em]">Itens do resgate</h2>
                <div className="divide-y divide-primary/10">
                  {items.map(i => (
                    <div key={i.item_id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="w-16 h-16 bg-muted/40 flex-shrink-0 overflow-hidden">
                        {i.main_image_url && <img src={i.main_image_url} alt={i.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{i.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Qtd: {i.quantity}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-primary font-bold text-sm">{fmt(i.cost_points * i.quantity)} <span className="text-[9px] uppercase tracking-widest text-muted-foreground">pts</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <p>
                  Ao confirmar, seus pontos ficam reservados até a aprovação do resgate. Se o pedido for rejeitado ou cancelado, os pontos voltam automaticamente para o seu saldo.
                </p>
              </div>
            </div>

            {/* Coluna direita — resumo */}
            <aside className="md:sticky md:top-6 h-fit space-y-4">
              <div className="bg-card border border-primary/30 p-6 space-y-5">
                <h2 className="text-xs font-bold uppercase tracking-[0.3em]">Resumo</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total do resgate</span>
                    <span>{fmt(totalPoints)} pts</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Seu saldo</span>
                    <span>{fmt(availablePoints)} pts</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground border-t border-primary/10 pt-2">
                    <span>Saldo depois do resgate</span>
                    <span className={insufficient ? "text-destructive font-bold" : "font-bold text-foreground"}>
                      {fmt(availablePoints - totalPoints)} pts
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                  <span className="text-xs font-bold uppercase tracking-widest">Você paga</span>
                  <span className="font-serif-display text-2xl font-bold text-primary">
                    {fmt(totalPoints)} <span className="text-[10px] uppercase tracking-widest text-muted-foreground">pts</span>
                  </span>
                </div>

                <Button
                  className="w-full h-14 text-[10px] font-bold uppercase tracking-[0.3em]"
                  disabled={submitting || insufficient || !hasAddress}
                  onClick={handleSubmit}
                >
                  {submitting ? "Processando..." : "Confirmar resgate"}
                </Button>

                {insufficient && (
                  <p className="text-xs text-destructive text-center">
                    Faltam {fmt(totalPoints - availablePoints)} pts para este resgate.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground justify-center">
                <Coins className="h-3 w-3 text-primary" /> Pontos reservados até aprovação
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
