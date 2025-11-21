import { supabase } from '../supabaseClient';

// Types
export interface LocalPayment {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string;
  created_at?: string;
  user_id?: string;
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
  spent: number;
  created_at?: string;
  user_id?: string;
}

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  deadline?: string;
  created_at?: string;
  user_id?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  last_four?: string;
  created_at?: string;
  user_id?: string;
}

export interface TransactionStats {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  categories: Array<{ category: string; total: number }>;
}

// Transaction functions
export const addTransaction = async (transaction: Omit<LocalPayment, 'id' | 'created_at' | 'user_id'>): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .insert([
        {
          ...transaction,
          user_id: user.id
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
};

export const getTransactions = async (): Promise<LocalPayment[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
};

export const deleteTransaction = async (id: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }
};

export const getTransactionStats = async (): Promise<TransactionStats> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;

    const stats: TransactionStats = {
      totalIncome: 0,
      totalExpenses: 0,
      net: 0,
      categories: []
    };

    const categoryTotals: { [key: string]: number } = {};

    transactions?.forEach(transaction => {
      if (transaction.type === 'income') {
        stats.totalIncome += transaction.amount;
      } else {
        stats.totalExpenses += transaction.amount;
        
        if (!categoryTotals[transaction.category]) {
          categoryTotals[transaction.category] = 0;
        }
        categoryTotals[transaction.category] += transaction.amount;
      }
    });

    stats.net = stats.totalIncome - stats.totalExpenses;
    stats.categories = Object.entries(categoryTotals).map(([category, total]) => ({
      category,
      total
    }));

    return stats;
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    throw error;
  }
};

// Budget functions
export const addBudget = async (budget: Omit<Budget, 'id' | 'created_at' | 'user_id'>): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('budgets')
      .insert([
        {
          ...budget,
          user_id: user.id
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error adding budget:', error);
    throw error;
  }
};

export const getBudgets = async (): Promise<Budget[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching budgets:', error);
    throw error;
  }
};

export const updateBudgetSpent = async (id: string, spent: number): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('budgets')
      .update({ spent })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating budget:', error);
    throw error;
  }
};

// Goal functions
export const addGoal = async (goal: Omit<Goal, 'id' | 'created_at' | 'user_id'>): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('goals')
      .insert([
        {
          ...goal,
          user_id: user.id
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error adding goal:', error);
    throw error;
  }
};

export const getGoals = async (): Promise<Goal[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching goals:', error);
    throw error;
  }
};

export const updateGoalProgress = async (id: string, saved_amount: number): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('goals')
      .update({ saved_amount })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating goal:', error);
    throw error;
  }
};

// Payment method functions
export const addPaymentMethod = async (paymentMethod: Omit<PaymentMethod, 'id' | 'created_at' | 'user_id'>): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('payment_methods')
      .insert([
        {
          ...paymentMethod,
          user_id: user.id
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error adding payment method:', error);
    throw error;
  }
};

export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    throw error;
  }
};

// Utility functions (unchanged)
export const calculateTotalAmount = (payments: LocalPayment[]): number => {
  return payments.reduce((sum: number, payment: LocalPayment) => {
    if (payment.type === 'income') {
      return sum + payment.amount;
    } else {
      return sum - payment.amount;
    }
  }, 0);
};

export const filterPaymentsByType = (payments: LocalPayment[], type: 'income' | 'expense'): LocalPayment[] => {
  return payments.filter((payment: LocalPayment) => payment.type === type);
};

export const filterPaymentsByCategory = (payments: LocalPayment[], category: string): LocalPayment[] => {
  return payments.filter((payment: LocalPayment) => payment.category === category);
};

export const getCategoriesFromPayments = (payments: LocalPayment[]): string[] => {
  const categories = payments.map((payment: LocalPayment) => payment.category);
  return Array.from(new Set(categories));
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};