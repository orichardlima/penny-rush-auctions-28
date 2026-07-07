// recalculate-weekly-scores — cron protegido por x-cron-key.
// verify_jwt=false, POST-only. Cálculo de week_start timezone-safe para America/Bahia.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CRON_KEY = Deno.env.get("PERFORMANCE_CRON_SECRET") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Data de hoje já no fuso America/Bahia, formato YYYY-MM-DD (en-CA).
function bahiaTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// A partir de uma data ISO (já interpretada como dia local Bahia),
// devolve a segunda-feira daquela semana no formato YYYY-MM-DD.
// Toda a aritmética é feita em UTC para evitar drift de fuso.
function toMondayISO(dateISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) throw new Error("invalid_date_format");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const utc = new Date(Date.UTC(y, mo - 1, d));
  const dow = utc.getUTCDay(); // 0=dom..6=sab
  const back = dow === 0 ? 6 : dow - 1;
  utc.setUTCDate(utc.getUTCDate() - back);
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
}

async function auditError(action: string, err: unknown, meta: Record<string, unknown> = {}) {
  try {
    await supabase.from("performance_audit_logs").insert({
      action,
      error_message: String(err instanceof Error ? err.message : err).slice(0, 500),
      metadata: meta,
    });
  } catch (_) { /* silencioso */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, reason: "method_not_allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const providedKey = req.headers.get("x-cron-key") ?? "";
  if (!CRON_KEY || providedKey !== CRON_KEY) {
    await auditError("recalculate_unauthorized", "invalid_or_missing_cron_key", {
      has_header: !!req.headers.get("x-cron-key"),
    });
    return new Response(
      JSON.stringify({ ok: false, reason: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    let requestedWeek: string | undefined;
    const raw = await req.text();
    if (raw && raw.length > 0) {
      if (raw.length > 1024) {
        return new Response(
          JSON.stringify({ ok: false, reason: "payload_too_large" }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      try {
        const body = JSON.parse(raw);
        if (body && typeof body.week_start === "string") {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(body.week_start)) {
            return new Response(
              JSON.stringify({ ok: false, reason: "invalid_week_start_format" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          requestedWeek = body.week_start;
        }
      } catch {
        return new Response(
          JSON.stringify({ ok: false, reason: "malformed_json" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const baseDate = requestedWeek ?? bahiaTodayISO();
    const weekStart = toMondayISO(baseDate);

    const { data, error } = await supabase.rpc("calculate_all_partner_weekly_scores", {
      p_week_start: weekStart,
    });

    if (error) {
      await auditError("recalculate_rpc_error", error, { week_start: weekStart });
      return new Response(
        JSON.stringify({ ok: false, reason: "internal_error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, week_start: weekStart, result: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    await auditError("recalculate_fatal", e);
    return new Response(
      JSON.stringify({ ok: false, reason: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
