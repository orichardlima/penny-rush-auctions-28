import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    console.log(`🚀 Calling webhook for auction: ${auction_id}`)

    // Call the external webhook
    const webhookResponse = await fetch('https://automacao.rodolphoalmeida.dev.br/webhook/robot_leilao', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auction_id: auction_id
      })
    })

    if (webhookResponse.ok) {
      console.log(`✅ Webhook called successfully for auction: ${auction_id}`)
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Webhook called successfully',
        auction_id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      const errorText = await webhookResponse.text()
      console.error(`❌ Webhook failed for auction ${auction_id}: ${webhookResponse.status} - ${errorText}`)
      
      // Don't fail the original request, just log the error
      return new Response(JSON.stringify({ 
        success: false, 
        message: `Webhook failed: ${webhookResponse.status}`,
        auction_id,
        error: errorText
      }), {
        status: 200, // Return 200 so the trigger doesn't retry infinitely
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('Error in auction-webhook function:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 200, // Return 200 so the trigger doesn't retry infinitely
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})