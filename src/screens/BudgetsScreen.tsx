// screens/BudgetsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
} from "react-native";
import { supabase } from "../supabaseClient";
import { colors, spacing, radius } from "../constants/styles";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width: screenWidth } = Dimensions.get('window');

// Types
type BudgetRow = {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  month: string;
  created_at: string;
};

type SpendByCategory = Record<string, number>;

type FinancialHealthScore = {
  score: number;
  category: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  insights: string[];
  recommendations: string[];
};

type BehavioralInsight = {
  type: 'overspending' | 'accelerated' | 'healthy' | 'warning';
  message: string;
  suggestion: string;
};

type FinancialChallenge = {
  id: string;
  title: string;
  description: string;
  reward: string;
  progress: number;
  target: number;
  type: 'behavioral' | 'savings' | 'education';
};

type EducationTip = {
  icon: string;
  title: string;
  message: string;
  type: 'warning' | 'action' | 'education';
};

type PredictiveInsight = {
  category: string;
  projectedOverspend: number;
  confidence: 'high' | 'medium' | 'low';
  suggestion: string;
};

type Transaction = {
  id: string;
  amount: number;
  description: string;
  type: 'income' | 'expense';
  occurred_at: string;
  category?: string;
};

// Utility Functions
const currency = (n: number) => `KES ${Number(n).toLocaleString()}`;

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

const categorizeTransaction = (transaction: Transaction): string => {
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

const categorizeAllTransactions = (transactions: Transaction[]): Transaction[] => {
  return transactions.map(transaction => ({
    ...transaction,
    category: categorizeTransaction(transaction)
  }));
};

// Enhanced categories with icons
const CATEGORIES_WITH_ICONS = [
  { name: 'Food & Dining', icon: 'food', color: '#EF4444' },
  { name: 'Transport', icon: 'car', color: '#3B82F6' },
  { name: 'Utilities', icon: 'home-lightning-bolt', color: '#8B5CF6' },
  { name: 'Entertainment', icon: 'movie', color: '#EC4899' },
  { name: 'Shopping', icon: 'shopping', color: '#F59E0B' },
  { name: 'Healthcare', icon: 'hospital', color: '#10B981' },
  { name: 'Education', icon: 'school', color: '#6366F1' },
  { name: 'Personal Care', icon: 'account-heart', color: '#F97316' },
  { name: 'Savings', icon: 'piggy-bank', color: '#059669' },
  { name: 'Investments', icon: 'trending-up', color: '#7C3AED' },
  { name: 'Rent', icon: 'home', color: '#DC2626' },
  { name: 'Bills', icon: 'file-document', color: '#475569' },
];

// Component: Animated Progress Bar
function AnimatedProgressBar({ pct, tint, showWarning = false }: { 
  pct: number; 
  tint?: string; 
  showWarning?: boolean;
}) {
  const [animatedWidth] = useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: Math.min(100, Math.max(0, pct)),
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const widthInterpolate = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const isOverBudget = pct > 100;
  
  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          { 
            width: widthInterpolate,
            backgroundColor: isOverBudget ? '#EF4444' : (tint || colors.primary),
          },
        ]}
      />
      {showWarning && pct >= 90 && pct < 100 && (
        <View style={[styles.warningIndicator, { left: `${Math.min(100, pct)}%` }]} />
      )}
    </View>
  );
}

// Component: Category Icon
function CategoryIcon({ category, size = 24 }: { category: string; size?: number }) {
  const categoryData = CATEGORIES_WITH_ICONS.find(cat => 
    cat.name.toLowerCase() === category.toLowerCase()
  ) || { icon: 'tag', color: colors.primary };

  return (
    <View style={[styles.categoryIcon, { backgroundColor: `${categoryData.color}15` }]}>
      <Icon name={categoryData.icon} size={size} color={categoryData.color} />
    </View>
  );
}

