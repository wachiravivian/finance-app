// src/screens/AdminReportsScreen.tsx
import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator, 
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform
} from "react-native";
import { DrawerScreenProps } from "@react-navigation/drawer";
import { DrawerParamList } from "../navigation/AppNavigator";
import { supabase } from "../supabaseClient";
import { spacing, radius } from "../constants/styles";
import { useTheme } from "../hooks/useTheme";
import { Ionicons } from "@expo/vector-icons";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type Props = DrawerScreenProps<DrawerParamList, "AdminReports">;

type AnalyticsData = {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalTransactions: number;
    transactionVolume: number;
    totalGoals: number;
    completedGoals: number;
    totalBillReminders: number;
    upcomingBillReminders: number;
  };
  financialHealth: {
    goalCompletionRate: number;
    billReminderCompletionRate: number;
  };
  userEngagement: {
    dailyActive: number;
    weeklyActive: number;
    monthlyActive: number;
  };
  insights: {
    topPerforming: string[];
    areasOfConcern: string[];
    recommendations: string[];
  };
};

export default function AdminReportsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("admin-get-analytics");
      if (error || !data) {
        await loadDirectAnalytics();
        return;
      }
      setAnalytics(data);
    } catch {
      await loadDirectAnalytics();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDirectAnalytics = async () => {
    try {
      // Get total users
      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
      const { data: profiles } = await supabase.from('profiles').select('*');
      const totalUsers = authUsers?.length || profiles?.length || 0;

      // Calculate active users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeUsers = authUsers?.filter(user => {
        if (!user.last_sign_in_at) return false;
        return new Date(user.last_sign_in_at) > thirtyDaysAgo;
      }).length || 0;

      // Get transactions data
      const { data: transactions, count: totalTransactions } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });

      // Calculate transaction volume
      const { data: allTransactions } = await supabase
        .from('transactions')
        .select('amount, direction');
      
      const transactionVolume = allTransactions?.reduce((total, tx) => {
        return total + (tx.amount || 0);
      }, 0) || 0;

      // Get goals data
      const { data: goals } = await supabase.from('goals').select('*');
      const totalGoals = goals?.length || 0;
      const completedGoals = goals?.filter(goal => goal.is_completed).length || 0;
      const goalCompletionRate = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

      // Get bill reminders data (you might need to create this table)
      const { data: billReminders } = await supabase.from('bill_reminders').select('*');
      const totalBillReminders = billReminders?.length || 0;
      
      // Calculate upcoming bill reminders (within next 7 days)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const upcomingBillReminders = billReminders?.filter(bill => {
        const dueDate = new Date(bill.due_date);
        return dueDate <= nextWeek && dueDate >= new Date() && !bill.is_paid;
      }).length || 0;

      // Calculate bill reminder completion rate
      const paidBills = billReminders?.filter(bill => bill.is_paid).length || 0;
      const billReminderCompletionRate = totalBillReminders > 0 ? Math.round((paidBills / totalBillReminders) * 100) : 0;

      const directData: AnalyticsData = {
        overview: {
          totalUsers,
          activeUsers,
          totalTransactions: totalTransactions || 0,
          transactionVolume,
          totalGoals,
          completedGoals,
          totalBillReminders,
          upcomingBillReminders
        },
        financialHealth: {
          goalCompletionRate,
          billReminderCompletionRate
        },
        userEngagement: {
          dailyActive: Math.round(totalUsers * 0.3),
          weeklyActive: Math.round(totalUsers * 0.6),
          monthlyActive: activeUsers
        },
        insights: {
          topPerforming: [
            `Platform has ${totalUsers} registered users`,
            `Active user rate: ${Math.round((activeUsers / totalUsers) * 100)}%`,
            `Total transaction volume: KSH ${transactionVolume.toLocaleString()}`
          ],
          areasOfConcern: [
            goalCompletionRate < 50 ? "Goal completion can be improved" : "Goal tracking is effective",
            totalBillReminders === 0 ? "Bill reminder feature not being utilized" : "Bill management needs attention",
            activeUsers < totalUsers * 0.5 ? "User engagement needs improvement" : "Maintain current engagement levels"
          ],
          recommendations: [
            "Implement user onboarding tutorials",
            "Add spending categorization features",
            "Create savings challenge programs"
          ]
        }
      };

      setAnalytics(directData);
    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert('Error', 'Failed to load analytics data. Please check your connection.');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const generatePDF = async () => {
    if (!analytics) return;
    try {
      setPdfGenerating(true);
      
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
              .section { margin: 30px 0; }
              .metric { background: #f5f5f5; padding: 20px; margin: 10px 0; border-radius: 8px; }
              .metric-value { font-size: 24px; font-weight: bold; color: #007AFF; }
              .insight-item { margin: 10px 0; padding: 10px; border-left: 4px solid #007AFF; background: #f8f9fa; }
            </style>
          </head>
          <body>
            <h1>Financial Analytics Report</h1>
            <div class="section">
              <h2>Platform Overview</h2>
              <div class="metric">
                <div>Total Users: <span class="metric-value">${analytics.overview.totalUsers}</span></div>
                <div>Active Users: <span class="metric-value">${analytics.overview.activeUsers}</span></div>
                <div>Transactions: <span class="metric-value">${analytics.overview.totalTransactions}</span></div>
                <div>Transaction Volume: <span class="metric-value">KSH ${analytics.overview.transactionVolume.toLocaleString()}</span></div>
              </div>
            </div>
            <div class="section">
              <h2>Financial Health</h2>
              <div class="metric">
                <div>Goal Completion: <span class="metric-value">${analytics.financialHealth.goalCompletionRate}%</span></div>
                <div>Bill Reminder Completion: <span class="metric-value">${analytics.financialHealth.billReminderCompletionRate}%</span></div>
              </div>
            </div>
            <div class="section">
              <h2>Strategic Insights</h2>
              <h3>Top Performing Areas</h3>
              ${analytics.insights.topPerforming.map(insight => `<div class="insight-item">${insight}</div>`).join('')}
              <h3>Areas for Improvement</h3>
              ${analytics.insights.areasOfConcern.map(insight => `<div class="insight-item">${insight}</div>`).join('')}
              <h3>Recommended Actions</h3>
              ${analytics.insights.recommendations.map(insight => `<div class="insight-item">${insight}</div>`).join('')}
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
      Alert.alert('Success', 'PDF report generated successfully!');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to generate PDF report: ' + error.message);
    } finally {
      setPdfGenerating(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading Analytics...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Financial Analytics</Text>
            <Text style={[styles.subtitle, { color: colors.subtitle }]}>
              Real-time platform insights and performance metrics
            </Text>
            {analytics && (
              <Text style={[styles.userCount, { color: colors.primary }]}>
                {analytics.overview.totalUsers} Total Users • {analytics.overview.activeUsers} Active
              </Text>
            )}
          </View>
        </View>

        {!analytics ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={64} color={colors.subtitle} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No analytics data available</Text>
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={loadAnalytics}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Platform Overview */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Platform Overview</Text>
              <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
                  <Text style={[styles.metricValue, { color: colors.primary }]}>
                    {analytics.overview.totalUsers}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.subtitle }]}>Total Users</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
                  <Text style={[styles.metricValue, { color: colors.primary }]}>
                    {analytics.overview.activeUsers}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.subtitle }]}>Active Users</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
                  <Text style={[styles.metricValue, { color: colors.primary }]}>
                    {analytics.overview.totalTransactions}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.subtitle }]}>Transactions</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
                  <Text style={[styles.metricValue, { color: colors.primary }]}>
                    KSH {analytics.overview.transactionVolume.toLocaleString()}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.subtitle }]}>Transaction Volume</Text>
                </View>
              </View>
            </View>

            {/* Financial Health */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Financial Health</Text>
              <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
                  <Text style={[styles.metricValue, { 
                    color: analytics.financialHealth.goalCompletionRate >= 50 ? '#16a34a' : '#dc2626' 
                  }]}>
                    {analytics.financialHealth.goalCompletionRate}%
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.subtitle }]}>Goal Completion</Text>
                  <Text style={[styles.metricSubtext, { color: colors.subtitle }]}>
                    {analytics.overview.completedGoals} of {analytics.overview.totalGoals} goals
                  </Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: colors.cardBackground }]}>
                  <Text style={[styles.metricValue, { 
                    color: analytics.financialHealth.billReminderCompletionRate >= 50 ? '#16a34a' : '#dc2626' 
                  }]}>
                    {analytics.financialHealth.billReminderCompletionRate}%
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.subtitle }]}>Bill Reminders</Text>
                  <Text style={[styles.metricSubtext, { color: colors.subtitle }]}>
                    {analytics.overview.upcomingBillReminders} upcoming
                  </Text>
                </View>
              </View>
            </View>

            {/* Strategic Insights */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Strategic Insights</Text>
              
              <View style={[styles.insightCard, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.insightTitle, { color: colors.text }]}>Top Performing Areas</Text>
                {analytics.insights.topPerforming.map((insight, index) => (
                  <View key={index} style={styles.insightItem}>
                    <View style={[styles.bullet, { backgroundColor: '#16a34a' }]} />
                    <Text style={[styles.insightText, { color: colors.text }]}>{insight}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.insightCard, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.insightTitle, { color: colors.text }]}>Areas for Improvement</Text>
                {analytics.insights.areasOfConcern.map((insight, index) => (
                  <View key={index} style={styles.insightItem}>
                    <View style={[styles.bullet, { backgroundColor: '#dc2626' }]} />
                    <Text style={[styles.insightText, { color: colors.text }]}>{insight}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.insightCard, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.insightTitle, { color: colors.text }]}>Recommended Actions</Text>
                {analytics.insights.recommendations.map((insight, index) => (
                  <View key={index} style={styles.insightItem}>
                    <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.insightText, { color: colors.text }]}>{insight}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Floating Export PDF Button */}
      {analytics && (
        <TouchableOpacity
          style={[
            styles.floatingExportButton,
            { backgroundColor: colors.primary, opacity: pdfGenerating ? 0.6 : 1 }
          ]}
          onPress={generatePDF}
          disabled={pdfGenerating || !analytics}
        >
          {pdfGenerating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={28} color="#fff" />
              <Text style={styles.floatingExportButtonText}>Export PDF</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  header: { marginBottom: spacing.lg },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 16, marginBottom: 4 },
  userCount: { fontSize: 14, fontWeight: '600' },
  loadingText: { marginTop: spacing.md, fontSize: 16 },
  emptyState: { alignItems: 'center', padding: spacing.xl, paddingVertical: spacing.xxl },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.md, textAlign: 'center' },
  retryButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  retryButtonText: { color: '#fff', fontWeight: '600' },

  // Sections
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: spacing.md },

  // Metrics Grid
  metricsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: spacing.md 
  },
  metricCard: { 
    flex: 1, 
    minWidth: '45%',
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  metricValue: { 
    fontSize: 24, 
    fontWeight: '700', 
    marginBottom: spacing.xs 
  },
  metricLabel: { 
    fontSize: 14, 
    fontWeight: '600',
    textAlign: 'center'
  },
  metricSubtext: {
    fontSize: 12,
    marginTop: spacing.xs,
    textAlign: 'center'
  },

  // Insight Cards
  insightCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: spacing.md,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },

  // Floating Export Button
  floatingExportButton: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 50,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 100,
  },
  floatingExportButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: spacing.sm,
  },
});