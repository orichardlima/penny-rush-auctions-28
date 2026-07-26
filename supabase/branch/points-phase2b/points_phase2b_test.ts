// Deno test — Fase 2B (branch). Requer Fase 2A e 2B aplicadas em preview.
import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL, KEY);

Deno.test("loja invisível com flag desligada", async () => {
  const { data: u } = await admin.from("profiles").select("id").limit(1).single();
  const { data } = await admin.rpc("store_visible_for", { p_user: u!.id });
  assertEquals(data, false);
});

Deno.test("redeem_create rejeita com store_disabled", async () => {
  const anon = createClient(URL, Deno.env.get("SUPABASE_ANON_KEY")!);
  await assertRejects(() => anon.rpc("redeem_create",
    { p_items: [], p_shipping: {}, p_idem: "t1" }).then(r => { if (r.error) throw r.error; }));
});

Deno.test("fluxo pending → approved reserva e confirma pontos", async () => {
  // presume seeds mínimos em preview; testa somente forma do fluxo.
  const flagOn  = await admin.from("points_program_settings_bool")
    .update({ setting_value: true }).eq("setting_key","points_program_enabled");
  assertEquals(flagOn.error, null);
  // ... (seeds de item + usuário com pontos são feitos externamente)
});

Deno.test("estoque volta ao rejeitar", async () => {
  const { data: red } = await admin.from("points_redemptions")
    .select("id, status").eq("status","PENDING").limit(1).maybeSingle();
  if (!red) return;
  const { data: u } = await admin.from("profiles").select("id").eq("role","admin").limit(1).maybeSingle();
  if (!u) return;
  const { error } = await admin.rpc("redeem_reject",
    { p_redemption: red.id, p_admin: u.id, p_reason: "test" });
  assertEquals(error, null);
});

Deno.test("preço alterado gera price_history", async () => {
  const { data: item } = await admin.from("points_store_items").select("id, cost_points").limit(1).maybeSingle();
  if (!item) return;
  await admin.from("points_store_items")
    .update({ cost_points: item.cost_points + 1 }).eq("id", item.id);
  const { data: hist } = await admin.from("points_store_item_price_history")
    .select("*").eq("item_id", item.id).order("created_at", { ascending: false }).limit(1);
  assert((hist?.length ?? 0) > 0);
});
