import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createMagenDeposit } from '../_shared/magen-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== MAGEN AUTH TEST - VPS PROXY ===')

    const result = await createMagenDeposit({
      amount: 1.00,
      txId: `test-vps-${Date.now()}`,
      description: 'Teste VPS MagenPay',
      payerName: 'Teste Lovable',
      payerTaxId: '12345678900',
    })

    console.log('✅ Resultado:', JSON.stringify(result))

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Erro:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
