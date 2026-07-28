import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const sb = supabase as any;

export interface StoreItem {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  full_description: string | null;
  category_id: string | null;
  brand: string | null;
  model: string | null;
  main_image_url: string | null;
  cost_points: number;
  reference_value_brl: number | null;
  stock_available: number;
  per_user_limit: number | null;
  featured: boolean;
  estimated_days: number | null;
  free_shipping: boolean;
  item_type: "PHYSICAL" | "DIGITAL";
  status: string;
}

export interface StoreCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export function useStoreCatalog() {
  const { user } = useAuth();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [visible, setVisible] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const [v, w, i, c] = await Promise.all([
      sb.rpc("store_visible_for", { p_user: user.id }),
      sb.from("points_wallets").select("*").eq("user_id", user.id).maybeSingle(),
      sb.from("points_store_items").select("*").eq("status", "ACTIVE").order("featured", { ascending: false }).order("cost_points", { ascending: true }),
      sb.from("points_store_categories").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    ]);
    setVisible(!!v.data);
    setWallet(w.data);
    setItems(i.data || []);
    setCategories(c.data || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  return { items, categories, wallet, visible, loading, refresh };
}
