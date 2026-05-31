import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json(401, { error: 'Unauthorized' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Valida JWT consultando o próprio Auth com o token do chamador
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user?.id) {
      console.error('auth.getUser error', userErr);
      return json(401, { error: 'Unauthorized' });
    }
    const adminUserId = userRes.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Confirma super-admin
    const { data: isSuperData, error: isSuperErr } = await admin.rpc('is_super_admin', {
      _user_id: adminUserId,
    });
    if (isSuperErr) {
      console.error('is_super_admin rpc error', isSuperErr);
      return json(500, { error: 'Falha ao validar super-admin' });
    }
    if (!isSuperData) {
      return json(403, { error: 'Acesso restrito ao super-admin' });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Body inválido' });
    }

    const target_user_id: string | undefined = body?.target_user_id;
    const reason: string | undefined = body?.reason;
    const mode: 'view_as' | 'login_as' | undefined = body?.mode;

    if (!target_user_id || !reason || reason.trim().length < 10 || !mode) {
      return json(400, {
        error: 'target_user_id, mode e reason (min 10 chars) são obrigatórios',
      });
    }
    if (mode !== 'view_as' && mode !== 'login_as') {
      return json(400, { error: 'mode inválido' });
    }

    // Busca e-mail do alvo via Admin API
    const { data: targetUser, error: targetErr } = await admin.auth.admin.getUserById(
      target_user_id,
    );
    if (targetErr || !targetUser?.user?.email) {
      console.error('getUserById error', targetErr);
      return json(404, { error: 'Parceiro não encontrado' });
    }
    const targetEmail = targetUser.user.email;

    const ip =
      req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null;
    const ua = req.headers.get('user-agent') ?? null;

    // Registra auditoria
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
      return json(500, { error: 'Falha ao registrar auditoria' });
    }

    if (mode === 'view_as') {
      const [{ data: profile }, { data: contracts }] = await Promise.all([
        admin.from('profiles').select('*').eq('user_id', target_user_id).maybeSingle(),
        admin
          .from('partner_contracts')
          .select('*')
          .eq('user_id', target_user_id)
          .order('created_at', { ascending: false }),
      ]);
      return json(200, {
        ok: true,
        log_id: logRow.id,
        mode,
        target_email: targetEmail,
        snapshot: { profile, contracts: contracts ?? [] },
      });
    }

    // login_as → gera magic link
    const origin = req.headers.get('origin') ?? '';
    const redirectTo = `${origin}/dashboard?impersonating=${logRow.id}`;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      console.error('magic link error', linkErr);
      return json(500, { error: 'Falha ao gerar magic link' });
    }

    return json(200, {
      ok: true,
      log_id: logRow.id,
      mode,
      target_email: targetEmail,
      action_link: linkData.properties.action_link,
    });
  } catch (e) {
    console.error('impersonate exception', e);
    return json(500, { error: (e as Error).message ?? 'Erro interno' });
  }
});
