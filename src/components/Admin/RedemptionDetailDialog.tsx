import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { MapPin, Package, History } from "lucide-react";

const sb = supabase as any;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente", APPROVED: "Aprovado", REJECTED: "Rejeitado",
  SEPARATING: "Em separação", SHIPPED: "Enviado", DELIVERED: "Entregue",
  CANCELLED: "Cancelado", REVERSED: "Estornado",
};

export function RedemptionDetailDialog({
  redemption,
  open,
  onOpenChange,
}: {
  redemption: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !redemption) return;
    (async () => {
      setLoading(true);
      const [i, h, p] = await Promise.all([
        sb.from("points_redemption_items").select("*").eq("redemption_id", redemption.id),
        sb.from("points_redemption_status_history").select("*").eq("redemption_id", redemption.id).order("created_at", { ascending: true }),
        sb.from("profiles").select("full_name,email,phone").eq("id", redemption.user_id).maybeSingle(),
      ]);
      setItems(i.data || []);
      setHistory(h.data || []);
      setProfile(p.data || null);
      setLoading(false);
    })();
  }, [open, redemption]);

  const addr = redemption?.shipping_address_snapshot || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Pedido <span className="font-mono text-sm">{redemption?.order_number}</span>
            <Badge variant="secondary">{STATUS_LABEL[redemption?.status] || redemption?.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? <Skeleton className="h-64 w-full" /> : (
          <div className="space-y-5 text-sm">
            <div>
              <p className="font-semibold">{profile?.full_name || "Usuário"}</p>
              <p className="text-muted-foreground text-xs">{profile?.email} {profile?.phone ? `• ${profile.phone}` : ""}</p>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-primary" />Itens</p>
              {items.map((it) => (
                <div key={it.id} className="flex justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">{it.item_snapshot?.name || "Item"}</div>
                    <div className="text-xs text-muted-foreground">Qtd: {it.quantity} × {it.points_unit} pts</div>
                  </div>
                  <div className="font-semibold text-primary">{it.points_total} pts</div>
                </div>
              ))}
              <div className="flex justify-between font-semibold pt-1">
                <span>Total</span><span className="text-primary">{redemption?.total_points} pts</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />Endereço de entrega</p>
              {Object.keys(addr).length === 0 ? (
                <p className="text-muted-foreground text-xs">Sem endereço registrado.</p>
              ) : (
                <p className="text-muted-foreground whitespace-pre-line text-xs">
                  {[addr.recipient || addr.nome, addr.street || addr.logradouro, addr.number || addr.numero, addr.complement || addr.complemento,
                    addr.district || addr.bairro, addr.city || addr.cidade, addr.state || addr.uf, addr.zip || addr.cep]
                    .filter(Boolean).join(", ")}
                </p>
              )}
              {(redemption?.tracking_code || redemption?.carrier) && (
                <p className="text-xs pt-1">
                  Envio: <b>{redemption?.carrier || "—"}</b> • Rastreio: <b className="font-mono">{redemption?.tracking_code || "—"}</b>
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="font-semibold flex items-center gap-2"><History className="h-4 w-4 text-primary" />Histórico</p>
              {!history.length ? (
                <p className="text-muted-foreground text-xs">Sem movimentações registradas.</p>
              ) : history.map((h) => (
                <div key={h.id} className="flex justify-between text-xs border-l-2 border-primary/30 pl-3 py-1">
                  <span>{STATUS_LABEL[h.old_status] || h.old_status} → <b>{STATUS_LABEL[h.new_status] || h.new_status}</b>{h.reason ? ` — ${h.reason}` : ""}</span>
                  <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
