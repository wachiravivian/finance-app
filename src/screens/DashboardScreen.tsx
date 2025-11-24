import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import { useTheme } from '../hooks/useTheme';
//import { ThemedScreen } from '../components/ThemedScreen';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';


// Define types based on your actual transaction schema
interface Transaction {
  id: string;
  ts: string;
  direction: "debit" | "credit";
  amount: number;
  method: string | null;
  type: string | null;
  counterparty: string | null;
  reference: string | null;
  category: string | null;
  notes: string | null;
  title: string | null;
}

interface PaymentStats {
  totalIncome: number;
  totalExpenses: number;
  net: number; // Changed from 0 to number
  categories: Array<{ category: string; total: number }>;
}

interface Reminder {
  id: string;
  title: string;
  message: string;
  type: 'budget' | 'goal' | 'payment' | 'general';
  is_read: boolean;
  created_at: string;
}

interface NavigationProps {
  navigate: (screen: string, params?: any) => void;
}

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  
  const [paymentStats, setPaymentStats] = useState<PaymentStats>({
    totalIncome: 0,
    totalExpenses: 0,
    net: 0,
    categories: []
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (isFocused) {
      loadDashboardData();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [isFocused]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchTransactionStats(),
        fetchRecentTransactions(),
        fetchBudgets(),
        fetchGoals(),
        fetchReminders()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('ts', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const stats = {
        totalIncome: 0,
        totalExpenses: 0,
        net: 0,
        categories: [] as Array<{ category: string; total: number }>
      };

      const categoryTotals: { [key: string]: number } = {};

      transactions?.forEach(transaction => {
        if (transaction.direction === 'credit') {
          stats.totalIncome += transaction.amount;
        } else if (transaction.direction === 'debit') {
          stats.totalExpenses += transaction.amount;
          
          const category = transaction.category || 'Uncategorized';
          if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
          }
          categoryTotals[category] += transaction.amount;
        }
      });

      stats.net = stats.totalIncome - stats.totalExpenses;
      stats.categories = Object.entries(categoryTotals).map(([category, total]) => ({
        category,
        total
      }));

      setPaymentStats(stats);
    } catch (error) {
      console.error('Error fetching transaction stats:', error);
      throw error;
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('ts', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentTransactions(transactions || []);
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      throw error;
    }
  };

  const fetchBudgets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: budgets, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setBudgets(budgets || []);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      throw error;
    }
  };

  const fetchGoals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: goals, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setGoals(goals || []);
    } catch (error) {
      console.error('Error fetching goals:', error);
      throw error;
    }
  };

  const fetchReminders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      await generateSmartReminders();
      
    } catch (error) {
      console.error('Error fetching reminders:', error);
      throw error;
    }
  };

  const generateSmartReminders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newReminders: Reminder[] = [];

    budgets.forEach(budget => {
      const progress = (budget.spent / budget.amount) * 100;
      if (progress >= 90) {
        newReminders.push({
          id: `budget-${budget.id}`,
          title: 'Budget Alert 🚨',
          message: `You've used ${progress.toFixed(1)}% of your ${budget.category} budget`,
          type: 'budget',
          is_read: false,
          created_at: new Date().toISOString()
        });
      } else if (progress >= 75) {
        newReminders.push({
          id: `budget-warning-${budget.id}`,
          title: 'Budget Warning ⚠️',
          message: `You've used ${progress.toFixed(1)}% of your ${budget.category} budget`,
          type: 'budget',
          is_read: false,
          created_at: new Date().toISOString()
        });
      }
    });

    goals.forEach(goal => {
      const progress = (goal.saved_amount / goal.target_amount) * 100;
      if (progress >= 90) {
        newReminders.push({
          id: `goal-${goal.id}`,
          title: 'Goal Almost Reached! 🎯',
          message: `You're ${progress.toFixed(1)}% towards your "${goal.name}" goal`,
          type: 'goal',
          is_read: false,
          created_at: new Date().toISOString()
        });
      }
    });

    if (recentTransactions.length === 0) {
      newReminders.push({
        id: 'no-transactions',
        title: 'Welcome! 👋',
        message: 'Start by importing your M-PESA statement to track your finances',
        type: 'general',
        is_read: false,
        created_at: new Date().toISOString()
      });
    }

    if (paymentStats.net < 0) {
      newReminders.push({
        id: 'negative-net',
        title: 'Spending Alert 💸',
        message: 'Your expenses are exceeding your income this period',
        type: 'payment',
        is_read: false,
        created_at: new Date().toISOString()
      });
    }

    setReminders(newReminders);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  const getProgressPercentage = (spent: number, budget: number): number => {
    return Math.min((spent / budget) * 100, 100);
  };

  const getReminderIcon = (type: string) => {
    switch (type) {
      case 'budget': return 'wallet';
      case 'goal': return 'flag';
      case 'payment': return 'cash';
      default: return 'notifications';
    }
  };

  const getReminderColor = (type: string) => {
    switch (type) {
      case 'budget': return '#FF6B6B';
      case 'goal': return '#4CAF50';
      case 'payment': return '#FFA726';
      default: return '#667eea';
    }
  };

  const handleImportTransactions = () => {
    navigation.navigate('Transactions');
  };

  const getTransactionDescription = (transaction: Transaction): string => {
    return transaction.counterparty || transaction.title || transaction.reference || 'Transaction';
  };

  const getTransactionCategory = (transaction: Transaction): string => {
    return transaction.category || 'Uncategorized';
  };

  const formatTransactionDate = (timestamp: string): string => {
    return new Date(timestamp).toLocaleDateString();
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back!</Text>
              <Text style={styles.subtitle}>Here's your financial overview</Text>
            </View>
            <TouchableOpacity 
              style={styles.syncButton}
              onPress={loadDashboardData}
              disabled={loading}
            >
              <Ionicons 
                name="refresh" 
                size={24} 
                color={loading ? colors.subtitle : colors.primary} 
              />
            </TouchableOpacity>
          </View>

          {/* Financial Summary */}
          <LinearGradient
            colors={colors.summaryCard as [string, string]} // Fixed: Cast to tuple type
            style={styles.summaryCard}
          >
            <Text style={styles.summaryTitle}>Financial Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={[styles.summaryValue, styles.incomeText]}>
                  {formatCurrency(paymentStats.totalIncome)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Expenses</Text>
                <Text style={[styles.summaryValue, styles.expenseText]}>
                  {formatCurrency(paymentStats.totalExpenses)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Net</Text>
                <Text style={[
                  styles.summaryValue,
                  paymentStats.net >= 0 ? styles.incomeText : styles.expenseText
                ]}>
                  {formatCurrency(paymentStats.net)}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Notifications/Reminders */}
          {reminders.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Notifications</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Reminders')}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              {reminders.slice(0, 3).map((reminder) => (
                <TouchableOpacity 
                  key={reminder.id} 
                  style={styles.reminderItem}
                  onPress={() => {
                    setReminders(prev => 
                      prev.map(r => 
                        r.id === reminder.id ? { ...r, is_read: true } : r
                      )
                    );
                  }}
                >
                  <View style={[styles.reminderIcon, { backgroundColor: getReminderColor(reminder.type) }]}>
                    <Ionicons name={getReminderIcon(reminder.type) as any} size={16} color="white" />
                  </View>
                  <View style={styles.reminderContent}>
                    <Text style={styles.reminderTitle}>{reminder.title}</Text>
                    <Text style={styles.reminderMessage}>{reminder.message}</Text>
                    <Text style={styles.reminderTime}>
                      {new Date(reminder.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  {!reminder.is_read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleImportTransactions}
              >
                <LinearGradient
                  colors={['#4CAF50', '#45a049']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="document-attach" size={32} color="white" />
                  <Text style={styles.actionText}>Import M-PESA</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('Budgets')}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#ee5a52']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="wallet" size={32} color="white" />
                  <Text style={styles.actionText}>Budgets</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('Goals')}
              >
                <LinearGradient
                  colors={['#FFA726', '#fb8c00']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="flag" size={32} color="white" />
                  <Text style={styles.actionText}>Goals</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('Insights')}
              >
                <LinearGradient
                  colors={['#26C6DA', '#00acc1']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="stats-chart" size={32} color="white" />
                  <Text style={styles.actionText}>Insights</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent Transactions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {recentTransactions.length > 0 ? (
              recentTransactions.map((transaction) => (
                <View key={transaction.id} style={styles.transactionItem}>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDescription}>
                      {getTransactionDescription(transaction)}
                    </Text>
                    <Text style={styles.transactionCategory}>
                      {getTransactionCategory(transaction)}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {formatTransactionDate(transaction.ts)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      transaction.direction === 'credit' ? styles.incomeText : styles.expenseText,
                    ]}
                  >
                    {transaction.direction === 'credit' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No transactions yet</Text>
                <TouchableOpacity 
                  style={styles.importButton}
                  onPress={handleImportTransactions}
                >
                  <Text style={styles.importButtonText}>Import M-PESA Statement</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Budget Progress */}
          {budgets.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Budget Progress</Text>
              {budgets.slice(0, 3).map((budget) => {
                const progress = getProgressPercentage(budget.spent, budget.amount);
                return (
                  <View key={budget.id} style={styles.budgetItem}>
                    <View style={styles.budgetHeader}>
                      <Text style={styles.budgetCategory}>{budget.category}</Text>
                      <Text style={styles.budgetAmount}>
                        {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${progress}%`,
                            backgroundColor: progress > 90 ? '#FF6B6B' : 
                                           progress > 75 ? '#FFA726' : '#4CAF50',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{progress.toFixed(1)}%</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Goals Progress */}
          {goals.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Goals Progress</Text>
              {goals.slice(0, 3).map((goal) => {
                const progress = (goal.saved_amount / goal.target_amount) * 100;
                return (
                  <View key={goal.id} style={styles.goalItem}>
                    <View style={styles.goalHeader}>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      <Text style={styles.goalAmount}>
                        {formatCurrency(goal.saved_amount)} / {formatCurrency(goal.target_amount)}
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(progress, 100)}%`,
                            backgroundColor: '#667eea',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{Math.min(progress, 100).toFixed(1)}%</Text>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.headerBackground,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.subtitle,
    marginTop: 4,
  },
  syncButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.cardBackground === 'white' ? '#f0f0f0' : '#2a2a2a',
  },
  summaryCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  incomeText: {
    color: colors.income,
  },
  expenseText: {
    color: colors.expense,
  },
  section: {
    backgroundColor: colors.cardBackground,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  seeAllText: {
    color: colors.primary,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionGradient: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  actionText: {
    color: 'white',
    fontWeight: '600',
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  transactionCategory: {
    fontSize: 14,
    color: colors.subtitle,
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.subtitle,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  budgetItem: {
    marginBottom: 16,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  budgetAmount: {
    fontSize: 14,
    color: colors.subtitle,
  },
  goalItem: {
    marginBottom: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  goalAmount: {
    fontSize: 14,
    color: colors.subtitle,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: colors.subtitle,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.subtitle,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  importButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  importButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reminderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  reminderMessage: {
    fontSize: 14,
    color: colors.subtitle,
    marginBottom: 4,
  },
  reminderTime: {
    fontSize: 12,
    color: colors.subtitle,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
    marginTop: 4,
  },
});

export default DashboardScreen;