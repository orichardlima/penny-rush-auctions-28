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

    const { data: bids } = await sb
      .from("bids")
      .select("auction_id, created_at")
      .eq("user_id", user.id)
      .eq("eligible_for_points", true);

    const grouped = new Map<string, { count: number; last: string }>();
    (bids || []).forEach((b: any) => {
      if (!b.auction_id) return;
      const g = grouped.get(b.auction_id);
      if (g) {
        g.count += 1;
        if (b.created_at > g.last) g.last = b.created_at;
      } else {
        grouped.set(b.auction_id, { count: 1, last: b.created_at });
      }
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
        bid_count: g.count,
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
