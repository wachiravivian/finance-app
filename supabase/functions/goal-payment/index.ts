// goal-payment/index.ts - SIMPLIFIED DEBUG VERSION
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders
    })
  }

  try {
    console.log('🎯 Goal Payment Function called - DEBUG VERSION');

    const body = await req.json();
    console.log('📦 Request body:', body);

    const { phone, amount, goal_id, user_id } = body;

    // Check environment variables
    const consumerKey = Deno.env.get('DARAJA_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('DARAJA_CONSUMER_SECRET');
    
    console.log('🔑 Environment variables:', {
      consumerKey: consumerKey ? 'SET' : 'MISSING',
      consumerSecret: consumerSecret ? 'SET' : 'MISSING',
    });

    if (!consumerKey || !consumerSecret) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'MPESA credentials not configured',
          details: 'Please set DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET in environment variables'
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Simulate successful MPESA response for testing
    console.log('✅ Simulating MPESA STK push (debug mode)');
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'MPESA STK push simulated successfully',
        checkout_request_id: 'ws_CO_Debug_' + Date.now(),
        merchant_request_id: 'MER_Debug_' + Date.now(),
        customer_message: 'Success. Request accepted for processing',
        response_code: '0',
        debug: {
          phone,
          amount,
          goal_id,
          user_id,
          environment: 'debug-simulation',
          timestamp: new Date().toISOString()
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
        error: 'Function execution failed',
        message: error.message,
        stack: error.stack
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});