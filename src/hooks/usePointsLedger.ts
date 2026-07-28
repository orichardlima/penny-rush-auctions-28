import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const sb = supabase as any;

export interface LedgerEntry {
  id: string;
  transaction_type: string;
  points_delta: number;
  available_after: number;
  auction_id: string | null;
  reason: string | null;
  created_at: string;
  auction_title?: string | null;
}

export function usePointsLedger(limit = 30) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await sb
        .from("points_ledger")
        .select("id, transaction_type, points_delta, available_after, auction_id, reason, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      const rows: LedgerEntry[] = data || [];
      const auctionIds = Array.from(new Set(rows.map(r => r.auction_id).filter(Boolean))) as string[];
      let titles: Record<string, string> = {};
      if (auctionIds.length) {
        const { data: aucs } = await sb.from("auctions").select("id, title").in("id", auctionIds);
        titles = Object.fromEntries((aucs || []).map((a: any) => [a.id, a.title]));
      }
      setEntries(rows.map(r => ({ ...r, auction_title: r.auction_id ? titles[r.auction_id] : null })));
      setLoading(false);
    })();
  }, [user, limit]);

  return { entries, loading };
}
