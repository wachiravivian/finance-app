// screens/InsightsScreen.tsx - FIXED VERSION
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { supabase, getCurrentUser } from "../supabaseClient";
import { useTheme } from "../hooks/useTheme";
import { getApiBase } from "../utils/api";

type TxRow = {
  amount: number;
  direction: "credit" | "debit";
  category: string | null;
  occurred_at: string;
  method: string | null;
  counterparty: string | null;
};

type SpendingProfile = {
  type: "high_saver" | "moderate_spender" | "overspender" | "balanced" | "insufficient_data";
  confidence: number;
  description: string;
  strengths: string[];
  areas_for_improvement: string[];
  metrics?: {
    savings_rate: number;
    total_income: number;
    total_expenses: number;
    avg_daily_spend: number;
    top_category: string;
    top_category_percentage: number;
  };
};

type MLInsights = {
  spending_profile: SpendingProfile;
  recommendations: any[];
  trends: any;
  risk_assessment: any;
};

function titleCase(str: string) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function currency(n: number) {
  return `KSH ${n.toLocaleString()}`;
}

function calculateSavingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0;
  return ((income - expenses) / income) * 100;
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function getProfileColor(profileType: string) {
  switch (profileType) {
    case "high_saver": return "#16a34a";
    case "balanced": return "#3b82f6";
    case "moderate_spender": return "#f59e0b";
    case "overspender": return "#dc2626";
    default: return "#6b7280";
  }
}

function getProfileDescription(profileType: string, savingsRate: number) {
  const descriptions = {
    high_saver: {
      title: "Super Saver",
      subtitle: "You're excellent at saving money",
      description: "Your savings habits are impressive. You consistently spend less than you earn and prioritize financial security."
    },
    balanced: {
      title: "Balanced Spender", 
      subtitle: "You maintain a healthy financial balance",
      description: "You have good financial discipline with a balanced approach to spending and saving."
    },
    moderate_spender: {
      title: "Moderate Spender",
      subtitle: "Opportunity to improve savings",
      description: "You're spending a bit more than ideal. Small adjustments could significantly boost your savings."
    },
    overspender: {
      title: "Overspender",
      subtitle: "Immediate attention needed",
      description: "Your expenses exceed your income. Focus on essential spending and create a budget."
    },
    insufficient_data: {
      title: "Insufficient Data",
      subtitle: "Need more transaction history",
      description: "We need more transaction data to analyze your spending behavior accurately."
    }
  };
  
  return descriptions[profileType as keyof typeof descriptions] || descriptions.insufficient_data;
}

