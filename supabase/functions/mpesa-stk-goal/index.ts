// mpesa-stk-goal/index.ts - UPDATED WITH MPESA_ VARIABLE NAMES
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// MPESA Daraja API Configuration
const MPESA_BASE_URL = 'https://sandbox.safaricom.co.ke' // Use this for testing
// const MPESA_BASE_URL = 'https://api.safaricom.co.ke' // Use this for production

serve(async (req) => {
  console.log('🎯 MPESA STK Function called - UPDATED VERSION');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const body = await req.json();
    console.log('📦 Request body:', body);

    const { phone, amount, goal_id, user_id } = body;

    // Validate required fields
    if (!phone || !amount || !goal_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required fields: phone, amount, goal_id'
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check environment variables - UPDATED TO MPESA_ PREFIX
    const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET');
    const passkey = Deno.env.get('MPESA_PASSKEY');
    const shortcode = Deno.env.get('MPESA_SHORTCODE') || '174379'; // Default sandbox shortcode

    console.log('🔑 Environment variables check:', {
      consumerKey: consumerKey ? 'SET' : 'MISSING',
      consumerSecret: consumerSecret ? 'SET' : 'MISSING',
      passkey: passkey ? 'SET' : 'MISSING',
      shortcode: shortcode
    });

    if (!consumerKey || !consumerSecret || !passkey) {
      console.error('❌ Missing MPESA credentials');
      
      // Return simulation mode if credentials missing
      console.log('🎭 Running in SIMULATION MODE (credentials missing)');
      const mockResponse = {
        success: true,
        message: 'MPESA STK push initiated successfully (SIMULATION MODE)',
        checkout_request_id: 'ws_CO_Sim_' + Date.now(),
        merchant_request_id: 'MER_Sim_' + Date.now(),
        customer_message: 'Success. Request accepted for processing',
        response_code: '0',
        debug: {
          phone: phone,
          amount: Number(amount),
          goal_id: goal_id,
          user_id: user_id,
          timestamp: new Date().toISOString(),
          environment: 'simulation-mode',
          note: 'MPESA credentials not configured. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, and MPESA_PASSKEY for real payments.'
        }
      };

      return new Response(
        JSON.stringify(mockResponse),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ All credentials found, proceeding with REAL MPESA API...');

    // Step 1: Get MPESA Access Token
    console.log('🔐 Getting MPESA access token...');
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    
    const tokenResponse = await fetch(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      }
    });

    console.log('🔐 Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Failed to get access token:', errorText);
      throw new Error(`MPESA authentication failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('No access token received from MPESA');
    }

    console.log('✅ Access token received successfully');

    // Step 2: Prepare STK Push request
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, -3);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // Format phone number to MPESA format (254...)
    const formattedPhone = phone.replace(/\D/g, '');
    let recipientPhone = formattedPhone;
    
    if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
      recipientPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('7') && formattedPhone.length === 9) {
      recipientPhone = '254' + formattedPhone;
    }

    console.log('📱 Formatted phone:', recipientPhone);
    // Generate a unique merchant request ID that includes goal_id and user_id
const timestamp = Date.now();
const merchantRequestId = `MER_${goal_id}_${user_id}_${timestamp}`;

    const stkPayload = {
  BusinessShortCode: shortcode,
  Password: password,
  Timestamp: timestamp,
  TransactionType: 'CustomerPayBillOnline',
  Amount: Math.floor(Number(amount)),
  PartyA: recipientPhone,
  PartyB: shortcode,
  PhoneNumber: recipientPhone,
  CallBackURL: 'https://qcllardftgzjnowkxdul.supabase.co/functions/v1/mpesa-callback',
  AccountReference: `GOAL${goal_id.substring(0, 8)}`,
  TransactionDesc: `Savings ${goal_id.substring(0, 6)}`,
  MerchantRequestID: merchantRequestId // Add this line
};

    console.log('📤 STK Payload:', stkPayload);

    // Step 3: Initiate STK Push
    console.log('🚀 Initiating REAL STK push...');
    const stkResponse = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkPayload)
    });

    console.log('📡 STK Response status:', stkResponse.status);
    
    const stkResult = await stkResponse.json();
    console.log('📡 STK Response:', stkResult);

    if (!stkResponse.ok) {
      console.error('❌ STK push failed:', stkResult);
      throw new Error(stkResult.errorMessage || `STK push failed: ${JSON.stringify(stkResult)}`);
    }

    if (stkResult.ResponseCode && stkResult.ResponseCode !== '0') {
      throw new Error(stkResult.ResponseDescription || `MPESA error: ${stkResult.ResponseCode}`);
    }

    console.log('✅ REAL STK push initiated successfully');

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'MPESA STK push initiated successfully',
        checkout_request_id: stkResult.CheckoutRequestID,
        merchant_request_id: stkResult.MerchantRequestID,
        customer_message: stkResult.CustomerMessage,
        response_code: stkResult.ResponseCode,
        response_description: stkResult.ResponseDescription,
        debug: {
          phone: recipientPhone,
          amount: Number(amount),
          goal_id,
          user_id,
          timestamp: new Date().toISOString(),
          environment: 'real-mpesa'
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 Function error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Payment processing failed',
        message: error.message,
        details: 'Please check your MPESA credentials and try again'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});