// Component: Financial Health Score Card
function FinancialHealthScoreCard({ health }: { health: FinancialHealthScore }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    if (score >= 40) return '#EF4444';
    return '#DC2626';
  };

  return (
    <View style={styles.healthScoreCard}>
      <View style={styles.healthHeader}>
        <Text style={styles.healthTitle}>Financial Health Score</Text>
        <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(health.score) }]}>
          <Text style={styles.scoreText}>{health.score}</Text>
        </View>
      </View>
      <Text style={[styles.healthCategory, { color: getScoreColor(health.score) }]}>
        {health.category}
      </Text>
      
      {health.insights.length > 0 && (
        <View style={styles.insightsContainer}>
          {health.insights.map((insight, index) => (
            <View key={index} style={styles.insightItem}>
              <Icon name="information" size={16} color="#6B7280" />
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>
      )}
      
      <View style={styles.recommendationsContainer}>
        <Text style={styles.recommendationsTitle}>Recommendations</Text>
        {health.recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationItem}>
            <Icon name="lightbulb" size={14} color="#F59E0B" />
            <Text style={styles.recommendationText}>{rec}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Component: Categorization Helper
function CategorizationHelper({ transactions, onCategorize, onClose }: {
  transactions: Transaction[];
  onCategorize: (transactionId: string, category: string) => void;
  onClose: () => void;
}) {
  const [uncategorized, setUncategorized] = useState<Transaction[]>([]);

  useEffect(() => {
    const uncategorizedTx = transactions.filter(t => 
      t.type === 'expense' && (!t.category || t.category === 'Uncategorized')
    ).slice(0, 5);
    setUncategorized(uncategorizedTx);
  }, [transactions]);

  if (uncategorized.length === 0) return null;

  return (
    <View style={styles.categorizationHelper}>
      <View style={styles.helperHeader}>
        <Text style={styles.helperTitle}>Categorize Your Spending</Text>
        <TouchableOpacity onPress={onClose}>
          <Icon name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      <Text style={styles.helperText}>
        Help us understand your spending by categorizing transactions
      </Text>
      
      <ScrollView style={styles.uncategorizedList} horizontal showsHorizontalScrollIndicator={false}>
        {uncategorized.map(tx => (
          <View key={tx.id} style={styles.uncategorizedCard}>
            <Text style={styles.txDescription} numberOfLines={2}>
              {tx.description}
            </Text>
            <Text style={styles.txAmount}>{currency(tx.amount)}</Text>
            
            <View style={styles.categoryButtons}>
              {['Food & Dining', 'Transport', 'Shopping', 'Bills', 'Entertainment'].map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={styles.categoryButton}
                  onPress={() => onCategorize(tx.id, cat)}
                >
                  <Text style={styles.categoryButtonText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// Component: Behavioral Budget Card
function BehavioralBudgetCard({ item, spend, transactions, onEdit, onDelete }: { 
  item: BudgetRow; 
  spend: SpendByCategory;
  transactions: Transaction[];
  onEdit: (budget: BudgetRow) => void;
  onDelete: (budget: BudgetRow) => void;
}) {
  const spent = spend[item.category] || 0;
  const limit = item.amount;
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const remaining = Math.max(0, limit - spent);
  const isOverBudget = pct > 100;
  
  const getBehavioralInsight = (): BehavioralInsight => {
    const daysInMonth = new Date().getDate();
    const totalDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dailySpendRate = spent / daysInMonth;
    const projectedSpend = dailySpendRate * totalDays;

    const totalExpenses = Object.values(spend).reduce((sum, amt) => sum + amt, 0);
    const categoryRatio = totalExpenses > 0 ? (spent / totalExpenses) * 100 : 0;

    if (projectedSpend > limit * 1.2) {
      return { 
        type: 'overspending',
        message: `At current pace, you'll exceed budget by ${currency(projectedSpend - limit)}`,
        suggestion: 'Consider reducing daily spending'
      };
    }
    
    if (pct > 80 && daysInMonth < 15) {
      return {
        type: 'accelerated',
        message: 'Fast spending pace detected',
        suggestion: 'You\'ve used 80% of budget with half month remaining'
      };
    }

    // Category proportion insight
    const expectedRatios = {
      'Food & Dining': 15,
      'Transport': 10,
      'Bills': 30,
      'Shopping': 15,
      'Entertainment': 10,
      'Savings': 20
    };

    const expectedRatio = expectedRatios[item.category as keyof typeof expectedRatios] || 15;
    if (categoryRatio > expectedRatio * 1.5) {
      return {
        type: 'warning',
        message: `This category takes ${Math.round(categoryRatio)}% of your total spending`,
        suggestion: `Consider if this aligns with your financial priorities`
      };
    }
    
    return {
      type: 'healthy',
      message: 'Spending pattern looks good',
      suggestion: 'Keep tracking to maintain healthy habits'
    };
  };

  const insight = getBehavioralInsight();
  const tint = isOverBudget ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#10B981';

  // Calculate how many transactions contribute to this category
  const categoryTransactions = transactions.filter(t => 
    t.category === item.category && t.type === 'expense'
  ).length;

  return (
    <TouchableOpacity 
      style={[
        styles.budgetCard,
        isOverBudget && styles.overBudgetCard
      ]}
      onPress={() => onEdit(item)}
      activeOpacity={0.7}
    >
      <View style={styles.budgetHeader}>
        <View style={styles.categoryRow}>
          <CategoryIcon category={item.category} />
          <View style={styles.categoryInfo}>
            <Text style={styles.budgetTitle}>{item.category}</Text>
            <Text style={styles.transactionCount}>
              {categoryTransactions} transactions • {currency(spent)} spent
            </Text>
          </View>
        </View>
        
        <View style={styles.budgetActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onEdit(item)}
          >
            <Icon name="pencil" size={16} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onDelete(item)}
          >
            <Icon name="delete" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.amountRow}>
        <Text style={styles.budgetAmounts}>
          <Text style={{ color: tint, fontWeight: '800' }}>{currency(spent)}</Text>
          <Text style={{ color: colors.muted }}> / {currency(limit)}</Text>
        </Text>
        <Text style={[styles.percentText, { color: tint }]}>
          {isFinite(pct) ? `${Math.round(pct)}%` : "0%"}
        </Text>
      </View>
      
      <AnimatedProgressBar pct={isFinite(pct) ? pct : 0} tint={tint} showWarning={true} />
      
      <View style={styles.budgetFooter}>
        <Text style={[styles.remainingText, { color: colors.muted }]}>
          {currency(remaining)} left
        </Text>
      </View>

      {/* Behavioral Insight */}
      <View style={[
        styles.insightBanner,
        insight.type === 'overspending' && styles.overspendingBanner,
        insight.type === 'accelerated' && styles.warningBanner,
        insight.type === 'warning' && styles.warningBanner,
        insight.type === 'healthy' && styles.healthyBanner
      ]}>
        <Icon 
          name={
            insight.type === 'overspending' ? 'alert' :
            insight.type === 'accelerated' ? 'run-fast' :
            insight.type === 'warning' ? 'information' : 'check-circle'
          } 
          size={16} 
          color="#fff" 
        />
        <View style={styles.insightText}>
          <Text style={styles.insightMessage}>{insight.message}</Text>
          <Text style={styles.insightSuggestion}>{insight.suggestion}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Component: Financial Challenges
function FinancialChallenges() {
  const [activeChallenges, setActiveChallenges] = useState<FinancialChallenge[]>([
    {
      id: '1',
      title: 'No-Spend Weekend',
      description: 'Avoid unnecessary spending for one weekend',
      reward: 'Learn impulse control',
      progress: 0,
      target: 1,
      type: 'behavioral'
    },
    {
      id: '2', 
      title: 'Emergency Fund Builder',
      description: 'Save KES 1000 for emergencies this month',
      reward: 'Financial security habit',
      progress: 0,
      target: 1000,
      type: 'savings'
    },
    {
      id: '3',
      title: 'Budget Review Master',
      description: 'Review and adjust all your budgets',
      reward: 'Better financial planning',
      progress: 0,
      target: 1,
      type: 'education'
    }
  ]);

  const completeChallenge = (challengeId: string) => {
    setActiveChallenges(prev => 
      prev.map(challenge => 
        challenge.id === challengeId 
          ? { ...challenge, progress: challenge.target }
          : challenge
      )
    );
  };

  return (
    <View style={styles.challengesSection}>
      <Text style={styles.sectionTitle}>🎯 Financial Challenges</Text>
      {activeChallenges.map(challenge => (
        <TouchableOpacity 
          key={challenge.id} 
          style={styles.challengeCard}
          onPress={() => completeChallenge(challenge.id)}
        >
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeTitle}>{challenge.title}</Text>
            <View style={styles.rewardBadge}>
              <Text style={styles.rewardText}>★ {challenge.reward}</Text>
            </View>
          </View>
          <Text style={styles.challengeDesc}>{challenge.description}</Text>
          <View style={styles.challengeProgress}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${(challenge.progress / challenge.target) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {challenge.progress}/{challenge.target}
            </Text>
          </View>
          {challenge.progress < challenge.target && (
            <TouchableOpacity 
              style={styles.completeButton}
              onPress={() => completeChallenge(challenge.id)}
            >
              <Text style={styles.completeButtonText}>Mark Complete</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Component: Financial Education Tips
function FinancialEducationTips({ budgets, spend }: { budgets: BudgetRow[]; spend: SpendByCategory }) {
  const getContextualTips = (): EducationTip[] => {
    const tips: EducationTip[] = [];
    const totalSpent = Object.values(spend).reduce((sum, amount) => sum + amount, 0);
    
    // Tip based on spending patterns
    const entertainmentSpend = spend['Entertainment'] || 0;
    if (entertainmentSpend > totalSpent * 0.3) {
      tips.push({
        icon: 'party-popper',
        title: 'Entertainment Spending',
        message: 'Consider balancing fun expenses with savings goals. Try the 50/30/20 rule!',
        type: 'warning'
      });
    }
    
    // Tip based on budget utilization
    const overBudgetCategories = budgets.filter(b => {
      const catSpend = spend[b.category] || 0;
      return catSpend > b.amount;
    });
    
    if (overBudgetCategories.length > 0) {
      tips.push({
        icon: 'chart-line',
        title: 'Budget Adjustment Needed',
        message: `${overBudgetCategories.length} categories over budget. Review and adjust limits.`,
        type: 'action'
      });
    }
    
    // Savings tip
    const savingsBudget = budgets.find(b => b.category.toLowerCase().includes('savings'));
    if (!savingsBudget || (spend['Savings'] || 0) < savingsBudget.amount * 0.5) {
      tips.push({
        icon: 'piggy-bank',
        title: 'Boost Your Savings',
        message: 'Try saving 20% of your income for long-term security and emergencies',
        type: 'education'
      });
    }

    // General financial literacy tips
    if (tips.length < 2) {
      tips.push({
        icon: 'shield-check',
        title: 'Emergency Fund',
        message: 'Aim for 3-6 months of expenses in your emergency fund for financial security',
        type: 'education'
      });
    }
    
    return tips.slice(0, 3); // Limit to 3 tips
  };

  const tips = getContextualTips();

  if (tips.length === 0) return null;

  return (
    <View style={styles.tipsSection}>
      <Text style={styles.sectionTitle}>💡 Smart Tips for You</Text>
      {tips.map((tip, index) => (
        <View key={index} style={[
          styles.tipCard,
          tip.type === 'warning' && styles.warningTip,
          tip.type === 'action' && styles.actionTip,
          tip.type === 'education' && styles.educationTip
        ]}>
          <Icon name={tip.icon} size={20} color="#fff" />
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>{tip.title}</Text>
            <Text style={styles.tipMessage}>{tip.message}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// Component: Predictive Insights
function PredictiveInsights({ budgets, spend }: { budgets: BudgetRow[]; spend: SpendByCategory }) {
  const getPredictiveInsights = (): PredictiveInsight[] => {
    const insights: PredictiveInsight[] = [];
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysPassed = today.getDate();
    
    budgets.forEach(budget => {
      const spent = spend[budget.category] || 0;
      const dailyRate = spent / daysPassed;
      const projected = dailyRate * daysInMonth;
      
      if (projected > budget.amount * 1.1) {
        insights.push({
          category: budget.category,
          projectedOverspend: projected - budget.amount,
          confidence: 'high',
          suggestion: `Reduce daily ${budget.category} spending by ${currency((projected - budget.amount) / (daysInMonth - daysPassed))}`
        });
      }
    });
    
    return insights;
  };

  const insights = getPredictiveInsights();

  if (insights.length === 0) return null;

  return (
    <View style={styles.predictiveSection}>
      <Text style={styles.sectionTitle}>🔮 Projected Insights</Text>
      {insights.map((insight, index) => (
        <View key={index} style={styles.predictiveCard}>
          <Icon name="chart-timeline" size={20} color="#F59E0B" />
          <View style={styles.predictiveContent}>
            <Text style={styles.predictiveText}>
              {insight.category} may exceed budget by {currency(insight.projectedOverspend)}
            </Text>
            <Text style={styles.predictiveSuggestion}>{insight.suggestion}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// Component: Budget Modal
function BudgetModal({
  visible,
  title,
  category,
  amount,
  onCategoryChange,
  onAmountChange,
  onShowSuggestionsChange,
  showSuggestions,
  onSelectCategory,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  category: string;
  amount: string;
  onCategoryChange: (text: string) => void;
  onAmountChange: (text: string) => void;
  onShowSuggestionsChange: (show: boolean) => void;
  showSuggestions: boolean;
  onSelectCategory: (category: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheetWrap}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Category</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Food & Dining"
              value={category}
              onChangeText={(text) => {
                onCategoryChange(text);
                onShowSuggestionsChange(true);
              }}
              onFocus={() => onShowSuggestionsChange(true)}
            />

            {showSuggestions && (
              <View style={styles.suggestionsContainer}>
                {CATEGORIES_WITH_ICONS
                  .filter(cat => 
                    cat.name.toLowerCase().includes(category.toLowerCase())
                  )
                  .map(cat => (
                    <TouchableOpacity
                      key={cat.name}
                      style={styles.suggestionItem}
                      onPress={() => onSelectCategory(cat.name)}
                    >
                      <CategoryIcon category={cat.name} size={20} />
                      <Text style={styles.suggestionText}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))
                }
              </View>
            )}

            <Text style={styles.label}>Monthly Limit (KES)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 4000"
              keyboardType="numeric"
              value={amount}
              onChangeText={onAmountChange}
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={onSave}>
              <Text style={styles.primaryBtnText}>Save Budget</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Main Budgets Screen Component
export default function BudgetsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categorizedSpend, setCategorizedSpend] = useState<SpendByCategory>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<BudgetRow | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [showCategorizationHelper, setShowCategorizationHelper] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const monthKey = new Date().toISOString().slice(0, 7) + '-01';

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getUser();
  }, []);

  // Load data with auto-categorization
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch budgets
      const { data: b, error: e1 } = await supabase
        .from("budgets")
        .select("id, user_id, category, amount, month, created_at")
        .eq("user_id", user.id)
        .eq("month", monthKey)
        .order("created_at", { ascending: true });
      
      if (e1) throw e1;

      // Fetch transactions
      const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();

      const { data: tx, error: e2 } = await supabase
        .from("transactions")
        .select("id, amount, description, type, occurred_at, category")
        .eq("user_id", user.id)
        .gte("occurred_at", start)
        .lt("occurred_at", end);

      if (e2) throw e2;

      // Auto-categorize transactions if they don't have categories
      let categorizedTransactions: Transaction[] = tx || [];
      if (categorizedTransactions.length > 0 && !categorizedTransactions[0].category) {
        categorizedTransactions = categorizeAllTransactions(categorizedTransactions);
      }

      // Calculate spending per category
      const spend: SpendByCategory = {};
      categorizedTransactions.forEach((t: Transaction) => {
        if (t.type === 'expense') {
          const category = t.category || 'Uncategorized';
          spend[category] = (spend[category] || 0) + Number(t.amount);
        }
      });

      setBudgets(b || []);
      setTransactions(categorizedTransactions);
      setCategorizedSpend(spend);

      // Show categorization helper if there are uncategorized transactions
      const uncategorizedCount = categorizedTransactions.filter(t => 
        t.type === 'expense' && (!t.category || t.category === 'Uncategorized')
      ).length;
      setShowCategorizationHelper(uncategorizedCount > 0);

    } catch (err: any) {
      console.error("Load error:", err);
      if (err?.code !== '23503') {
        Alert.alert("Error", err?.message ?? "Failed to load data");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthKey]);

  useEffect(() => {
    if (currentUser) {
      load();
    }
  }, [load, currentUser]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Calculate financial health score
  const financialHealth = useMemo((): FinancialHealthScore => {
    const totalBudget = budgets.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const spent = budgets.reduce((sum, r) => {
      return sum + (categorizedSpend[r.category] || 0);
    }, 0);
    const remaining = totalBudget - spent;
    const utilizationRate = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;
    
    // Base score calculation
    let score = 100;
    
    // Penalize for over-utilization
    if (utilizationRate > 100) score -= 30;
    else if (utilizationRate > 80) score -= 15;
    else if (utilizationRate > 60) score -= 5;
    
    // Reward for under-utilization with savings
    if (utilizationRate < 50 && remaining > 0) score += 10;
    
    // Penalize for negative remaining
    if (remaining < 0) score -= 20;
    
    // Consider number of over-budget categories
    const overBudgetCount = budgets.filter(b => {
      const catSpend = categorizedSpend[b.category] || 0;
      return catSpend > b.amount;
    }).length;
    
    score -= overBudgetCount * 5;
    
    const finalScore = Math.max(0, Math.min(100, score));
    
    let category: FinancialHealthScore['category'] = 'Poor';
    if (finalScore >= 80) category = 'Excellent';
    else if (finalScore >= 60) category = 'Good';
    else if (finalScore >= 40) category = 'Fair';

    const insights = [];
    if (utilizationRate > 90) insights.push("High budget utilization - consider reviewing spending limits");
    if (remaining < 0) insights.push("You're overspending this month");
    if (overBudgetCount > 0) insights.push(`${overBudgetCount} categories over budget`);
    
    const recommendations = [
      "Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings",
      "Set up emergency fund goal",
      "Review your highest spending categories"
    ];

    return { 
      score: Math.round(finalScore), 
      category, 
      insights, 
      recommendations 
    };
  }, [budgets, categorizedSpend]);

  // Budget management functions
  const addBudget = async () => {
    const cat = newCategory.trim();
    const amt = parseFloat(newAmount);
    if (!cat) return Alert.alert("Validation", "Category is required");
    if (!amt || amt <= 0) return Alert.alert("Validation", "Enter a valid amount");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    
    if (!user) {
      Alert.alert("Authentication Required", "Please sign in to create budgets");
      return;
    }

    try {
      const { error } = await supabase
        .from("budgets")
        .insert([{ user_id: user.id, category: cat, amount: amt, month: monthKey }]);

      if (error) throw error;
      
      setModalOpen(false);
      setNewCategory("");
      setNewAmount("");
      await load();
      
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add budget");
    }
  };

  const editBudget = async () => {
    if (!selectedBudget) return;
    
    const cat = newCategory.trim();
    const amt = parseFloat(newAmount);
    if (!cat) return Alert.alert("Validation", "Category is required");
    if (!amt || amt <= 0) return Alert.alert("Validation", "Enter a valid amount");

    try {
      const { error } = await supabase
        .from("budgets")
        .update({ category: cat, amount: amt })
        .eq("id", selectedBudget.id);

      if (error) throw error;
      
      setEditModalOpen(false);
      setSelectedBudget(null);
      setNewCategory("");
      setNewAmount("");
      await load();
      
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update budget");
    }
  };

  const deleteBudget = async (budget: BudgetRow) => {
    Alert.alert(
      "Delete Budget",
      `Are you sure you want to delete the "${budget.category}" budget?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("budgets")
                .delete()
                .eq("id", budget.id);

              if (error) throw error;
              await load();
              
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to delete budget");
            }
          },
        },
      ]
    );
  };

  const openEditModal = (budget: BudgetRow) => {
    setSelectedBudget(budget);
    setNewCategory(budget.category);
    setNewAmount(budget.amount.toString());
    setEditModalOpen(true);
  };

  const selectCategory = (category: string) => {
    setNewCategory(category);
    setShowCategorySuggestions(false);
  };

  const categorizeTransaction = async (transactionId: string, category: string) => {
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ category })
        .eq("id", transactionId);

      if (error) throw error;
      
      // Reload data to reflect the categorization
      await load();
    } catch (error) {
      Alert.alert("Error", "Failed to categorize transaction");
    }
  };

  // Calculate totals for display
  const totals = useMemo(() => {
    const totalBudget = budgets.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const spent = budgets.reduce((sum, r) => {
      return sum + (categorizedSpend[r.category] || 0);
    }, 0);
    const remaining = totalBudget - spent;
    const utilizationRate = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;
    
    return { totalBudget, spent, remaining, utilizationRate };
  }, [budgets, categorizedSpend]);

  if (!currentUser && loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16, color: colors.muted }}>Checking authentication...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Budget Management</Text>
        <Text style={styles.headerSubtitle}>Track and improve your financial health</Text>
      </View>

      {!currentUser && (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            Please sign in to manage your budgets
          </Text>
        </View>
      )}

      {currentUser && (
        <>
          <ScrollView 
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            {/* Categorization Helper */}
            {showCategorizationHelper && (
              <CategorizationHelper
                transactions={transactions}
                onCategorize={categorizeTransaction}
                onClose={() => setShowCategorizationHelper(false)}
              />
            )}

            {/* Financial Health Score */}
            <FinancialHealthScoreCard health={financialHealth} />

            {/* Totals Overview */}
            <View style={styles.totalsCard}>
              <Text style={styles.totalsTitle}>Monthly Overview</Text>
              <View style={styles.totalsGrid}>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>Total Budget</Text>
                  <Text style={styles.totalValue}>{currency(totals.totalBudget)}</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>Spent</Text>
                  <Text style={styles.totalValue}>{currency(totals.spent)}</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>Remaining</Text>
                  <Text style={[
                    styles.totalValue, 
                    { color: totals.remaining >= 0 ? "#10B981" : "#EF4444" }
                  ]}>
                    {currency(Math.max(0, totals.remaining))}
                  </Text>
                </View>
              </View>
            </View>

            {/* Predictive Insights */}
            <PredictiveInsights budgets={budgets} spend={categorizedSpend} />

            {/* Financial Education Tips */}
            <FinancialEducationTips budgets={budgets} spend={categorizedSpend} />

            {/* Budget Categories Section */}
            <Text style={styles.sectionTitle}>Your Budget Categories</Text>

            {loading ? (
              <View style={{ padding: spacing.lg, alignItems: "center" }}>
                <ActivityIndicator />
              </View>
            ) : budgets.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="chart-pie" size={64} color={colors.muted} />
                <Text style={styles.emptyStateTitle}>No budgets yet</Text>
                <Text style={styles.emptyStateText}>
                  Create your first budget to start tracking your spending and improve your financial health
                </Text>
              </View>
            ) : (
              <View style={styles.budgetsList}>
                {budgets.map(budget => (
                  <BehavioralBudgetCard
                    key={budget.id}
                    item={budget}
                    spend={categorizedSpend}
                    transactions={transactions}
                    onEdit={openEditModal}
                    onDelete={deleteBudget}
                  />
                ))}
              </View>
            )}

            {/* Financial Challenges */}
            <FinancialChallenges />

            {/* Spending Analysis Card */}
            {transactions.length > 0 && (
              <View style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>Spending Analysis</Text>
                <View style={styles.analysisRow}>
                  <View style={styles.analysisItem}>
                    <Text style={styles.analysisLabel}>Total Transactions</Text>
                    <Text style={styles.analysisValue}>{transactions.length}</Text>
                  </View>
                  <View style={styles.analysisItem}>
                    <Text style={styles.analysisLabel}>Categorized</Text>
                    <Text style={styles.analysisValue}>
                      {Math.round((transactions.filter(t => t.category && t.category !== 'Uncategorized').length / transactions.length) * 100)}%
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Floating Action Button */}
          <TouchableOpacity 
            style={styles.fab} 
            onPress={() => {
              if (!currentUser) {
                Alert.alert("Sign In Required", "Please sign in to create budgets");
                return;
              }
              setModalOpen(true);
            }}
          >
            <Icon name="plus" size={24} color="#fff" />
          </TouchableOpacity>
        </>
      )}

      {/* Add Budget Modal */}
      <BudgetModal
        visible={modalOpen}
        title="Add Budget"
        category={newCategory}
        amount={newAmount}
        onCategoryChange={setNewCategory}
        onAmountChange={setNewAmount}
        onShowSuggestionsChange={setShowCategorySuggestions}
        showSuggestions={showCategorySuggestions}
        onSelectCategory={selectCategory}
        onSave={addBudget}
        onClose={() => {
          setModalOpen(false);
          setNewCategory("");
          setNewAmount("");
          setShowCategorySuggestions(false);
        }}
      />

      {/* Edit Budget Modal */}
      <BudgetModal
        visible={editModalOpen}
        title="Edit Budget"
        category={newCategory}
        amount={newAmount}
        onCategoryChange={setNewCategory}
        onAmountChange={setNewAmount}
        onShowSuggestionsChange={setShowCategorySuggestions}
        showSuggestions={showCategorySuggestions}
        onSelectCategory={selectCategory}
        onSave={editBudget}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedBudget(null);
          setNewCategory("");
          setNewAmount("");
          setShowCategorySuggestions(false);
        }}
      />
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    paddingTop: 60,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.muted,
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    marginHorizontal: spacing.md,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: spacing.md,
  },
  warningText: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  healthScoreCard: {
    backgroundColor: "#fff",
    marginHorizontal: spacing.md,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    marginBottom: spacing.md,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  healthTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  scoreBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  healthCategory: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  insightsContainer: {
    marginBottom: spacing.md,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  insightText: {
    fontSize: 14,
    color: colors.muted,
    marginLeft: spacing.sm,
    flex: 1,
  },
  recommendationsContainer: {
    backgroundColor: '#f8fafc',
    padding: spacing.md,
    borderRadius: 12,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  recommendationText: {
    fontSize: 12,
    color: colors.muted,
    marginLeft: spacing.sm,
    flex: 1,
  },
  totalsCard: {
    backgroundColor: "#fff",
    marginHorizontal: spacing.md,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    marginBottom: spacing.md,
  },
  totalsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
  },
  totalsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  totalItem: {
    flex: 1,
    alignItems: 'center',
  },
  totalLabel: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  totalValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  budgetsList: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  budgetCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    marginBottom: spacing.md,
  },
  overBudgetCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  categoryInfo: {
    flex: 1,
  },
  budgetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2
  },
  transactionCount: {
    fontSize: 12,
    color: colors.muted,
  },
  budgetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  budgetAmounts: {
    fontSize: 16,
    fontWeight: '600',
  },
  percentText: {
    fontWeight: "800",
    fontSize: 14
  },
  progressTrack: {
    height: 10,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: spacing.sm,
    position: 'relative',
  },
  progressFill: {
    height: "100%",
    borderRadius: 999
  },
  warningIndicator: {
    position: 'absolute',
    top: -2,
    width: 4,
    height: 14,
    backgroundColor: '#F59E0B',
    borderRadius: 2,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remainingText: {
    fontSize: 12,
    fontWeight: "600"
  },
  insightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  overspendingBanner: {
    backgroundColor: '#EF4444',
  },
  warningBanner: {
    backgroundColor: '#F59E0B',
  },
  healthyBanner: {
    backgroundColor: '#10B981',
  },
  insightText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  insightMessage: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  insightSuggestion: {
    color: '#fff',
    fontSize: 10,
    opacity: 0.9,
  },
  challengesSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  challengeCard: {
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  challengeTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: colors.text,
  },
  rewardBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  rewardText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
  },
  challengeDesc: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  challengeProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
  },
  completeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tipsSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  warningTip: {
    backgroundColor: '#FEE2E2',
  },
  actionTip: {
    backgroundColor: '#DBEAFE',
  },
  educationTip: {
    backgroundColor: '#D1FAE5',
  },
  tipContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  tipTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: colors.text,
    marginBottom: 2,
  },
  tipMessage: {
    fontSize: 12,
    color: colors.muted,
  },
  predictiveSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  predictiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  predictiveContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  predictiveText: {
    fontWeight: '600',
    fontSize: 12,
    color: colors.text,
    marginBottom: 2,
  },
  predictiveSuggestion: {
    fontSize: 11,
    color: colors.muted,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    marginHorizontal: spacing.md,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)"
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: "85%",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text
  },
  label: {
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
    fontSize: 14,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md,
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginBottom: spacing.md,
    maxHeight: 200,
  },
  suggestionItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  suggestionText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16
  },
  categorizationHelper: {
    backgroundColor: '#EFF6FF',
    marginHorizontal: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  helperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  helperTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  helperText: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  uncategorizedList: {
    flexDirection: 'row',
  },
  uncategorizedCard: {
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: 8,
    marginRight: spacing.sm,
    width: 200,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  txDescription: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  categoryButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  categoryButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text,
  },
  analysisCard: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginBottom: spacing.lg,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  analysisItem: {
    alignItems: 'center',
  },
  analysisLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  analysisValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
});