import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Header } from "@/components/Header";

const sb = supabase as any;

export default function MeusResgates() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await sb.from("points_redemptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setRows(data || []); setLoading(false);
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
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Meus Resgates</h1>
            <p className="text-muted-foreground text-sm">Acompanhe o status dos seus pedidos.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/loja-show")}>← Voltar à loja</Button>
        </div>

        {!rows.length ? (
          <Alert><AlertDescription>Você ainda não fez nenhum resgate.</AlertDescription></Alert>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Pontos</TableHead><TableHead>Status</TableHead><TableHead>Criado</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.order_number}</TableCell>
                      <TableCell>{r.total_points}</TableCell>
                      <TableCell><Badge variant={r.status === "APPROVED" || r.status === "DELIVERED" ? "default" : r.status === "REJECTED" || r.status === "CANCELLED" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{r.status === "PENDING" && <Button size="sm" variant="outline" onClick={() => cancel(r.id)}>Cancelar</Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
