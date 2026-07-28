import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag } from "lucide-react";

const sb = supabase as any;
const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  PENDING:    { label: "Aguardando aprovação", variant: "secondary" },
  APPROVED:   { label: "Aprovado",              variant: "default" },
  SEPARATING: { label: "Em separação",          variant: "default" },
  SHIPPED:    { label: "Enviado",               variant: "default" },
  DELIVERED:  { label: "Entregue",              variant: "default" },
  REJECTED:   { label: "Rejeitado",             variant: "destructive" },
  CANCELLED:  { label: "Cancelado",             variant: "outline" },
  REVERSED:   { label: "Estornado",             variant: "outline" },
};

export function RecentRedemptionsCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await sb
        .from("points_redemptions")
        .select("id, order_number, status, total_points, created_at, points_redemption_items(quantity, item_snapshot)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);
      setRows(data || []);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>;
  }

  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          Meus resgates recentes
        </CardTitle>
        <Button size="sm" variant="link" className="text-xs" onClick={() => navigate("/loja-show")}>
          Ir para a loja →
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map(r => {
          const meta = STATUS_META[r.status] || { label: r.status, variant: "outline" as const };
          const firstItem = r.points_redemption_items?.[0]?.item_snapshot;
          const itemsCount = r.points_redemption_items?.length || 0;
          const summary = firstItem
            ? itemsCount > 1 ? `${firstItem.name} + ${itemsCount - 1} outro(s)` : firstItem.name
            : "—";
          return (
            <div key={r.id} className="flex items-center justify-between gap-3 border-b border-border/60 last:border-0 pb-3 last:pb-0">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{summary}</div>
                <div className="text-xs text-muted-foreground">
                  Pedido #{r.order_number} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                <div className="text-xs text-muted-foreground mt-1">{fmt(r.total_points)} pts</div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
