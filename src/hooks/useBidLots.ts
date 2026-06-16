import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface BidLot {
  id: string;
  source: string;
  initial_amount: number;
  remaining_amount: number;
  expires_at: string | null;
  created_at: string;
}

const SOURCE_LABEL: Record<string, string> = {
  purchase: "Compra de lances",
  partner_contract: "Bônus de plano",
  partner_upgrade: "Bônus de upgrade",
  migration: "Saldo anterior",
  signup_bonus: "Bônus de cadastro",
  referral: "Indicação",
  fury_vault: "Cofre da Fúria",
  admin_adjustment: "Ajuste do admin",
  promotion: "Promoção",
  unknown: "Outros",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

export function useBidLots() {
  const { user } = useAuth();
  const [lots, setLots] = useState<BidLot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLots([]);
      setLoading(false);
      return;
    }
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("bid_lots" as any)
        .select("id, source, initial_amount, remaining_amount, expires_at, created_at")
        .eq("user_id", user.id)
        .gt("remaining_amount", 0)
        .order("expires_at", { ascending: true, nullsFirst: false });
      if (!active) return;
      if (!error && data) setLots(data as unknown as BidLot[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`bid_lots_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bid_lots", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const nextExpiring = lots.find((l) => l.expires_at);
  return { lots, loading, nextExpiring };
}
