import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const sb = supabase as any;

export type AuctionPointsStatus = "waiting" | "converted" | "won";

export interface AuctionBidsRow {
  auction_id: string;
  title: string;
  image_url: string | null;
  bid_count: number;
  base_count: number;
  bonus_count: number;
  last_bid_at: string;
  status: AuctionPointsStatus;
  auction_status: string;
  finished_at: string | null;
}

export function usePointsBidsByAuction() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AuctionBidsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Consumo real: bid_lot_consumptions -> distingue base (eligible) x bonus (não eligible)
    const { data: consumptions } = await sb
      .from("bid_lot_consumptions")
      .select("amount_consumed, eligible_for_points, created_at, bids!inner(auction_id, user_id, created_at)")
      .eq("bids.user_id", user.id);

    const grouped = new Map<
      string,
      { base: number; bonus: number; last: string }
    >();

    (consumptions || []).forEach((c: any) => {
      const auctionId = c.bids?.auction_id;
      if (!auctionId) return;
      const amt = Number(c.amount_consumed || 0);
      const when = c.bids?.created_at || c.created_at;
      const g = grouped.get(auctionId) || { base: 0, bonus: 0, last: when };
      if (c.eligible_for_points) g.base += amt;
      else g.bonus += amt;
      if (when > g.last) g.last = when;
      grouped.set(auctionId, g);
    });

    const auctionIds = Array.from(grouped.keys());
    if (auctionIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const [{ data: auctions }, { data: orders }] = await Promise.all([
      sb.from("auctions").select("id, title, image_url, status, finished_at").in("id", auctionIds),
      sb.from("orders").select("auction_id, user_id").in("auction_id", auctionIds),
    ]);

    const winnersByAuction = new Map<string, string>();
    (orders || []).forEach((o: any) => {
      if (o.auction_id && o.user_id) winnersByAuction.set(o.auction_id, o.user_id);
    });

    const list: AuctionBidsRow[] = (auctions || []).map((a: any) => {
      const g = grouped.get(a.id)!;
      let status: AuctionPointsStatus;
      if (a.status === "active") {
        status = "waiting";
      } else if (winnersByAuction.get(a.id) === user.id) {
        status = "won";
      } else {
        status = "converted";
      }
      return {
        auction_id: a.id,
        title: a.title,
        image_url: a.image_url,
        base_count: g.base,
        bonus_count: g.bonus,
        bid_count: g.base + g.bonus,
        last_bid_at: g.last,
        status,
        auction_status: a.status,
        finished_at: a.finished_at,
      };
    });

    // sort: waiting first (newest), then finished (newest)
    const order = { waiting: 0, converted: 1, won: 2 } as const;
    list.sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return (b.last_bid_at || "").localeCompare(a.last_bid_at || "");
    });

    setRows(list);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, reload: load };
}
