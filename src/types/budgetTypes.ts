// types/budgetTypes.ts
export type BudgetRow = {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  month: string;
  created_at: string;
};

export type SpendByCategory = Record<string, number>;

export type FinancialHealthScore = {
  score: number;
  category: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  insights: string[];
  recommendations: string[];
};

export type BehavioralInsight = {
  type: 'overspending' | 'accelerated' | 'healthy';
  message: string;
  suggestion: string;
};

export type FinancialChallenge = {
  id: string;
  title: string;
  description: string;
  reward: string;
  progress: number;
  target: number;
  type: 'behavioral' | 'savings' | 'education';
};

export type EducationTip = {
  icon: string;
  title: string;
  message: string;
  type: 'warning' | 'action' | 'education';
};

export type PredictiveInsight = {
  category: string;
  projectedOverspend: number;
  confidence: 'high' | 'medium' | 'low';
  suggestion: string;
};