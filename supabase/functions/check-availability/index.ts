import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, cpf } = await req.json()

    let emailExists = false
    let cpfExists = false

    // Check email availability (check auth.users)
    if (email) {
      const { data: authUser } = await supabaseClient.auth.admin.getUserByEmail(email)
      emailExists = !!authUser.user
    }

    // Check CPF availability (check profiles table)
    if (cpf) {
      const cleanCPF = cpf.replace(/\D/g, '')
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('cpf', cleanCPF)
        .single()
      
      cpfExists = !!profile
    }

    return new Response(
      JSON.stringify({
        email: {
          value: email,
          available: !emailExists,
          exists: emailExists
        },
        cpf: {
          value: cpf,
          available: !cpfExists,
          exists: cpfExists
        }
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error checking availability:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})