// utils/transactionCategorizer.ts
export type Transaction = {
  id: string;
  amount: number;
  description: string;
  type: 'income' | 'expense';
  occurred_at: string;
  category?: string;
};

// Kenyan-specific transaction patterns
const CATEGORY_KEYWORDS = {
  'Food & Dining': [
    'restaurant', 'cafe', 'food', 'kfc', 'java', 'mcdonalds', 'burger', 'pizza',
    'nakumatt', 'tuskys', 'naivas', 'quickmart', 'supermarket', 'grocery',
    'butchery', 'green grocery', 'mama mboga', 'kibanda'
  ],
  'Transport': [
    'matatu', 'bus', 'uber', 'bolt', 'taxi', 'fuel', 'petrol', 'gas',
    'car wash', 'parking', 'insurance', 'mechanic', 'tyre',
    'mpya', 'mshahara', 'stage', 'sacco'
  ],
  'Utilities': [
    'kplc', 'kenya power', 'nairobi water', 'water bill', 'electricity',
    'internet', 'safaricom', 'airtel', 'telkom', 'wifi', 'data',
    'dstv', 'gotv', 'startimes', 'tv'
  ],
  'Entertainment': [
    'netflix', 'showmax', 'youtube', 'movie', 'cinema', 'concert',
    'club', 'bar', 'alcohol', 'brew', 'theatre', 'game', 'sports'
  ],
  'Shopping': [
    'clothing', 'fashion', 'shoe', 'accessories', 'electronics',
    'phone', 'laptop', 'appliance', 'furniture', 'decor',
    'kitengela', 'mtumba', 'gikomba', 'toi'
  ],
  'Healthcare': [
    'hospital', 'clinic', 'doctor', 'pharmacy', 'medic', 'drug',
    'insurance', 'nhif', 'apa', 'mbagathi', 'kenyatta'
  ],
  'Personal Care': [
    'salon', 'barber', 'spa', 'massage', 'gym', 'fitness',
    'cosmetics', 'makeup', 'skincare', 'hair'
  ],
  'Bills': [
    'rent', 'house', 'apartment', 'landlord', 'mortgage',
    'service charge', 'maintenance', 'airtime', 'bundles'
  ],
  'Education': [
    'school', 'college', 'university', 'tuition', 'books',
    'stationery', 'exam', 'fee', 'library'
  ],
  'Savings': [
    'investment', 'sacco', 'chama', 'mpesa save', 'bank',
    'fixed deposit', 'shares', 'stocks'
  ]
};

export const categorizeTransaction = (transaction: Transaction): string => {
  const description = transaction.description.toLowerCase();
  
  // Check for exact matches first
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => description.includes(keyword.toLowerCase()))) {
      return category;
    }
  }
  
  // Amount-based categorization for M-PESA transactions
  if (transaction.description.includes('MPESA')) {
    const amount = transaction.amount;
    
    // Common M-PESA patterns in Kenya
    if (description.includes('send money') || description.includes('to') || description.includes('paid to')) {
      if (amount <= 500) return 'Food & Dining';
      if (amount <= 2000) return 'Shopping';
      if (amount <= 10000) return 'Bills';
      return 'Savings';
    }
    
    if (description.includes('buy goods') || description.includes('merchant payment')) {
      if (amount <= 1000) return 'Food & Dining';
      return 'Shopping';
    }
    
    if (description.includes('airtime') || description.includes('bundles')) {
      return 'Utilities';
    }
  }
  
  // Default categorization based on amount ranges
  if (transaction.type === 'expense') {
    if (transaction.amount <= 500) return 'Food & Dining';
    if (transaction.amount <= 2000) return 'Shopping';
    if (transaction.amount <= 5000) return 'Bills';
    return 'Savings';
  }
  
  return 'Uncategorized';
};

// Batch categorize all transactions
export const categorizeAllTransactions = (transactions: Transaction[]): Transaction[] => {
  return transactions.map(transaction => ({
    ...transaction,
    category: categorizeTransaction(transaction)
  }));
};