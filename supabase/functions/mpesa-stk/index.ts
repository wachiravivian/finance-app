// mpesa-stk/index.ts - COMPLETE STK FUNCTION
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
    console.log('Received STK request:', body)

    const { phone, amount, goal_id } = body

    // Basic validation
    if (!phone || !amount || !goal_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: phone, amount, goal_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get MPESA credentials
    const consumerKey = Deno.env.get('DARAJA_CONSUMER_KEY')
    const consumerSecret = Deno.env.get('DARAJA_CONSUMER_SECRET')
    const shortcode = Deno.env.get('DARAJA_SHORTCODE')
    const passkey = Deno.env.get('DARAJA_PASSKEY')
    const callbackUrl = Deno.env.get('MPESA_CALLBACK_URL')

    if (!consumerKey || !consumerSecret) {
      return new Response(
        JSON.stringify({ error: 'MPESA credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get MPESA access token
    const auth = btoa(`${consumerKey}:${consumerSecret}`)
    const tokenResponse = await fetch(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { 
        headers: { 
          Authorization: `Basic ${auth}`,
        } 
      }
    )

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token request failed:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get MPESA token',
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

    // Prepare STK push
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .split('.')[0]
      .replace('T', '')
    
    const password = btoa(`${shortcode}${passkey}${timestamp}`)

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl || "https://qcllardftgzjnowkxdul.functions.supabase.co/mpesa-callback",
      AccountReference: `GOAL-${goal_id}`,
      TransactionDesc: `Goal ${goal_id}`,
    }

    console.log('Sending STK push to MPESA:', stkPayload)

    // Send STK push
    const stkResponse = await fetch(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stkPayload),
      }
    )

    const result = await stkResponse.json()
    console.log('MPESA STK response:', result)

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('STK function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Function execution failed',
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})