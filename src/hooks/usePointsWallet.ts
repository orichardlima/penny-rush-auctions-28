import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const sb = supabase as any;

export interface PointsWalletData {
  available_points: number;
  reserved_points: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  status: string;
}

export interface PointsProgressData {
  eligible_bids_remaining: number;
  pending_eligible_bids: number;
  bids_per_point: number;
}

export interface BidsBreakdown {
  base_available: number;
  bonus_available: number;
  total_available: number;
}

export function usePointsWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<PointsWalletData | null>(null);
  const [progress, setProgress] = useState<PointsProgressData | null>(null);
  const [breakdown, setBreakdown] = useState<BidsBreakdown>({
    base_available: 0,
    bonus_available: 0,
    total_available: 0,
  });
  const [storeVisible, setStoreVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [w, b, r, v, pendingBids, lots] = await Promise.all([
      sb.from("points_wallets").select("*").eq("user_id", user.id).maybeSingle(),
      sb.from("points_accrual_buckets").select("eligible_bids_remaining").eq("user_id", user.id).maybeSingle(),
      sb.from("points_rules").select("bids_per_point").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.rpc("store_visible_for", { p_user: user.id }),
      sb
        .from("bids")
        .select("id, auction_id")
        .eq("user_id", user.id)
        .eq("eligible_for_points", true),
      sb
        .from("bid_lots")
        .select("remaining_amount, source, eligible_for_points, lot_status")
        .eq("user_id", user.id)
        .eq("lot_status", "active")
        .gt("remaining_amount", 0),
    ]);

    const pendingRows = pendingBids.data || [];
    const auctionIds = Array.from(new Set(pendingRows.map((row: any) => row.auction_id).filter(Boolean))) as string[];
    let pendingEligibleBids = 0;
    if (auctionIds.length > 0) {
      const { data: activeAuctions } = await sb
        .from("auctions")
        .select("id")
        .in("id", auctionIds)
        .eq("status", "active");
      const activeAuctionIds = new Set((activeAuctions || []).map((auction: any) => auction.id));
      pendingEligibleBids = pendingRows.filter((row: any) => activeAuctionIds.has(row.auction_id)).length;
    }

    let base_available = 0;
    let bonus_available = 0;
    (lots.data || []).forEach((l: any) => {
      const amt = Number(l.remaining_amount || 0);
      const isBase = l.source === "paid_purchase" && l.eligible_for_points === true;
      if (isBase) base_available += amt;
      else bonus_available += amt;
    });

    setWallet(w.data || {
      available_points: 0, reserved_points: 0, lifetime_earned: 0, lifetime_redeemed: 0, status: "NORMAL",
    });
    setProgress({
      eligible_bids_remaining: b.data?.eligible_bids_remaining ?? 0,
      pending_eligible_bids: pendingEligibleBids,
      bids_per_point: r.data?.bids_per_point ?? 12,
    });
    setBreakdown({
      base_available,
      bonus_available,
      total_available: base_available + bonus_available,
    });
    setStoreVisible(!!v.data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { wallet, progress, breakdown, storeVisible, loading, reload: load };
}
