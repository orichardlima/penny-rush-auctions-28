import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Auth client to validate user
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const sponsorUserId = claimsData.claims.sub as string;

    // Service client for all operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { referredEmail, planId } = await req.json();

    if (!referredEmail || !planId) {
      return new Response(JSON.stringify({ error: 'Email do indicado e plano são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Fetch the plan
    const { data: plan, error: planError } = await adminClient
      .from('partner_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: 'Plano não encontrado ou inativo' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Fetch sponsor's ACTIVE contract
    const { data: sponsorContract, error: sponsorError } = await adminClient
      .from('partner_contracts')
      .select('*')
      .eq('user_id', sponsorUserId)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle();

    if (sponsorError) throw sponsorError;

    if (!sponsorContract) {
      return new Response(JSON.stringify({ error: 'Você não possui um contrato ativo' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Check balance (using cents to avoid floating point issues)
    const balanceCents = Math.round(sponsorContract.available_balance * 100);
    const aporteCents = Math.round(plan.aporte_value * 100);

    if (balanceCents < aporteCents) {
      return new Response(JSON.stringify({ error: `Saldo insuficiente. Disponível: R$ ${sponsorContract.available_balance.toFixed(2)}, Necessário: R$ ${plan.aporte_value.toFixed(2)}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Find referred user by email
    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers();
    if (usersError) throw usersError;

    const referredUser = users?.find((u: any) => u.email?.toLowerCase() === referredEmail.toLowerCase());
    if (!referredUser) {
      return new Response(JSON.stringify({ error: 'Usuário indicado não encontrado. Ele precisa estar cadastrado na plataforma.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. Cannot activate yourself
    if (referredUser.id === sponsorUserId) {
      return new Response(JSON.stringify({ error: 'Você não pode ativar seu próprio contrato' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5b. Determine the actual referrer (who referred the user, not who is paying)
    // Priority: 1) Existing intent with referred_by_user_id, 2) Previous contract. Payer is NEVER the referrer.
    let actualReferrerId: string | null = null;

    // Check partner_payment_intents for a previous referral link
    const { data: previousIntent } = await adminClient
      .from('partner_payment_intents')
      .select('referred_by_user_id')
      .eq('user_id', referredUser.id)
      .not('referred_by_user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousIntent?.referred_by_user_id) {
      actualReferrerId = previousIntent.referred_by_user_id;
    } else {
      // Check previous contracts (SUSPENDED/CLOSED) for referral info
      const { data: previousContract } = await adminClient
        .from('partner_contracts')
        .select('referred_by_user_id')
        .eq('user_id', referredUser.id)
        .not('referred_by_user_id', 'is', null)
        .in('status', ['SUSPENDED', 'CLOSED'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousContract?.referred_by_user_id) {
        actualReferrerId = previousContract.referred_by_user_id;
      }
    }

    // 6. Check if referred already has ACTIVE contract
    const { data: existingContract } = await adminClient
      .from('partner_contracts')
      .select('id')
      .eq('user_id', referredUser.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (existingContract) {
      return new Response(JSON.stringify({ error: 'O indicado já possui um contrato ativo' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 7. Generate unique referral code
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let referralCode = generateCode();
    // Ensure uniqueness
    let codeExists = true;
    let attempts = 0;
    while (codeExists && attempts < 10) {
      const { data: existing } = await adminClient
        .from('partner_contracts')
        .select('id')
        .eq('referral_code', referralCode)
        .maybeSingle();
      if (!existing) {
        codeExists = false;
      } else {
        referralCode = generateCode();
        attempts++;
      }
    }

    // 8. Debit sponsor balance
    const newBalance = sponsorContract.available_balance - plan.aporte_value;
    const { error: debitError } = await adminClient
      .from('partner_contracts')
      .update({ available_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', sponsorContract.id);

    if (debitError) throw debitError;

    // 9. Create ACTIVE contract for referred
    const { data: newContract, error: createError } = await adminClient
      .from('partner_contracts')
      .insert({
        user_id: referredUser.id,
        plan_name: plan.name,
        aporte_value: plan.aporte_value,
        weekly_cap: plan.weekly_cap,
        total_cap: plan.total_cap,
        status: 'ACTIVE',
        referred_by_user_id: actualReferrerId,
        referral_code: referralCode,
        payment_status: 'completed',
        bonus_bids_received: plan.bonus_bids || 0,
      })
      .select()
      .single();

    if (createError) {
      // Rollback: restore sponsor balance
      await adminClient
        .from('partner_contracts')
        .update({ available_balance: sponsorContract.available_balance })
        .eq('id', sponsorContract.id);
      throw createError;
    }

    // 10. Credit bonus bids to referred user profile
    if (plan.bonus_bids && plan.bonus_bids > 0) {
      const { data: referredProfile } = await adminClient
        .from('profiles')
        .select('bids_balance')
        .eq('user_id', referredUser.id)
        .single();

      if (referredProfile) {
        await adminClient
          .from('profiles')
          .update({ bids_balance: (referredProfile.bids_balance || 0) + plan.bonus_bids })
          .eq('user_id', referredUser.id);
      }
    }

    // 11. Audit log in partner_manual_credits
    await adminClient
      .from('partner_manual_credits')
      .insert({
        partner_contract_id: sponsorContract.id,
        amount: -plan.aporte_value,
        credit_type: 'sponsor_activation',
        description: `Ativação do parceiro ${referredEmail} - Plano ${plan.display_name}`,
        created_by: sponsorUserId,
        consumes_cap: false,
      });

    return new Response(JSON.stringify({
      success: true,
      message: `Parceiro ${referredEmail} ativado com sucesso no plano ${plan.display_name}!`,
      newBalance,
      contractId: newContract.id,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('sponsor-activate-partner error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
