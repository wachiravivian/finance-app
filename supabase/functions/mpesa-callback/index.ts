// mpesa-callback/index.ts 
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("🎯 MPESA Callback Received:", JSON.stringify(payload, null, 2));

    const stkCallback = payload?.Body?.stkCallback;
    const resultCode = stkCallback?.ResultCode;
    const resultDesc = stkCallback?.ResultDesc;
    const metadata = stkCallback?.CallbackMetadata?.Item || [];
    const checkoutRequestId = stkCallback?.CheckoutRequestID;
    const merchantRequestId = stkCallback?.MerchantRequestID;

    console.log("📊 Callback Details:", { 
      resultCode, 
      resultDesc, 
      checkoutRequestId, 
      merchantRequestId 
    });

    // Helper to extract values from metadata
    const getValue = (name: string) => {
      const item = metadata.find((item: any) => item.Name === name);
      return item?.Value;
    };

    // If payment failed
    if (resultCode !== 0) {
      console.log("❌ Payment failed:", { resultCode, resultDesc });
      
      // Update payment status to FAILED
      if (checkoutRequestId) {
        const { error } = await supabase
          .from('payments')
          .update({ 
            status: 'FAILED',
            result_code: resultCode?.toString(),
            result_desc: resultDesc,
            updated_at: new Date().toISOString()
          })
          .eq('checkout_request_id', checkoutRequestId);

        if (error) {
          console.error("Error updating failed payment:", error);
        } else {
          console.log("✅ Updated payment status to FAILED");
        }
      }

      return new Response(JSON.stringify({ 
        ResultCode: 0, 
        ResultDesc: "Success" 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Payment successful - extract details
    const amount = getValue("Amount");
    const phone = String(getValue("PhoneNumber") || "");
    const mpesaReceipt = getValue("MpesaReceiptNumber");
    const transactionDate = getValue("TransactionDate");

    console.log("✅ Payment Success Details:", { 
      amount, phone, mpesaReceipt, transactionDate, checkoutRequestId 
    });

    if (!amount || !mpesaReceipt) {
      console.error("❌ Missing amount or receipt in callback");
      return new Response(JSON.stringify({ 
        ResultCode: 1, 
        ResultDesc: "Missing payment details" 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Find and update the payment record
    let payment = null;
    let userId = null;
    let goalId = null;

    if (checkoutRequestId) {
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('checkout_request_id', checkoutRequestId)
        .single();

      if (paymentError) {
        console.error("❌ Error finding payment:", paymentError);
      } else if (paymentData) {
        payment = paymentData;
        userId = paymentData.user_id;
        
        // Extract goal ID from client_tx_id
        if (paymentData.client_tx_id) {
          const goalMatch = paymentData.client_tx_id.match(/goal-([a-zA-Z0-9_-]+)/);
          goalId = goalMatch ? goalMatch[1] : null;
          console.log("🎯 Extracted goal ID from payment:", goalId);
        }
        
        // Update payment status to SUCCESS
        const { error: updateError } = await supabase
          .from('payments')
          .update({ 
            status: 'SUCCESS',
            result_code: resultCode?.toString(),
            result_desc: resultDesc,
            mpesa_receipt: mpesaReceipt,
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.id);

        if (updateError) {
          console.error("❌ Error updating payment:", updateError);
        } else {
          console.log("✅ Updated payment status to SUCCESS");
        }
      } else {
        console.log("⚠️ No payment record found for checkout ID:", checkoutRequestId);
      }
    }

    // 2. Create transaction record
    console.log("💾 Creating transaction record...");
    const transaction = await createTransaction(userId, phone, amount, mpesaReceipt, goalId);

    // 3. Update goal amount if we have a goal ID
    if (goalId && amount) {
      console.log("🎯 Updating goal amount...");
      await updateGoalAmount(goalId, amount);
    } else {
      console.log("⚠️ No goal ID found, skipping goal update");
    }

    console.log("🎉 Successfully processed payment callback!");

    return new Response(JSON.stringify({ 
      ResultCode: 0, 
      ResultDesc: "Success" 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("💥 Callback error:", error);
    return new Response(JSON.stringify({ 
      ResultCode: 1, 
      ResultDesc: "Error processing callback" 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper function to create transaction
async function createTransaction(userId: string | null, phone: string, amount: number, mpesaReceipt: string, goalId: string | null = null) {
  try {
    const transactionData: any = {
      amount: amount,
      phone: phone,
      mpesa_receipt: mpesaReceipt,
      status: 'completed',
      type: 'contribution',
      source: 'mpesa',
      description: goalId ? `Contribution to goal ${goalId}` : `MPESA payment from ${phone}`,
      created_at: new Date().toISOString()
    };

    if (userId) {
      transactionData.user_id = userId;
    }

    if (goalId) {
      transactionData.goal_id = goalId;
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating transaction:", error);
      // Try without user_id if that's the issue
      delete transactionData.user_id;
      
      const { data: retryData, error: retryError } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (retryError) {
        console.error("❌ Retry also failed:", retryError);
      } else {
        console.log("✅ Transaction created on retry:", retryData.id);
        return retryData;
      }
    } else {
      console.log("✅ Transaction created successfully:", data.id);
      return data;
    }
  } catch (error) {
    console.error("💥 Error in createTransaction:", error);
  }
  return null;
}

// Helper function to update goal amount
async function updateGoalAmount(goalId: string, amount: number) {
  try {
    // First get current goal
    const { data: goal, error: goalError } = await supabase
      .from('goals')
      .select('current_amount, target_amount, name, status')
      .eq('id', goalId)
      .single();

    if (goalError) {
      console.error("❌ Error fetching goal:", goalError);
      return;
    }

    if (goal) {
      const currentAmount = goal.current_amount || 0;
      const newAmount = currentAmount + amount;
      
      console.log(`🎯 Updating goal ${goalId}: ${currentAmount} + ${amount} = ${newAmount}`);

      // Update goal current amount
      const { error: updateError } = await supabase
        .from('goals')
        .update({ 
          current_amount: newAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', goalId);

      if (updateError) {
        console.error("❌ Error updating goal:", updateError);
      } else {
        console.log(`✅ Goal ${goalId} (${goal.name}) updated successfully`);
        
        // Check if goal is completed
        if (goal.status !== 'completed' && newAmount >= goal.target_amount) {
          await supabase
            .from('goals')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', goalId);
          console.log(`🎉 Goal ${goalId} marked as completed!`);
        }
      }
    } else {
      console.log(`⚠️ Goal ${goalId} not found`);
    }
  } catch (error) {
    console.error("💥 Error in updateGoalAmount:", error);
  }
}