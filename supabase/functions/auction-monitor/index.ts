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
    console.log('🔍 [AUCTION-MONITOR] Iniciando verificação de leilões inativos');
    
    // Chamar a função do banco para verificar e finalizar leilões
    const { error } = await supabase.rpc('auto_finalize_inactive_auctions');
    
    if (error) {
      console.error('❌ [AUCTION-MONITOR] Erro ao executar função:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ [AUCTION-MONITOR] Verificação concluída com sucesso');
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Monitoramento executado com sucesso',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 [AUCTION-MONITOR] Erro geral:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Erro interno'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})