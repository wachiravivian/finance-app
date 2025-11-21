// mpesa-stk-goal/index.ts - SIMPLIFIED WORKING VERSION
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Received request:', body)

    const { phone, amount, goal_id } = body

    // Basic validation
    if (!phone || !amount || !goal_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: phone, amount, goal_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get MPESA credentials from environment
    const consumerKey = Deno.env.get('DARAJA_CONSUMER_KEY')
    const consumerSecret = Deno.env.get('DARAJA_CONSUMER_SECRET')
    const shortcode = Deno.env.get('DARAJA_SHORTCODE')
    const passkey = Deno.env.get('DARAJA_PASSKEY')

    if (!consumerKey || !consumerSecret) {
      console.error('Missing MPESA credentials')
      return new Response(
        JSON.stringify({ error: 'MPESA credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Environment variables loaded successfully')

    // Get MPESA access token
    const auth = btoa(`${consumerKey}:${consumerSecret}`)
    const tokenResponse = await fetch(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { 
        headers: { 
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json'
        } 
      }
    )

    console.log('Token response status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token request failed:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get MPESA access token',
          details: errorText
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error('No access token in response:', tokenData)
      return new Response(
        JSON.stringify({ 
          error: 'No access token received from MPESA',
          details: tokenData
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully obtained access token')

    // For now, return success without making STK push
    // This helps us verify the function is working
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Function is working! Ready for STK push.',
        received_data: { phone, amount, goal_id },
        token_obtained: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Function execution failed',
        message: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})