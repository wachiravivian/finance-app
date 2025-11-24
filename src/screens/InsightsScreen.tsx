// screens/InsightsScreen.tsx
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
import { supabase, getCurrentUser, clearAuthSession } from "../supabaseClient";
import { useTheme } from "../hooks/useTheme";

type TxRow = {
  amount: number;
  direction: "credit" | "debit";
  category: string | null;
  occurred_at: string;
  method: string | null;
  counterparty: string | null;
};

type SpendingProfile = {
  type: "high_saver" | "moderate_spender" | "overspender" | "balanced" | "insufficient_data" | "no_spending_data";
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

type MLRecommendation = {
  category: "savings" | "spending" | "income" | "budgeting" | "investing" | "behavior";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
  impact: string;
};

type MLInsights = {
  spending_profile: SpendingProfile;
  recommendations: MLRecommendation[];
  trends: any;
  risk_assessment: any;
};

// 🚀 PERMANENT SOLUTION - Ngrok URL
const FASTAPI_URL = Platform.OS === 'web' 
  ? "http://localhost:8080" 
  : "https://fa9e4969232e.ngrok-free.app";

// Enhanced mock data based on your transaction patterns
const mockMLInsights: MLInsights = {
  spending_profile: {
    type: "moderate_spender",
    confidence: 0.85,
    description: "Based on your transaction patterns, you're maintaining moderate spending habits with significant P2P transactions.",
    strengths: ["Active financial tracking", "Regular income patterns", "Good transaction diversity"],
    areas_for_improvement: ["Savings rate optimization", "P2P spending management", "Budget allocation"],
    metrics: {
      savings_rate: 15.2,
      total_income: 157770,
      total_expenses: 133770,
      avg_daily_spend: 4459,
      top_category: "p2p",
      top_category_percentage: 97.8
    }
  },
  recommendations: [
    {
      category: "savings",
      priority: "high",
      title: "Boost Savings Rate",
      description: "Current savings rate: 15.2% - Target: 20%+ for better financial security",
      action: "Automate 10-15% of income to dedicated savings account each month",
      impact: "Build emergency fund faster and improve long-term financial resilience"
    },
    {
      category: "spending",
      priority: "high",
      title: "Optimize P2P Spending",
      description: "P2P transactions consume 97.8% of your income - this is very concentrated",
      action: "Set monthly budget limits for P2P transfers and track against them",
      impact: "Better expense distribution and improved financial control"
    },
    {
      category: "behavior",
      priority: "medium",
      title: "Consolidate Small Transactions",
      description: "High frequency of small transactions detected in your spending patterns",
      action: "Batch similar purchases and plan weekly instead of daily transactions",
      impact: "Reduce transaction fees and improve spending tracking efficiency"
    },
    {
      category: "budgeting",
      priority: "medium",
      title: "Create Spending Categories",
      description: "Your transactions show potential for better categorization",
      action: "Set up clear budget categories: Essentials, Discretionary, Savings, Investments",
      impact: "Better financial visibility and intentional spending"
    }
  ],
  trends: {
    income_trend: "stable",
    spending_trend: "consistent",
    volatility: "low",
    key_observations: [
      "Strong P2P transaction pattern detected",
      "Consistent income flow observed",
      "Opportunity for better savings allocation"
    ]
  },
  risk_assessment: {
    level: "medium",
    factors: ["high_p2p_concentration", "moderate_savings_rate"],
    summary: "Primary risk: Over-reliance on P2P transactions. Consider diversifying financial activities."
  }
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

function getPriorityColor(priority: string, colors: any) {
  switch (priority) {
    case "high": return colors.danger || "#dc2626";
    case "medium": return colors.warning || "#f59e0b";
    case "low": return colors.success || "#16a34a";
    default: return colors.subtitle;
  }
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

export default function InsightsScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [spentByCat, setSpentByCat] = useState<Record<string, number>>({});
  const [mlInsights, setMlInsights] = useState<MLInsights | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<string>('unknown');

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setConnectionError(null);
    
    try {
      console.log('🔐 Checking authentication...');
      
      // Use the new getCurrentUser function
      const user = await getCurrentUser();
      if (!user) {
        setConnectionError('Please log in to view transactions');
        return;
      }

      const userId = user.id;
      console.log('✅ User authenticated:', userId);

      const { start, end } = getMonthRange();

      console.log('📊 Loading transactions for user:', userId);
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("amount, direction, category, occurred_at, method, counterparty")
        .eq("user_id", userId)
        .gte("occurred_at", start)
        .lt("occurred_at", end);

      if (txError) {
        console.error('❌ Transaction load error:', txError);
        
        if (txError.code === 'PGRST301' || txError.message.includes('JWT')) {
          await clearAuthSession();
          setConnectionError('Session expired. Please log in again.');
          return;
        }
        
        throw txError;
      }

      const txs: TxRow[] = (txData ?? []).map((t: any) => ({
        amount: Number(t.amount ?? 0),
        direction: t.direction,
        category: t.category ?? "uncategorized",
        occurred_at: t.occurred_at,
        method: t.method,
        counterparty: t.counterparty,
      }));

      console.log(`✅ Loaded ${txs.length} transactions`);

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

      // Generate ML insights if we have transactions
      if (txs.length > 0) {
        console.log('🚀 Generating ML insights...');
        await generateMLInsights(txs, userId);
      } else {
        console.log('ℹ️ No transactions to analyze');
        setMlInsights(null);
      }
    } catch (err: any) {
      console.error('💥 Error loading transactions:', err);
      
      if (err.message?.includes('not authenticated') || err.message?.includes('JWT')) {
        setConnectionError('Authentication error. Please log out and log in again.');
      } else {
        setConnectionError('Failed to load transactions: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const testConnection = async () => {
    try {
      setGeneratingInsights(true);
      setConnectionError(null);
      
      console.log(`🧪 Testing connection to: ${FASTAPI_URL}/health`);
      console.log(`📍 Using Ngrok URL: ${FASTAPI_URL}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${FASTAPI_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FinAccess-App/1.0.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setServerStatus('connected');
        Alert.alert(
          '✅ Connection Successful!', 
          `ML server is reachable via Ngrok!\n\n🌐 Public URL: ${FASTAPI_URL}\n📊 Status: ${data.status}\n🔗 Type: Ngrok (Permanent)`
        );
        return true;
      } else {
        setServerStatus('failed');
        Alert.alert('❌ Connection Failed', `Server returned HTTP ${response.status}`);
        return false;
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setServerStatus('failed');
      
      let errorMsg = error.message;
      if (error.name === 'AbortError') {
        errorMsg = 'Timeout - Ngrok server not responding within 10 seconds';
      } else if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
        errorMsg = `Cannot reach Ngrok server. Please check:\n• Ngrok is running: ngrok http 8080\n• Server is running: python start_server.py\n• Internet connection is stable`;
      }
      
      Alert.alert(
        '❌ Connection Failed', 
        `${errorMsg}\n\n🌐 URL: ${FASTAPI_URL}`
      );
      setConnectionError(errorMsg);
      return false;
    } finally {
      setGeneratingInsights(false);
    }
  };

  const generateMLInsights = async (transactions: TxRow[], userId: string) => {
    setGeneratingInsights(true);
    setUsingMockData(false);
    setConnectionError(null);
    
    try {
      // Transform transactions for the ML API
      const mlTransactions = transactions.map(tx => ({
        ts: tx.occurred_at,
        direction: tx.direction,
        amount: tx.amount,
        category: tx.category || "other",
        method: tx.method,
        counterparty: tx.counterparty
      }));

      console.log(`🔄 Connecting to ML server: ${FASTAPI_URL}/ml-insights`);
      console.log(`📊 Sending ${mlTransactions.length} transactions for analysis`);
      console.log(`🌐 Using Ngrok URL: ${FASTAPI_URL}`);
      
      // Test basic connectivity first
      console.log('🧪 Testing Ngrok connection...');
      const isConnected = await testConnection();
      if (!isConnected) {
        throw new Error('Ngrok server connection test failed. Using enhanced mock data.');
      }

      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout for ML processing

      console.log('🚀 Sending transaction data to ML server...');
      const response = await fetch(`${FASTAPI_URL}/ml-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'FinAccess-App/1.0.0'
        },
        body: JSON.stringify({
          transactions: mlTransactions,
          user_id: userId
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ HTTP error! status: ${response.status}, response:`, errorText);
        throw new Error(`ML server returned ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const insights = await response.json();
      console.log('✅ ML insights generated successfully via Ngrok!');
      console.log('📈 Insights received:', Object.keys(insights));
      setMlInsights(insights);
      setServerStatus('connected');
      setUsingMockData(false);
      
    } catch (error: any) {
      console.error('❌ Error generating ML insights:', error);
      setServerStatus('failed');
      
      // Enhanced error diagnostics
      let errorMessage = 'Unknown network error';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout (20s) - ML processing is taking too long';
      } else if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
        errorMessage = `Cannot connect to Ngrok server.\n\n🔧 Please verify:\n• Ngrok is running: ngrok http 8080\n• FastAPI server is running: python start_server.py\n• Internet connection is stable\n• Ngrok URL: ${FASTAPI_URL}`;
      } else {
        errorMessage = error.message;
      }

      // Use enhanced mock data as fallback
      console.log('🔄 Using enhanced mock data as fallback');
      const currentSavingsRate = calculateSavingsRate(income, expenses);
      
      // Enhanced mock data based on actual transaction patterns - FIXED TYPE ERROR
      const enhancedMockInsights: MLInsights = {
        spending_profile: {
          type: transactions.length > 0 ? "moderate_spender" : "insufficient_data",
          confidence: Math.min(0.8, transactions.length / 10),
          description: transactions.length > 0 
            ? "Based on your transaction patterns, you're maintaining moderate spending habits."
            : "Not enough transaction data to generate personalized insights.",
          strengths: transactions.length > 0 
            ? ["Active financial tracking", "Regular transaction patterns"] 
            : ["Ready to start tracking your finances"],
          areas_for_improvement: transactions.length > 0 
            ? ["Savings rate optimization", "Spending categorization"] 
            : ["Start recording your income and expenses"],
          metrics: transactions.length > 0 ? {
            savings_rate: currentSavingsRate,
            total_income: income,
            total_expenses: expenses,
            avg_daily_spend: expenses > 0 ? expenses / 30 : 0,
            top_category: Object.keys(spentByCat).length > 0 
              ? Object.entries(spentByCat).sort((a, b) => b[1] - a[1])[0][0]
              : "uncategorized",
            top_category_percentage: Object.keys(spentByCat).length > 0 && income > 0
              ? (Object.entries(spentByCat).sort((a, b) => b[1] - a[1])[0][1] / income * 100)
              : 0
          } : undefined
        },
        recommendations: transactions.length > 0 ? [
          {
            category: "savings" as const,
            priority: currentSavingsRate < 10 ? "high" as const : "medium" as const,
            title: currentSavingsRate < 0 ? "Address Cash Flow Issues" : "Optimize Savings",
            description: currentSavingsRate < 0 
              ? `Your expenses exceed income by ${Math.abs(currentSavingsRate).toFixed(1)}%. Focus on essential spending.`
              : `Current savings rate: ${currentSavingsRate.toFixed(1)}%. Target 20% for better financial security.`,
            action: currentSavingsRate < 0 
              ? "Create a strict budget focusing on essential expenses only."
              : "Automate 10-15% of income to savings each month.",
            impact: "High - Improved financial stability"
          },
          {
            category: "behavior" as const,
            priority: "medium" as const,
            title: "Enhance Transaction Categorization",
            description: "Better categorization leads to more accurate insights and budgeting.",
            action: "Consistently categorize all transactions with specific labels.",
            impact: "Medium - Better financial visibility"
          }
        ] : [
          {
            category: "savings" as const,
            priority: "high" as const,
            title: "Start Tracking Your Finances",
            description: "Begin recording your income and expenses to get personalized insights.",
            action: "Add your first transaction to see ML-powered analysis.",
            impact: "High - Foundation for financial improvement"
          }
        ],
        trends: {
          income_trend: "stable",
          spending_trend: "stable",
          volatility: "low",
          key_observations: transactions.length > 0 
            ? [`Analyzed ${transactions.length} transactions`, "Using demo insights - Ngrok connection issue"]
            : ["No transaction data available for analysis"]
        },
        risk_assessment: {
          level: currentSavingsRate < 0 ? "high" : "low",
          factors: currentSavingsRate < 0 ? ["negative_cash_flow"] : ["insufficient_data"],
          summary: transactions.length > 0 
            ? "Using demo data - connect via Ngrok for live ML analysis"
            : "No data available for risk assessment"
        }
      };
      
      setMlInsights(enhancedMockInsights);
      setUsingMockData(true);
      setConnectionError(errorMessage);
      
      console.log(`
🔧 NGROK TROUBLESHOOTING:
📍 Your Ngrok URL: ${FASTAPI_URL}
🚨 Required Services:

1. ✅ FastAPI Server (Terminal 1):
   python start_server.py

2. ✅ Ngrok Tunnel (Terminal 2):
   ngrok http 8080

3. 📱 Test URL (Phone Browser):
   ${FASTAPI_URL}/health

💡 Tip: Ngrok URLs are permanent until you stop ngrok.
Restarting ngrok gives you a new URL.
      `);
    } finally {
      setGeneratingInsights(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const net = income - expenses;
  const savingsRate = calculateSavingsRate(income, expenses);

  const getStatusColor = () => {
    switch (serverStatus) {
      case 'connected': return '#16a34a';
      case 'failed': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getStatusText = () => {
    switch (serverStatus) {
      case 'connected': return 'Connected via Ngrok ✓';
      case 'failed': return 'Disconnected ✗';
      default: return 'Checking...';
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16 },
    title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 16 },
    center: { alignItems: "center", justifyContent: "center", padding: 40 },
    loadingText: { marginTop: 12, color: colors.subtitle, fontSize: 14 },
    row: { flexDirection: "row", gap: 12, marginBottom: 12 },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
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
    exportBtn: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: "center",
      marginTop: 8,
      marginBottom: 24,
    },
    exportText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    profileCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
    },
    recommendationCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderLeftWidth: 3,
    },
    recommendationTitle: { fontWeight: "700", fontSize: 14, marginBottom: 4 },
    recommendationDesc: { fontSize: 12, color: colors.subtitle, marginBottom: 4 },
    recommendationAction: { fontSize: 11, color: colors.text, fontStyle: "italic" },
    priorityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    priorityText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    confidenceBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.subtitle,
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    confidenceText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    mockDataNotice: {
      backgroundColor: '#fef3c7',
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: '#f59e0b',
    },
    mockDataText: {
      color: '#92400e',
      fontSize: 12,
      fontWeight: '600',
    },
    connectionError: {
      backgroundColor: '#fee2e2',
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: '#dc2626',
    },
    errorText: {
      color: '#dc2626',
      fontSize: 12,
      fontWeight: '600',
    },
    connectionTest: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: getStatusColor(),
    },
    serverInfoText: {
      color: colors.subtitle,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    testButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    testButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    serverInfo: {
      backgroundColor: '#dbeafe',
      padding: 8,
      borderRadius: 6,
      marginBottom: 12,
    },
    serverText: {
      color: '#1e40af',
      fontSize: 10,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    statusIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    ngrokBadge: {
      backgroundColor: '#7c3aed',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    ngrokText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '700',
    },
  });

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTransactions} />}
    >
      <Text style={styles.title}>ML-Powered Financial Insights</Text>

      {/* Connection Test Section */}
      <View style={styles.connectionTest}>
        <View>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>
          <View style={styles.ngrokBadge}>
            <Text style={styles.ngrokText}>🌐 NGROK CONNECTION</Text>
          </View>
          <Text style={styles.serverInfoText}>
            {FASTAPI_URL}
          </Text>
          <Text style={[styles.serverInfoText, {fontSize: 10, color: colors.primary}]}>
            Permanent URL • Works Everywhere
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.testButton}
          onPress={testConnection}
          disabled={generatingInsights}
        >
          <Text style={styles.testButtonText}>
            {generatingInsights ? 'Testing...' : 'Test'}
          </Text>
        </TouchableOpacity>
      </View>

      {connectionError && (
        <View style={styles.connectionError}>
          <Text style={styles.errorText}>{connectionError}</Text>
          <View style={styles.serverInfo}>
            <Text style={styles.serverText}>
              Server: {FASTAPI_URL}/ml-insights
            </Text>
            <Text style={styles.serverText}>
              Status: Ngrok tunnel issue - Check both services are running
            </Text>
          </View>
        </View>
      )}

      {usingMockData && (
        <View style={styles.mockDataNotice}>
          <Text style={styles.mockDataText}>
            Using Demo Insights - Ngrok connection unavailable
          </Text>
          <View style={styles.serverInfo}>
            <Text style={styles.serverText}>
              Server: {FASTAPI_URL}/ml-insights
            </Text>
            <Text style={styles.serverText}>
              Status: Using enhanced demo data - Check ngrok is running
            </Text>
          </View>
        </View>
      )}

      {loading || generatingInsights ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {generatingInsights ? "Generating AI insights via Ngrok..." : "Analyzing your financial patterns..."}
          </Text>
        </View>
      ) : (
        <>
          {/* Basic Financial Overview */}
          <View style={styles.row}>
            <View style={styles.card}>
              <Text style={styles.label}>Income</Text>
              <Text style={[styles.val, { color: "#16a34a" }]}>{currency(income)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Expenses</Text>
              <Text style={[styles.val, { color: "#dc2626" }]}>{currency(expenses)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Net Savings</Text>
            <Text style={[styles.big, { color: net >= 0 ? "#16a34a" : "#dc2626" }]}>
              {net >= 0 ? "+" : "-"}
              {currency(Math.abs(net))}
            </Text>
            <Text style={styles.savingsRate}>Savings Rate: {savingsRate.toFixed(1)}%</Text>
            {savingsRate < 10 && (
              <Text style={[styles.savingsRate, { color: "#dc2626" }]}>
                Aim for 20%+ for better financial security
              </Text>
            )}
          </View>

          {/* ML Insights Section */}
          {mlInsights && (
            <>
              {/* Spending Profile */}
              <View style={[
                styles.profileCard, 
                { borderLeftColor: getProfileColor(mlInsights.spending_profile.type) }
              ]}>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {Math.round(mlInsights.spending_profile.confidence * 100)}% Confidence
                  </Text>
                </View>
                {!usingMockData && (
                  <View style={styles.ngrokBadge}>
                    <Text style={styles.ngrokText}>✅ LIVE ML ANALYSIS</Text>
                  </View>
                )}
                <Text style={styles.sectionTitle}>Your Financial Profile</Text>
                <Text style={[styles.val, { marginBottom: 8, color: getProfileColor(mlInsights.spending_profile.type) }]}>
                  {titleCase(mlInsights.spending_profile.type.replace('_', ' '))}
                </Text>
                <Text style={{ color: colors.text, marginBottom: 12, lineHeight: 20 }}>
                  {mlInsights.spending_profile.description}
                </Text>
                
                {mlInsights.spending_profile.metrics && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.label, { marginBottom: 4 }]}>Key Metrics:</Text>
                    <Text style={{ color: colors.subtitle, fontSize: 12, lineHeight: 18 }}>
                      • Savings Rate: {mlInsights.spending_profile.metrics.savings_rate.toFixed(1)}%
                    </Text>
                    <Text style={{ color: colors.subtitle, fontSize: 12, lineHeight: 18 }}>
                      • Top Category: {titleCase(mlInsights.spending_profile.metrics.top_category)} ({mlInsights.spending_profile.metrics.top_category_percentage}%)
                    </Text>
                    <Text style={{ color: colors.subtitle, fontSize: 12, lineHeight: 18 }}>
                      • Avg Daily Spend: {currency(mlInsights.spending_profile.metrics.avg_daily_spend)}
                    </Text>
                  </View>
                )}
              </View>

              {/* AI Recommendations */}
              {mlInsights.recommendations.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>AI Recommendations</Text>
                  {mlInsights.recommendations.map((rec, index) => (
                    <View 
                      key={index}
                      style={[
                        styles.recommendationCard,
                        { borderLeftColor: getPriorityColor(rec.priority, colors) }
                      ]}
                    >
                      <View style={[
                        styles.priorityBadge,
                        { backgroundColor: getPriorityColor(rec.priority, colors) }
                      ]}>
                        <Text style={styles.priorityText}>
                          {titleCase(rec.priority)} Priority • {titleCase(rec.category)}
                        </Text>
                      </View>
                      <Text style={[styles.recommendationTitle, { color: colors.text }]}>
                        {rec.title}
                      </Text>
                      <Text style={styles.recommendationDesc}>
                        {rec.description}
                      </Text>
                      <Text style={styles.recommendationAction}>
                        {rec.action}
                      </Text>
                      <Text style={[styles.recommendationDesc, { marginTop: 4 }]}>
                        Impact: {rec.impact}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Risk Assessment */}
              {mlInsights.risk_assessment && (
                <View style={[
                  styles.card, 
                  { 
                    borderLeftWidth: 4,
                    borderLeftColor: mlInsights.risk_assessment.level === 'high' ? '#dc2626' :
                                   mlInsights.risk_assessment.level === 'medium' ? '#f59e0b' : '#16a34a'
                  }
                ]}>
                  <Text style={styles.sectionTitle}>Risk Assessment</Text>
                  <Text style={[styles.val, { 
                    color: mlInsights.risk_assessment.level === 'high' ? '#dc2626' :
                          mlInsights.risk_assessment.level === 'medium' ? '#f59e0b' : '#16a34a'
                  }]}>
                    {titleCase(mlInsights.risk_assessment.level)} Risk
                  </Text>
                  <Text style={{ color: colors.subtitle, marginTop: 4 }}>
                    {mlInsights.risk_assessment.summary}
                  </Text>
                  {mlInsights.risk_assessment.factors.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.label, { marginBottom: 4 }]}>Risk Factors:</Text>
                      {mlInsights.risk_assessment.factors.map((factor: string, idx: number) => (
                        <Text key={idx} style={{ color: colors.subtitle, fontSize: 12 }}>
                          • {factor.replace(/_/g, ' ')}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* Spending Analysis */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Spending Analysis</Text>
            {Object.keys(spentByCat).length === 0 ? (
              <Text style={styles.muted}>No spending recorded yet.</Text>
            ) : (
              Object.entries(spentByCat)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cat, amt]) => (
                  <View key={cat} style={styles.categoryRow}>
                    <View>
                      <Text style={styles.categoryName}>{titleCase(cat)}</Text>
                      <Text style={styles.categoryPercentage}>
                        {income > 0 ? `${((amt / income) * 100).toFixed(1)}% of income` : ""}
                      </Text>
                    </View>
                    <Text style={styles.categoryAmount}>{currency(amt)}</Text>
                  </View>
                ))
            )}
          </View>

          {/* Temporary debug button */}
          <TouchableOpacity 
            style={[styles.exportBtn, { backgroundColor: '#6b7280' }]}
            onPress={async () => {
              await clearAuthSession();
              Alert.alert('Session Cleared', 'Please log in again to refresh your session.');
            }}
          >
            <Text style={styles.exportText}>Clear Session & Relogin</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.exportBtn} 
            onPress={() => Alert.alert("Export PDF", "PDF export feature coming soon!")}
          >
            <Text style={styles.exportText}>
              {Platform.OS === "web" ? "Download ML Insights Report" : "Export ML Insights"}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}