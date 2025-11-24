// health-check/index.ts - SIMPLE WORKING FUNCTION
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      }
    })
  }

  try {
    console.log('🏥 Health check function called');
    
    // Always return success
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Health check passed!',
        timestamp: new Date().toISOString(),
        status: 'healthy'
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error) {
    console.error('Health check error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Health check failed',
        message: error.message
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
})