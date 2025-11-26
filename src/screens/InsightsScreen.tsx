// src/screens/InsightsScreen.tsx - FULLY UPDATED WITH BETTER ERROR HANDLING
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
import { supabase } from "../supabaseClient";
import { useTheme } from "../hooks/useTheme";
import { getApiBase, testBackendConnection } from "../utils/api";

type TxRow = {
  amount: number;
  direction: "credit" | "debit";
  category: string | null;
  occurred_at: string;
  method: string | null;
  counterparty: string | null;
};

type SpendingProfile = {
  type: "high_saver" | "moderate_spender" | "overspender" | "balanced" | "insufficient_data" | "error";
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
    case "error": return "#6b7280";
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
    },
    error: {
      title: "Analysis Unavailable",
      subtitle: "Technical issue detected",
      description: "We're having trouble analyzing your data. Please check your connection and try again."
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
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string>('');

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setConnectionError(null);
    
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;

      if (!userId) {
        setConnectionError('Please log in to view transactions');
        return;
      }

      const { start, end } = getMonthRange();

      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("amount, direction, category, occurred_at, method, counterparty")
        .eq("user_id", userId)
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
        await generateMLInsights(txs, userId);
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
    setLastError('');
    
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
      const timeoutId = setTimeout(() => controller.abort(), 20000); // Increased timeout

      const currentBackendUrl = getApiBase();
      setBackendUrl(currentBackendUrl);
      
      console.log('🔄 Calling ML insights at:', `${currentBackendUrl}/ml-insights`);
      console.log('📊 Sending transactions:', mlTransactions.length);

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
        let errorMessage = `ML server error: ${response.status} - ${response.statusText}`;
        
        if (response.status === 404) {
          errorMessage = `ML insights endpoint not found (404). Please ensure:\n\n• Your Python backend has the /ml-insights route\n• Backend is running: python app.py\n• Backend was restarted after adding the route`;
        } else if (response.status === 500) {
          errorMessage = `ML server internal error (500). Check your Python backend logs for details.`;
        } else if (response.status === 422) {
          errorMessage = `Data validation error (422). Check transaction format.`;
        }
        
        throw new Error(errorMessage);
      }

      const insights = await response.json();
      console.log('✅ ML insights received successfully:', insights);
      
      if (!insights.spending_profile) {
        throw new Error('Invalid response format from ML server');
      }
      
      setMlInsights(insights);
      setRetryCount(0); // Reset retry count on success
      
    } catch (error: any) {
      console.error('❌ ML insights failed:', error);
      
      const errorMessage = error.name === 'AbortError' 
        ? 'Request timeout - backend took too long to respond. Please check if your Python backend is running.'
        : error.message;
      
      setLastError(errorMessage);
      setConnectionError(`ML Analysis Failed: ${errorMessage}`);
      setRetryCount(prev => prev + 1);
      
      // Smart fallback based on user's actual data
      createFallbackInsights();
    } finally {
      setGeneratingInsights(false);
    }
  };

  const createFallbackInsights = () => {
    const currentSavingsRate = calculateSavingsRate(income, expenses);
    let profileType: SpendingProfile['type'] = "insufficient_data";
    
    if (income > 0 && expenses > 0) {
      if (currentSavingsRate >= 20) profileType = "high_saver";
      else if (currentSavingsRate >= 0) profileType = "moderate_spender";
      else profileType = "overspender";
    }

    const topCategory = Object.keys(spentByCat).length > 0 
      ? Object.entries(spentByCat).sort((a, b) => b[1] - a[1])[0][0]
      : "none";
    
    const topCategoryPercentage = topCategory !== "none" && expenses > 0 
      ? (spentByCat[topCategory] / expenses * 100)
      : 0;

    const fallbackInsights: MLInsights = {
      spending_profile: {
        type: profileType,
        confidence: 0.6, // Lower confidence for fallback
        description: getProfileDescription(profileType, currentSavingsRate).description,
        strengths: profileType === "insufficient_data" 
          ? ["Ready to start tracking"] 
          : ["Basic analysis available", "Transaction data loaded"],
        areas_for_improvement: profileType === "insufficient_data"
          ? ["Import M-PESA statements", "Add more transactions"]
          : ["Enable ML insights for deeper analysis", "Check backend connection"],
        metrics: {
          savings_rate: currentSavingsRate,
          total_income: income,
          total_expenses: expenses,
          avg_daily_spend: expenses > 0 ? expenses / 30 : 0,
          top_category: topCategory,
          top_category_percentage: topCategoryPercentage
        }
      },
      recommendations: getFallbackRecommendations(profileType, currentSavingsRate),
      trends: {
        income_trend: "unknown",
        spending_trend: "unknown",
        volatility: "unknown",
        key_observations: ["Using fallback analysis due to ML service unavailability"]
      },
      risk_assessment: {
        level: currentSavingsRate >= 0 ? "low" : "medium",
        factors: currentSavingsRate < 0 ? ["overspending"] : ["basic_tracking"],
        summary: currentSavingsRate >= 0 ? "Basic tracking shows reasonable finances" : "Spending exceeds income"
      }
    };

    setMlInsights(fallbackInsights);
  };

  const getFallbackRecommendations = (profileType: string, savingsRate: number) => {
    const baseRecommendations = [{
      category: "technical",
      priority: "high",
      title: "Fix ML Insights Connection",
      description: "Advanced analysis is currently unavailable",
      action: "Check if Python backend is running with /ml-insights endpoint",
      impact: "High - Enable smart financial insights"
    }];

    if (profileType === "overspender") {
      baseRecommendations.push({
        category: "spending",
        priority: "high",
        title: "Reduce Discretionary Spending",
        description: "Your spending exceeds your income",
        action: "Identify and cut 2-3 non-essential expenses this month",
        impact: "High - Immediate financial improvement"
      });
    } else if (profileType === "moderate_spender") {
      baseRecommendations.push({
        category: "savings", 
        priority: "medium",
        title: "Increase Savings Rate",
        description: "You have room to save more",
        action: "Set up automatic transfer of 10% to savings",
        impact: "Medium - Build financial security"
      });
    }

    return baseRecommendations;
  };

  const retryMLAnalysis = async () => {
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id;
    
    if (!userId) {
      Alert.alert("Error", "Please log in to retry analysis");
      return;
    }

    const { start, end } = getMonthRange();
    const { data: txData } = await supabase
      .from("transactions")
      .select("amount, direction, category, occurred_at, method, counterparty")
      .eq("user_id", userId)
      .gte("occurred_at", start)
      .lt("occurred_at", end);

    if (txData && txData.length > 0) {
      const txs: TxRow[] = txData.map((t: any) => ({
        amount: Number(t.amount ?? 0),
        direction: t.direction,
        category: t.category ?? "uncategorized",
        occurred_at: t.occurred_at,
        method: t.method,
        counterparty: t.counterparty,
      }));

      await generateMLInsights(txs, userId);
    }
  };

  const testBackend = async () => {
    try {
      const result = await testBackendConnection();
      Alert.alert(
        result.success ? 'Backend Test Complete' : 'Backend Test Failed',
        result.message
      );
    } catch (error: any) {
      Alert.alert('Test Error', error.message);
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
    errorCard: {
      backgroundColor: '#fef2f2',
      borderColor: '#fecaca',
      borderWidth: 1,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
    },
    actionButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    retryButton: {
      backgroundColor: colors.primary,
    },
    testButton: {
      backgroundColor: colors.secondary || '#6b7280',
    },
    actionButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    fallbackBadge: {
      backgroundColor: '#f59e0b',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    fallbackText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '700',
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
        <View style={styles.errorCard}>
          <Text style={[styles.errorText, { marginBottom: 8 }]}>{connectionError}</Text>
          {lastError && (
            <Text style={styles.debugInfo}>Error details: {lastError}</Text>
          )}
          {backendUrl && (
            <Text style={styles.debugInfo}>Backend URL: {backendUrl}</Text>
          )}
          <Text style={[styles.debugInfo, { marginTop: 8 }]}>
            Attempt: {retryCount + 1} • Using {mlInsights?.spending_profile.confidence < 0.7 ? 'fallback' : 'ML'} analysis
          </Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.retryButton]}
              onPress={retryMLAnalysis}
              disabled={generatingInsights}
            >
              {generatingInsights ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>Retry Analysis</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.testButton]}
              onPress={testBackend}
            >
              <Text style={styles.actionButtonText}>Test Backend</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading || generatingInsights ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {generatingInsights ? "Analyzing your spending behavior..." : "Loading your transactions..."}
          </Text>
          {generatingInsights && (
            <Text style={[styles.muted, { marginTop: 8 }]}>
              This may take a few seconds...
            </Text>
          )}
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
              {mlInsights.spending_profile.confidence < 0.7 && (
                <View style={styles.fallbackBadge}>
                  <Text style={styles.fallbackText}>BASIC ANALYSIS</Text>
                </View>
              )}
              
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
        </>
      )}
    </ScrollView>
  );
}