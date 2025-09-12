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
    console.log('Checking availability for:', { email: !!email, cpf: !!cpf })

    let emailExists = false
    let cpfExists = false

    // Check email availability (check profiles table first, then try auth)
    if (email) {
      try {
        // First check profiles table for email
        const { data: profileByEmail, error: emailError } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle()
        
        if (emailError) {
          console.error('Email query error:', emailError)
        }
        
        emailExists = !!profileByEmail
        console.log('Email exists in profiles:', emailExists)
        
        // If not found in profiles, check if email is taken by checking auth users
        if (!emailExists) {
          const { data: authData } = await supabaseClient.auth.admin.listUsers()
          emailExists = authData.users.some(user => user.email === email)
          console.log('Email exists in auth:', emailExists)
        }
      } catch (error) {
        console.error('Error checking email:', error)
        emailExists = false
      }
    }

    // Check CPF availability (check profiles table)
    if (cpf) {
      try {
        const cleanCPF = cpf.replace(/\D/g, '')
        console.log('Checking CPF (clean):', cleanCPF)
        console.log('Checking CPF (original):', cpf)
        
        // Buscar tanto CPF formatado quanto não formatado
        const { data: profiles, error: cpfError } = await supabaseClient
          .from('profiles')
          .select('id, cpf')
          .or(`cpf.eq.${cleanCPF},cpf.eq.${cpf}`)
        
        if (cpfError) {
          console.error('CPF query error:', cpfError)
        }
        
        cpfExists = !!(profiles && profiles.length > 0)
        console.log('CPF exists:', cpfExists, 'Profiles found:', profiles?.length || 0)
        if (profiles && profiles.length > 0) {
          console.log('Found CPFs:', profiles.map(p => p.cpf))
        }
      } catch (error) {
        console.error('Error checking CPF:', error)
        cpfExists = false
      }
    }

    const result = {
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
    }

    console.log('Result:', result)

    return new Response(
      JSON.stringify(result),
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
      JSON.stringify({ error: 'Internal server error', details: error.message }),
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