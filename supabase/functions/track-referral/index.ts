// track-referral — endpoint público (verify_jwt=false), FASE 1A modo relatório.
// Nunca bloqueia o visitante em casos não fatais. Sempre redireciona para landing (GET).
// Retorna 4xx apenas em: payload > 4KB (413), JSON malformado (400) ou schema inválido (400) no POST.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const LANDING = "https://showdelances.com/";

const ALLOWED_HOSTS = new Set<string>([
  "showdelances.com",
  "www.showdelances.com",
  "testeleilao.site",
  "www.testeleilao.site",
  "penny-rush-auctions-28.lovable.app",
  "id-preview--a9bdfc06-a96f-4acd-9270-1da71c1988cb.lovable.app",
]);

// [FASE 1A] Rate limit in-memory best-effort. Múltiplas instâncias/cold start
// tornam este limite não-definitivo. Antifraude real depende de dedupe + hashes
// + caps no banco. TODO Fase 2: store persistente (Upstash / pg advisory lock).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

const SALT = Deno.env.get("PERFORMANCE_TRACKING_SALT") ?? "unset-salt";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// zod .strip() é o padrão: campos extras silenciosamente descartados.
// Campos server-only (auth_user_id, partner_user_id, points_awarded,
// is_qualified, status, fraud_flags) NÃO existem no schema.
const BodySchema = z.object({
  code: z.string().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/),
  visitor_id: z.string().min(8).max(64).optional(),
  session_id: z.string().min(8).max(64).optional(),
  referrer: z.string().max(500).optional(),
  landing_url: z.string().max(500).optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  utm_content: z.string().max(100).optional(),
  utm_term: z.string().max(100).optional(),
});

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + "|" + input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isAllowedHost(url: string): boolean {
  try {
    return ALLOWED_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function safeLanding(url?: string | null): { url: string; blocked: boolean } {
  if (!url) return { url: LANDING, blocked: false };
  return isAllowedHost(url) ? { url, blocked: false } : { url: LANDING, blocked: true };
}

function checkRate(key: string): boolean {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || b.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  b.count += 1;
  return b.count <= RATE_MAX;
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function getAuthUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: url },
  });
}

async function auditError(action: string, err: unknown, meta: Record<string, unknown> = {}) {
  try {
    await supabase.from("performance_audit_logs").insert({
      action,
      error_message: String(err instanceof Error ? err.message : err).slice(0, 500),
      metadata: meta,
    });
  } catch (_) { /* nunca propagar */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const isGet = req.method === "GET";

  try {
    const url = new URL(req.url);

    let payload: unknown;
    if (isGet) {
      const parts = url.pathname.split("/").filter(Boolean);
      const codeFromPath = parts[parts.length - 1];
      payload = {
        code: codeFromPath,
        visitor_id: url.searchParams.get("vid") ?? undefined,
        session_id: url.searchParams.get("sid") ?? undefined,
        referrer: req.headers.get("referer") ?? undefined,
        landing_url: url.searchParams.get("landing") ?? undefined,
        utm_source: url.searchParams.get("utm_source") ?? undefined,
        utm_medium: url.searchParams.get("utm_medium") ?? undefined,
        utm_campaign: url.searchParams.get("utm_campaign") ?? undefined,
        utm_content: url.searchParams.get("utm_content") ?? undefined,
        utm_term: url.searchParams.get("utm_term") ?? undefined,
      };
    } else if (req.method === "POST") {
      const raw = await req.text();
      if (raw.length > 4096) {
        return new Response(
          JSON.stringify({ ok: false, reason: "payload_too_large" }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      try {
        payload = JSON.parse(raw);
      } catch {
        return new Response(
          JSON.stringify({ ok: false, reason: "malformed_json" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      return new Response("method not allowed", { status: 405, headers: corsHeaders });
    }

    const parsed = BodySchema.safeParse(payload);
    if (!parsed.success) {
      if (isGet) return redirect(LANDING);
      return new Response(
        JSON.stringify({ ok: false, reason: "invalid_payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const b = parsed.data;

    const ipRaw = getClientIp(req);
    const uaRaw = req.headers.get("user-agent") ?? "unknown";
    const ipHash = await sha256(ipRaw);
    const uaHash = await sha256(uaRaw);

    const { url: landing, blocked: hostBlocked } = safeLanding(b.landing_url);

    const rateKey = ipHash + "|" + b.code;
    if (!checkRate(rateKey)) {
      try {
        await supabase.from("tracking_events").insert({
          event_type: "click",
          referral_code: b.code,
          visitor_id: b.visitor_id ?? null,
          ip_hash: ipHash,
          ua_hash: uaHash,
          is_suspicious: true,
          is_qualified: false,
          fraud_flags: ["rate_limited"],
          metadata: hostBlocked ? { host_flag: "host_not_allowed" } : {},
        });
      } catch (e) {
        await auditError("rate_limit_insert_error", e);
      }
      return isGet ? redirect(landing) : new Response(
        JSON.stringify({ ok: false, reason: "rate_limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // self-click via JWT server-side (nunca do body/query)
    const authUserId = await getAuthUserId(req);

    const metadata: Record<string, unknown> = {};
    if (authUserId) metadata.auth_user_id = authUserId;
    if (hostBlocked) metadata.host_flag = "host_not_allowed";
    if (ipRaw === "unknown") metadata.ip_source = "fallback";

    const { data, error } = await supabase.rpc("track_click", {
      p_referral_code: b.code,
      p_visitor_id: b.visitor_id ?? null,
      p_session_id: b.session_id ?? null,
      p_ip_hash: ipHash,
      p_ua_hash: uaHash,
      p_referrer: b.referrer ?? null,
      p_landing_url: landing,
      p_utm_source: b.utm_source ?? null,
      p_utm_medium: b.utm_medium ?? null,
      p_utm_campaign: b.utm_campaign ?? null,
      p_utm_content: b.utm_content ?? null,
      p_utm_term: b.utm_term ?? null,
      p_metadata: metadata,
    });

    if (error) {
      await auditError("track_click_rpc_error", error, { code: b.code });
      return isGet ? redirect(landing) : new Response(
        JSON.stringify({ ok: false, reason: "internal_error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (isGet) return redirect(landing);
    return new Response(
      JSON.stringify({ ok: true, result: data, landing }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    await auditError("track_referral_fatal", e);
    return isGet
      ? redirect(LANDING)
      : new Response(
        JSON.stringify({ ok: false, reason: "internal_error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
  }
});
