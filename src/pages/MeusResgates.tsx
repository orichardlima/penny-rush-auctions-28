import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Check, Clock, Package, Truck, Home, Copy } from "lucide-react";

const sb = supabase as any;
const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Aguardando aprovação", APPROVED: "Aprovado", REJECTED: "Rejeitado",
  SEPARATING: "Em separação", SHIPPED: "Enviado", DELIVERED: "Entregue",
  CANCELLED: "Cancelado", REVERSED: "Estornado",
};

const STEPS = [
  { key: "PENDING", label: "Pedido feito", icon: Clock },
  { key: "APPROVED", label: "Aprovado", icon: Check },
  { key: "SEPARATING", label: "Em separação", icon: Package },
  { key: "SHIPPED", label: "Enviado", icon: Truck },
  { key: "DELIVERED", label: "Entregue", icon: Home },
];

function Timeline({ status }: { status: string }) {
  if (["REJECTED", "CANCELLED", "REVERSED"].includes(status)) return null;
  const current = Math.max(0, STEPS.findIndex(s => s.key === status));
  return (
    <div className="flex items-center gap-1 pt-1">
      {STEPS.map((s, idx) => {
        const done = idx <= current;
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex items-center w-full">
              <div className={`h-0.5 flex-1 ${idx === 0 ? "bg-transparent" : done ? "bg-primary" : "bg-muted"}`} />
              <div className={`h-7 w-7 rounded-full flex items-center justify-center border ${done ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className={`h-0.5 flex-1 ${idx === STEPS.length - 1 ? "bg-transparent" : idx < current ? "bg-primary" : "bg-muted"}`} />
            </div>
            <span className={`text-[10px] text-center leading-tight ${done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function MeusResgates() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await sb.from("points_redemptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const list = data || [];
    setRows(list);
    if (list.length) {
      const { data: its } = await sb
        .from("points_redemption_items")
        .select("*")
        .in("redemption_id", list.map((r: any) => r.id));
      const map: Record<string, any[]> = {};
      (its || []).forEach((it: any) => {
        (map[it.redemption_id] ||= []).push(it);
      });
      setItemsByOrder(map);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const cancel = async (id: string) => {
    if (!confirm("Cancelar este pedido? Os pontos serão devolvidos.")) return;
    const { error } = await sb.rpc("redeem_cancel", { p_redemption: id, p_reason: "cancelado pelo usuário" });
    if (error) toast.error(error.message); else { toast.success("Cancelado"); await load(); }
  };

  if (authLoading || loading) return <><Header /><div className="container mx-auto p-6"><Skeleton className="h-96" /></div></>;

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Meus Resgates</h1>
            <p className="text-muted-foreground text-sm">Acompanhe o status e a entrega dos seus prêmios.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/loja-show")}>← Voltar à loja</Button>
        </div>

        {!rows.length ? (
          <Alert><AlertDescription>Você ainda não fez nenhum resgate.</AlertDescription></Alert>
        ) : (
          <div className="space-y-4">
            {rows.map(r => {
              const negative = ["REJECTED", "CANCELLED", "REVERSED"].includes(r.status);
              return (
                <Card key={r.id}>
                  <CardContent className="p-4 md:p-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{r.order_number}</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">{fmt(r.total_points)} pts</span>
                        <Badge variant={negative ? "destructive" : r.status === "DELIVERED" ? "default" : "secondary"}>
                          {STATUS_LABEL[r.status] || r.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {(itemsByOrder[r.id] || []).map(it => (
                        <div key={it.id} className="flex items-center gap-3 text-sm">
                          {it.item_snapshot?.main_image_url && (
                            <img src={it.item_snapshot.main_image_url} alt={it.item_snapshot?.name || "Prêmio"} className="h-10 w-10 object-cover rounded border" />
                          )}
                          <span className="flex-1">{it.item_snapshot?.name || "Item"}</span>
                          <span className="text-xs text-muted-foreground">{it.quantity}x · {fmt(it.points_total)} pts</span>
                        </div>
                      ))}
                    </div>

                    <Timeline status={r.status} />

                    {(r.tracking_code || r.carrier) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs bg-muted/50 rounded p-2">
                        <Truck className="h-4 w-4 text-primary" />
                        <span>Transportadora: <b>{r.carrier || "—"}</b></span>
                        {r.tracking_code && (
                          <>
                            <span>· Rastreio: <b className="font-mono">{r.tracking_code}</b></span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => { navigator.clipboard.writeText(r.tracking_code); toast.success("Código copiado"); }}
                            >
                              <Copy className="h-3 w-3 mr-1" />Copiar
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                    {r.admin_notes && (
                      <p className="text-xs text-muted-foreground">Observação: {r.admin_notes}</p>
                    )}

                    {r.status === "PENDING" && (
                      <Button size="sm" variant="outline" onClick={() => cancel(r.id)}>Cancelar pedido</Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
