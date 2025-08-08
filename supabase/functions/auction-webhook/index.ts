import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl!, serviceRoleKey!);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { auction_id } = await req.json()
    
    if (!auction_id) {
      console.error('Missing auction_id in webhook call')
      return new Response(JSON.stringify({ error: 'Missing auction_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const correlation_id = crypto.randomUUID();
    console.log(`🚀 [${correlation_id}] Calling webhook for auction: ${auction_id}`)

    // Call the external webhook
    const webhookResponse = await fetch('https://automacao.rodolphoalmeida.dev.br/webhook/robot_leilao', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ auction_id })
    })

    const status = webhookResponse.status;
    let responseText = '';
    try {
      responseText = await webhookResponse.text();
    } catch (_) {}

    // Log outcome to DB (non-blocking best-effort)
    try {
      const { error: logError } = await supabase.from('bot_webhook_logs').insert({
        auction_id,
        correlation_id,
        status: webhookResponse.ok ? 'success' : 'error',
        http_status: status,
        response_body: responseText?.slice(0, 4000) || null,
        error: webhookResponse.ok ? null : responseText?.slice(0, 4000) || null,
      });
      if (logError) console.error(`[${correlation_id}] Failed to insert webhook log:`, logError);
    } catch (e) {
      console.error(`[${correlation_id}] Exception while inserting webhook log:`, e);
    }

    if (webhookResponse.ok) {
      console.log(`✅ [${correlation_id}] Webhook called successfully for auction: ${auction_id}`)
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Webhook called successfully',
        auction_id,
        correlation_id,
        http_status: status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      console.error(`❌ [${correlation_id}] Webhook failed for auction ${auction_id}: ${status} - ${responseText}`)
      // Return 200 so upstream triggers don't retry indefinitely
      return new Response(JSON.stringify({ 
        success: false, 
        message: `Webhook failed: ${status}`,
        auction_id,
        correlation_id,
        error: responseText
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (error: any) {
    console.error('Error in auction-webhook function:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Unexpected error'
    }), {
      status: 200, // Return 200 so the trigger doesn't retry infinitely
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})