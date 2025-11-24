// supabase/functions/admin-finance-report/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all transactions for financial summary
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('amount, direction')
      .limit(1000);

    if (txError) {
      console.error('Transaction error:', txError);
    }

    // Calculate totals
    const totalIncome = transactions
      ?.filter(t => t.direction === 'credit')
      .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    const totalExpenses = transactions
      ?.filter(t => t.direction === 'debit')
      .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    // Get budgets by category
    const { data: budgets, error: budgetError } = await supabaseAdmin
      .from('budgets')
      .select('category, amount');

    const budgetsByCategory: Record<string, number> = {};
    if (budgets) {
      budgets.forEach(budget => {
        budgetsByCategory[budget.category] = (budgetsByCategory[budget.category] || 0) + (budget.amount || 0);
      });
    }

    // Get goals progress
    const { data: goals, error: goalError } = await supabaseAdmin
      .from('goals')
      .select('current_amount, target_amount');

    const goalsProgress = { lt50: 0, btw50_80: 0, gte80: 0, achieved: 0 };
    if (goals) {
      goals.forEach(goal => {
        const progress = (goal.current_amount / goal.target_amount) * 100;
        if (progress >= 100) goalsProgress.achieved++;
        else if (progress >= 80) goalsProgress.gte80++;
        else if (progress >= 50) goalsProgress.btw50_80++;
        else goalsProgress.lt50++;
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        totalIncome,
        totalExpenses,
        budgetsByCategory,
        goalsProgress
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error in admin-finance-report:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        totalIncome: 0,
        totalExpenses: 0,
        budgetsByCategory: {},
        goalsProgress: { lt50: 0, btw50_80: 0, gte80: 0, achieved: 0 }
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});