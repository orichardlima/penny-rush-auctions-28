// Edge function: admin-emergency-withdrawal
// Allows admins to create an APPROVED withdrawal bypassing standard restrictions
// (window, minimum amount, 7-day grace period for PENDING bonuses).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(["partner", "affiliate"]),
  amount: z.number().positive(),
  pixKey: z.string().min(1).max(255),
  pixKeyType: z.enum(["cpf", "cnpj", "email", "phone", "random"]),
  holderName: z.string().min(1).max(255),
  reason: z.string().min(20).max(1000),
  releasePendingBonuses: z.boolean().default(false),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate JWT and get caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminUserId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify admin
    const { data: isAdmin, error: adminErr } = await admin.rpc(
      "is_admin_user",
      { _user_id: adminUserId },
    );
    if (adminErr || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin only" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate body
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const {
      userId,
      type,
      amount,
      pixKey,
      pixKeyType,
      holderName,
      reason,
      releasePendingBonuses,
    } = parsed.data;

    // Get admin name for audit
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", adminUserId)
      .maybeSingle();
    const adminName = adminProfile?.full_name || "Admin";

    const paymentDetails = {
      pix_key: pixKey,
      pix_key_type: pixKeyType,
      holder_name: holderName,
      emergency: true,
      reason,
      created_by_admin: adminUserId,
    };

    let withdrawalId: string;
    let releasedBonuses: string[] = [];

    if (type === "partner") {
      // Find the contract
      const { data: contract, error: contractErr } = await admin
        .from("partner_contracts")
        .select("id, user_id")
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contractErr || !contract) {
        return new Response(
          JSON.stringify({ error: "Active partner contract not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Optionally anticipate PENDING referral bonuses
      if (releasePendingBonuses) {
        const { data: pending } = await admin
          .from("partner_referral_bonuses")
          .select("id, bonus_value")
          .eq("referrer_contract_id", contract.id)
          .eq("status", "PENDING")
          .order("created_at", { ascending: true });

        let needed = amount;
        const toRelease: string[] = [];
        for (const b of pending || []) {
          if (needed <= 0) break;
          toRelease.push(b.id);
          needed -= Number(b.bonus_value);
        }
        if (toRelease.length > 0) {
          const { error: updErr } = await admin
            .from("partner_referral_bonuses")
            .update({
              status: "AVAILABLE",
              available_at: new Date().toISOString(),
            })
            .in("id", toRelease);
          if (updErr) {
            console.error("Error releasing bonuses", updErr);
          } else {
            releasedBonuses = toRelease;
          }
        }
      }

      // Create APPROVED withdrawal
      const { data: wd, error: wdErr } = await admin
        .from("partner_withdrawals")
        .insert({
          partner_contract_id: contract.id,
          amount,
          payment_method: "pix",
          payment_details: paymentDetails,
          status: "APPROVED",
          approved_at: new Date().toISOString(),
          approved_by: adminUserId,
          fee_percentage: 0,
          fee_amount: 0,
          net_amount: amount,
        })
        .select("id")
        .single();

      if (wdErr || !wd) {
        return new Response(
          JSON.stringify({ error: wdErr?.message || "Failed to create withdrawal" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      withdrawalId = wd.id;
    } else {
      // affiliate
      const { data: affiliate, error: affErr } = await admin
        .from("affiliates")
        .select("id, user_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (affErr || !affiliate) {
        return new Response(
          JSON.stringify({ error: "Affiliate not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: wd, error: wdErr } = await admin
        .from("affiliate_withdrawals")
        .insert({
          affiliate_id: affiliate.id,
          amount,
          payment_method: "pix",
          payment_details: paymentDetails,
          status: "approved",
          processed_by: adminUserId,
          fee_percentage: 0,
          fee_amount: 0,
          net_amount: amount,
        })
        .select("id")
        .single();

      if (wdErr || !wd) {
        return new Response(
          JSON.stringify({ error: wdErr?.message || "Failed to create withdrawal" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      withdrawalId = wd.id;
    }

    // Audit log
    await admin.from("admin_audit_log").insert({
      admin_user_id: adminUserId,
      admin_name: adminName,
      action_type: "emergency_withdrawal",
      target_type: type === "partner" ? "partner_withdrawal" : "affiliate_withdrawal",
      target_id: withdrawalId,
      new_values: {
        amount,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
        holder_name: holderName,
        released_bonuses_count: releasedBonuses.length,
        target_user_id: userId,
      },
      description: `Saque emergencial de R$ ${amount.toFixed(2)} para ${type === "partner" ? "parceiro" : "afiliado"}. Justificativa: ${reason}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        withdrawalId,
        releasedBonusesCount: releasedBonuses.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("emergency-withdrawal error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
