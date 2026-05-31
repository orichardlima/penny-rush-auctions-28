import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validar JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const adminUserId = claims.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);

    // Confirmar super-admin
    const { data: isSuperData } = await admin.rpc('is_super_admin', { _user_id: adminUserId });
    if (!isSuperData) {
      return new Response(JSON.stringify({ error: 'Acesso restrito ao super-admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { target_user_id, reason, mode } = body as {
      target_user_id?: string; reason?: string; mode?: 'view_as' | 'login_as';
    };

    if (!target_user_id || !reason || reason.trim().length < 10 || !mode) {
      return new Response(
        JSON.stringify({ error: 'target_user_id, mode e reason (min 10 chars) são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode !== 'view_as' && mode !== 'login_as') {
      return new Response(JSON.stringify({ error: 'mode inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar e-mail do alvo
    const { data: targetUser, error: targetErr } = await admin.auth.admin.getUserById(target_user_id);
    if (targetErr || !targetUser?.user?.email) {
      return new Response(JSON.stringify({ error: 'Parceiro não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const targetEmail = targetUser.user.email;

    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null;
    const ua = req.headers.get('user-agent') ?? null;

    // Registrar no log de auditoria
    const { data: logRow, error: logErr } = await admin
      .from('admin_impersonation_log')
      .insert({
        admin_user_id: adminUserId,
        target_user_id,
        target_email: targetEmail,
        mode,
        reason: reason.trim(),
        ip_address: ip,
        user_agent: ua,
      })
      .select('id')
      .single();
    if (logErr) {
      console.error('log insert error', logErr);
      return new Response(JSON.stringify({ error: 'Falha ao registrar auditoria' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (mode === 'view_as') {
      // Retorna snapshot mínimo (perfil + contratos + saldo)
      const [{ data: profile }, { data: contracts }] = await Promise.all([
        admin.from('profiles').select('*').eq('user_id', target_user_id).single(),
        admin.from('partner_contracts').select('*').eq('user_id', target_user_id).order('created_at', { ascending: false }),
      ]);
      return new Response(JSON.stringify({
        ok: true, log_id: logRow.id, mode, target_email: targetEmail,
        snapshot: { profile, contracts }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // login_as → gerar magic link
    const origin = req.headers.get('origin') ?? '';
    const redirectTo = `${origin}/dashboard?impersonating=${logRow.id}`;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      console.error('magic link error', linkErr);
      return new Response(JSON.stringify({ error: 'Falha ao gerar magic link' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true, log_id: logRow.id, mode,
      target_email: targetEmail,
      action_link: linkData.properties.action_link,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