export default function InsightsScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [spentByCat, setSpentByCat] = useState<Record<string, number>>({});
  const [mlInsights, setMlInsights] = useState<MLInsights | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState<string>('');

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setConnectionError(null);
    
    try {
      const user = await getCurrentUser();
      if (!user) {
        setConnectionError('Please log in to view transactions');
        return;
      }

      const { start, end } = getMonthRange();

      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("amount, direction, category, occurred_at, method, counterparty")
        .eq("user_id", user.id)
        .gte("occurred_at", start)
        .lt("occurred_at", end);

      if (txError) throw txError;

      const txs: TxRow[] = (txData ?? []).map((t: any) => ({
        amount: Number(t.amount ?? 0),
        direction: t.direction,
        category: t.category ?? "uncategorized",
        occurred_at: t.occurred_at,
        method: t.method,
        counterparty: t.counterparty,
      }));

      let inc = 0;
      let exp = 0;
      const catMap: Record<string, number> = {};
      
      for (const t of txs) {
        if (t.direction === "credit") inc += t.amount;
        else {
          exp += t.amount;
          const key = (t.category ?? "uncategorized").toLowerCase();
          catMap[key] = (catMap[key] ?? 0) + t.amount;
        }
      }

      setIncome(inc);
      setExpenses(exp);
      setSpentByCat(catMap);

      if (txs.length > 0) {
        await generateMLInsights(txs, user.id);
      } else {
        setMlInsights(null);
      }
    } catch (err: any) {
      console.error('Error loading transactions:', err);
      setConnectionError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  const generateMLInsights = async (transactions: TxRow[], userId: string) => {
    setGeneratingInsights(true);
    setConnectionError(null);
    
    try {
      const mlTransactions = transactions.map(tx => ({
        ts: tx.occurred_at,
        direction: tx.direction,
        amount: tx.amount,
        category: tx.category || "other",
        method: tx.method,
        counterparty: tx.counterparty
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const currentBackendUrl = getApiBase();
      setBackendUrl(currentBackendUrl);
      
      console.log('Calling ML insights at:', `${currentBackendUrl}/ml-insights`);

      const response = await fetch(`${currentBackendUrl}/ml-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: mlTransactions,
          user_id: userId
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ML server error: ${response.status} - ${response.statusText}`);
      }

      const insights = await response.json();
      console.log('ML insights received successfully');
      setMlInsights(insights);
      
    } catch (error: any) {
      console.error('ML insights failed:', error);
      
      const errorMessage = error.name === 'AbortError' 
        ? 'Request timeout - backend took too long to respond'
        : error.message;
      
      setConnectionError(`ML Analysis Failed: ${errorMessage}`);
      
      // Smart fallback based on user's actual data
      const currentSavingsRate = calculateSavingsRate(income, expenses);
      let profileType: SpendingProfile['type'] = "insufficient_data";
      
      if (income > 0) {
        if (currentSavingsRate >= 20) profileType = "high_saver";
        else if (currentSavingsRate >= 0) profileType = "moderate_spender";
        else profileType = "overspender";
      }

      setMlInsights({
        spending_profile: {
          type: profileType,
          confidence: 0.7,
          description: getProfileDescription(profileType, currentSavingsRate).description,
          strengths: ["Transaction tracking active"],
          areas_for_improvement: ["Continue monitoring spending"],
          metrics: {
            savings_rate: currentSavingsRate,
            total_income: income,
            total_expenses: expenses,
            avg_daily_spend: expenses > 0 ? expenses / 30 : 0,
            top_category: Object.keys(spentByCat)[0] || "none",
            top_category_percentage: 0
          }
        },
        recommendations: [],
        trends: {},
        risk_assessment: {}
      });
    } finally {
      setGeneratingInsights(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const net = income - expenses;
  const savingsRate = calculateSavingsRate(income, expenses);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16 },
    title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 16 },
    center: { alignItems: "center", justifyContent: "center", padding: 40 },
    loadingText: { marginTop: 12, color: colors.subtitle, fontSize: 14 },
    row: { flexDirection: "row", gap: 12, marginBottom: 12 },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    label: { color: colors.subtitle, fontSize: 12, fontWeight: "700", marginBottom: 6 },
    val: { fontSize: 18, fontWeight: "800" },
    big: { fontSize: 22, fontWeight: "800" },
    savingsRate: { color: colors.subtitle, fontSize: 14, marginTop: 4 },
    sectionTitle: { fontWeight: "800", color: colors.text, marginBottom: 16, fontSize: 18 },
    muted: { color: colors.subtitle, fontStyle: "italic" },
    categoryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
    categoryName: { fontWeight: "600", color: colors.text, fontSize: 14 },
    categoryPercentage: { color: colors.subtitle, fontSize: 12 },
    categoryAmount: { fontWeight: "600", color: colors.text },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    profileTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    profileSubtitle: {
      fontSize: 14,
      color: colors.subtitle,
      marginTop: 2,
    },
    confidenceBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      alignSelf: 'flex-start',
      marginBottom: 12,
    },
    confidenceText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    metricItem: {
      width: '48%',
      backgroundColor: 'rgba(0,0,0,0.03)',
      padding: 12,
      borderRadius: 12,
      marginBottom: 8,
    },
    metricValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    metricLabel: {
      fontSize: 11,
      color: colors.subtitle,
      fontWeight: '600',
    },
    strengthItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    strengthDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#16a34a',
      marginRight: 8,
    },
    improvementDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#dc2626',
      marginRight: 8,
    },
    errorText: {
      color: '#dc2626',
      fontSize: 12,
      fontWeight: '600',
    },
    debugInfo: {
      fontSize: 10,
      color: colors.subtitle,
      marginTop: 8,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    recommendationItem: {
      backgroundColor: 'rgba(0,0,0,0.03)',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      borderLeftWidth: 3,
    },
    recommendationTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    recommendationDescription: {
      fontSize: 12,
      color: colors.subtitle,
      lineHeight: 16,
    },
  });

  const profileInfo = mlInsights ? getProfileDescription(mlInsights.spending_profile.type, savingsRate) : null;

  // Get priority color for recommendations
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#dc2626';
      case 'medium': return '#f59e0b';
      case 'low': return '#16a34a';
      default: return colors.primary;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTransactions} />}
    >
      <Text style={styles.title}>Financial Behavior Analysis</Text>

      {connectionError && (
        <View style={{ backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <Text style={styles.errorText}>{connectionError}</Text>
          {backendUrl && (
            <Text style={styles.debugInfo}>Backend URL: {backendUrl}</Text>
          )}
        </View>
      )}

      {loading || generatingInsights ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {generatingInsights ? "Analyzing your spending behavior..." : "Loading your transactions..."}
          </Text>
        </View>
      ) : (
        <>
          {/* Financial Overview */}
          <View style={styles.row}>
            <View style={styles.card}>
              <Text style={styles.label}>Monthly Income</Text>
              <Text style={[styles.val, { color: "#16a34a" }]}>{currency(income)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Monthly Expenses</Text>
              <Text style={[styles.val, { color: "#dc2626" }]}>{currency(expenses)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Net Savings This Month</Text>
            <Text style={[styles.big, { color: net >= 0 ? "#16a34a" : "#dc2626" }]}>
              {net >= 0 ? "+" : "-"}
              {currency(Math.abs(net))}
            </Text>
            <Text style={styles.savingsRate}>
              Savings Rate: {savingsRate.toFixed(1)}% • 
              {savingsRate >= 20 ? " Excellent" : 
               savingsRate >= 10 ? " Good" : 
               savingsRate >= 0 ? " Needs improvement" : " Critical"}
            </Text>
          </View>

          {/* Behavior Classification */}
          {mlInsights && profileInfo && (
            <View style={[
              styles.card, 
              { borderLeftWidth: 6, borderLeftColor: getProfileColor(mlInsights.spending_profile.type) }
            ]}>
              <View style={styles.profileHeader}>
                <View>
                  <Text style={styles.profileTitle}>{profileInfo.title}</Text>
                  <Text style={styles.profileSubtitle}>{profileInfo.subtitle}</Text>
                </View>
              </View>

              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceText}>
                  {Math.round(mlInsights.spending_profile.confidence * 100)}% Confidence in Analysis
                </Text>
              </View>

              <Text style={{ color: colors.text, lineHeight: 22, marginBottom: 16 }}>
                {profileInfo.description}
              </Text>

              {/* Key Metrics */}
              {mlInsights.spending_profile.metrics && (
                <View style={styles.metricGrid}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>
                      {mlInsights.spending_profile.metrics.savings_rate.toFixed(1)}%
                    </Text>
                    <Text style={styles.metricLabel}>SAVINGS RATE</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>
                      {currency(mlInsights.spending_profile.metrics.avg_daily_spend)}
                    </Text>
                    <Text style={styles.metricLabel}>DAILY SPEND</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>
                      {titleCase(mlInsights.spending_profile.metrics.top_category)}
                    </Text>
                    <Text style={styles.metricLabel}>TOP CATEGORY</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>
                      {mlInsights.spending_profile.metrics.top_category_percentage.toFixed(0)}%
                    </Text>
                    <Text style={styles.metricLabel}>OF SPENDING</Text>
                  </View>
                </View>
              )}

              {/* Strengths & Improvements */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.label, { color: '#16a34a' }]}>Strengths</Text>
                  {mlInsights.spending_profile.strengths.map((strength, index) => (
                    <View key={index} style={styles.strengthItem}>
                      <View style={styles.strengthDot} />
                      <Text style={{ color: colors.text, fontSize: 12 }}>{strength}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.label, { color: '#dc2626' }]}>Areas to Improve</Text>
                  {mlInsights.spending_profile.areas_for_improvement.map((area, index) => (
                    <View key={index} style={styles.strengthItem}>
                      <View style={styles.improvementDot} />
                      <Text style={{ color: colors.text, fontSize: 12 }}>{area}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ML Recommendations */}
          {mlInsights && mlInsights.recommendations && mlInsights.recommendations.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Recommended Actions</Text>
              {mlInsights.recommendations.map((recommendation, index) => (
                <View 
                  key={index}
                  style={[
                    styles.recommendationItem,
                    { borderLeftColor: getPriorityColor(recommendation.priority) }
                  ]}
                >
                  <Text style={styles.recommendationTitle}>
                    {recommendation.title}
                  </Text>
                  <Text style={styles.recommendationDescription}>
                    {recommendation.description}
                  </Text>
                  {recommendation.action && (
                    <Text style={[styles.recommendationDescription, { marginTop: 4, fontWeight: '600' }]}>
                      Action: {recommendation.action}
                    </Text>
                  )}
                  {recommendation.impact && (
                    <Text style={[styles.recommendationDescription, { marginTop: 2 }]}>
                      Impact: {recommendation.impact}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Spending Breakdown */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Spending Breakdown</Text>
            {Object.keys(spentByCat).length === 0 ? (
              <Text style={styles.muted}>No spending recorded this month</Text>
            ) : (
              Object.entries(spentByCat)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([cat, amt]) => (
                  <View key={cat} style={styles.categoryRow}>
                    <Text style={styles.categoryName}>{titleCase(cat)}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.categoryAmount}>{currency(amt)}</Text>
                      <Text style={styles.categoryPercentage}>
                        {income > 0 ? `${((amt / income) * 100).toFixed(1)}% of income` : "100% of spending"}
                      </Text>
                    </View>
                  </View>
                ))
            )}
          </View>

          {/* Fallback Action Steps if no ML recommendations */}
          {mlInsights && (!mlInsights.recommendations || mlInsights.recommendations.length === 0) && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Suggested Actions</Text>
              {mlInsights.spending_profile.type === 'overspender' && (
                <>
                  <Text style={[styles.label, { color: '#dc2626', marginBottom: 8 }]}>Immediate Priority</Text>
                  <Text style={{ color: colors.text, marginBottom: 12, lineHeight: 20 }}>
                    • Create a strict budget focusing only on essential expenses
                    {"\n"}• Identify and eliminate discretionary spending
                    {"\n"}• Consider additional income sources
                  </Text>
                </>
              )}
              {mlInsights.spending_profile.type === 'moderate_spender' && (
                <>
                  <Text style={[styles.label, { color: '#f59e0b', marginBottom: 8 }]}>Improvement Areas</Text>
                  <Text style={{ color: colors.text, marginBottom: 12, lineHeight: 20 }}>
                    • Automate 10-15% of income to savings
                    {"\n"}• Review recurring subscriptions
                    {"\n"}• Set specific savings goals
                  </Text>
                </>
              )}
              {mlInsights.spending_profile.type === 'high_saver' && (
                <>
                  <Text style={[styles.label, { color: '#16a34a', marginBottom: 8 }]}>Next Level</Text>
                  <Text style={{ color: colors.text, marginBottom: 12, lineHeight: 20 }}>
                    • Explore investment opportunities
                    {"\n"}• Consider high-yield savings accounts
                    {"\n"}• Plan for long-term financial goals
                  </Text>
                </>
              )}
              <Text style={[styles.muted, { fontSize: 12, marginTop: 8 }]}>
                Based on analysis of {Object.values(spentByCat).reduce((a, b) => a + b, 0) > 0 ? 
                `${Object.keys(spentByCat).length} spending categories` : 'your transaction patterns'}
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}