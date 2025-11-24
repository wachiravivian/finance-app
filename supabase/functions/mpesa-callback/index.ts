// mpesa-callback/index.ts - UPDATED WITH REAL-TIME COMMUNICATION
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📞 MPESA Callback received');
    
    const body = await req.json();
    console.log('Callback body:', JSON.stringify(body, null, 2));

    const stkCallback = body.Body.stkCallback;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const merchantRequestId = stkCallback.MerchantRequestID;
    
    // Extract goal_id and user_id from MerchantRequestID (format: MER_goalId_userId_timestamp)
    let goalId = '';
    let userId = '';
    
    if (merchantRequestId && merchantRequestId.includes('_')) {
      const parts = merchantRequestId.split('_');
      if (parts.length >= 3) {
        goalId = parts[1];
        userId = parts[2];
      }
    }
    
    // Fallback: try to extract from AccountReference in metadata
    if (!goalId) {
      const callbackMetadata = stkCallback.CallbackMetadata;
      if (callbackMetadata?.Item) {
        const accountRefItem = callbackMetadata.Item.find(item => item.Name === 'AccountReference');
        if (accountRefItem && accountRefItem.Value) {
          goalId = accountRefItem.Value.replace('GOAL', '');
        }
      }
    }

    console.log(`🔄 Payment result: Code ${resultCode}, Description: ${resultDesc}, Goal: ${goalId}, User: ${userId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://qcllardftgzjnowkxdul.supabase.co';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseServiceKey) {
      console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (resultCode === 0) {
      // Payment successful
      const callbackMetadata = stkCallback.CallbackMetadata;
      const items = callbackMetadata?.Item || [];
      
      const amountItem = items.find(item => item.Name === 'Amount');
      const mpesaReceiptItem = items.find(item => item.Name === 'MpesaReceiptNumber');
      const phoneItem = items.find(item => item.Name === 'PhoneNumber');
      
      const amount = amountItem?.Value || 0;
      const mpesaReceipt = mpesaReceiptItem?.Value || 'Unknown';
      const phone = phoneItem?.Value || 'Unknown';

      console.log(`✅ Payment successful: ${mpesaReceipt}, Amount: ${amount}, Goal: ${goalId}`);

      if (goalId) {
        // Update goal in database
        const { data: goal, error: goalError } = await supabase
          .from('goals')
          .select('saved_amount, name')
          .eq('id', goalId)
          .single();

        if (goalError) {
          console.error('Error fetching goal:', goalError);
        } else {
          // Update goal with new amount
          const newAmount = (goal.saved_amount || 0) + amount;
          const { error: updateError } = await supabase
            .from('goals')
            .update({ saved_amount: newAmount })
            .eq('id', goalId);

          if (updateError) {
            console.error('Error updating goal:', updateError);
          } else {
            console.log(`✅ Goal ${goalId} updated with KES ${amount}`);
            
            // Create a real-time event for the frontend
            if (userId) {
              await supabase
                .from('goal_updates')
                .insert({
                  user_id: userId,
                  goal_id: goalId,
                  amount: amount,
                  type: 'mpesa_payment_success',
                  message: `KES ${amount} MPESA payment received for ${goal.name}`,
                  mpesa_receipt: mpesaReceipt
                });
            }
          }
        }

        // Create payment record
        const { error: paymentError } = await supabase
          .from('goal_payments')
          .insert({
            goal_id: goalId,
            amount: amount,
            mpesa_receipt: mpesaReceipt,
            phone_number: phone,
            checkout_request_id: checkoutRequestId,
            status: 'completed'
          });

        if (paymentError) {
          console.error('Error creating payment record:', paymentError);
        } else {
          console.log(`✅ Payment record created for goal ${goalId}`);
        }
      } else {
        console.error('❌ Cannot process payment: goal_id not found');
      }
    } else {
      console.log(`❌ Payment failed: ${resultDesc}`);
      
      if (goalId) {
        // Create failed payment record
        const { error: paymentError } = await supabase
          .from('goal_payments')
          .insert({
            goal_id: goalId,
            amount: 0,
            checkout_request_id: checkoutRequestId,
            status: 'failed',
            error_message: resultDesc
          });

        if (paymentError) {
          console.error('Error creating failed payment record:', paymentError);
        }
        
        // Create failed payment event
        if (userId) {
          await supabase
            .from('goal_updates')
            .insert({
              user_id: userId,
              goal_id: goalId,
              amount: 0,
              type: 'mpesa_payment_failed',
              message: `Payment failed: ${resultDesc}`,
              error_message: resultDesc
            });
        }
      }
    }

    // Always return success to MPESA
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 Callback error:', error);
    
    // Still return success to MPESA
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});