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

export function usePointsWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<PointsWalletData | null>(null);
  const [progress, setProgress] = useState<PointsProgressData | null>(null);
  const [storeVisible, setStoreVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [w, b, r, v, pending] = await Promise.all([
      sb.from("points_wallets").select("*").eq("user_id", user.id).maybeSingle(),
      sb.from("points_accrual_buckets").select("eligible_bids_remaining").eq("user_id", user.id).maybeSingle(),
      sb.from("points_rules").select("bids_per_point").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.rpc("store_visible_for", { p_user: user.id }),
      sb
        .from("bids")
        .select("id, auctions!inner(status)", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("eligible_for_points", true)
        .eq("auctions.status", "active"),
    ]);
    setWallet(w.data || {
      available_points: 0, reserved_points: 0, lifetime_earned: 0, lifetime_redeemed: 0, status: "NORMAL",
    });
    setProgress({
      eligible_bids_remaining: b.data?.eligible_bids_remaining ?? 0,
      pending_eligible_bids: pending.count ?? 0,
      bids_per_point: r.data?.bids_per_point ?? 12,
    });
    setStoreVisible(!!v.data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { wallet, progress, storeVisible, loading, reload: load };
}
