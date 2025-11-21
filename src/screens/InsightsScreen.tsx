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
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase } from "../supabaseClient";
import { getMonthKey, monthRange } from "../utils/date";

type TxRow = {
  amount: number;
  direction: "credit" | "debit";
  category: string | null;
  occurred_at: string;
  method: string | null;
  counterparty: string | null;
};

type BudgetRow = {
  id: string;
  user_id: string;
  category: string;
  amount_monthly: number;
  budget_month: string;
};

type SpendingProfile = {
  type: "high_saver" | "moderate_spender" | "overspender" | "balanced";
  confidence: number;
  description: string;
  strengths: string[];
  areas_for_improvement: string[];
};

type MLRecommendation = {
  category: "savings" | "spending" | "income" | "budgeting" | "investing";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
  impact: string;
};

// Utility helpers
function titleCase(str: string) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function currency(n: number) {
  return `KES ${n.toLocaleString()}`;
}

function calculateSavingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0;
  return ((income - expenses) / income) * 100;
}

export default function InsightsScreen() {
  const [loading, setLoading] = useState(false);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [spentByCat, setSpentByCat] = useState<Record<string, number>>({});
  const [spendingProfile, setSpendingProfile] = useState<SpendingProfile | null>(null);
  const [mlRecommendations, setMlRecommendations] = useState<MLRecommendation[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<TxRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) {
        setIncome(0);
        setExpenses(0);
        setBudgets([]);
        setSpentByCat({});
        return;
      }

      const monthKey = getMonthKey();
      const { start, end } = monthRange(monthKey);

      // Load transactions for current month
      const { data: txData, error: txErr } = await supabase
        .from("transactions")
        .select("amount, direction, category, occurred_at, method, counterparty")
        .eq("user_id", userId)
        .gte("occurred_at", start)
        .lt("occurred_at", end);

      if (txErr) console.error("transactions load error:", txErr);

      const txs: TxRow[] = (txData ?? []).map((t: any) => ({
        amount: Number(t.amount ?? 0),
        direction: t.direction,
        category: t.category ?? "uncategorized",
        occurred_at: t.ts || t.occurred_at,
        method: t.method,
        counterparty: t.counterparty,
      }));

      setTransactionHistory(txs);

      // Compute totals
      let inc = 0;
      let exp = 0;
      const catMap: Record<string, number> = {};
      
      for (const t of txs) {
        if (t.direction === "credit") {
          inc += t.amount;
        } else {
          exp += t.amount;
          const key = (t.category ?? "uncategorized").toLowerCase();
          catMap[key] = (catMap[key] ?? 0) + t.amount;
        }
      }

      setIncome(inc);
      setExpenses(exp);
      setSpentByCat(catMap);

      // Load budgets
      const { data: budData, error: budErr } = await supabase
        .from("budgets")
        .select("id, user_id, category, amount_monthly, budget_month")
        .eq("user_id", userId)
        .eq("budget_month", monthKey);

      if (!budErr && budData) setBudgets(budData as BudgetRow[]);

      // Generate ML-powered insights
      const profile = analyzeSpendingProfile(inc, exp, catMap, txs);
      setSpendingProfile(profile);

      const recommendations = generateMLRecommendations(profile, inc, exp, catMap, txs);
      setMlRecommendations(recommendations);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const net = income - expenses;
  const savingsRate = calculateSavingsRate(income, expenses);

  // ML-Powered Spending Profile Analysis
  const analyzeSpendingProfile = (
    income: number,
    expenses: number,
    catMap: Record<string, number>,
    transactions: TxRow[]
  ): SpendingProfile => {
    if (income <= 0) {
      return {
        type: "balanced",
        confidence: 0.8,
        description: "No income data available yet",
        strengths: ["Starting your financial tracking journey"],
        areas_for_improvement: ["Import more transactions to get personalized insights"]
      };
    }

    const savingsRate = calculateSavingsRate(income, expenses);
    const essentialCategories = ["food", "transport", "utilities", "bill"];
    const discretionaryCategories = ["entertainment", "shopping", "dining"];
    
    let essentialSpending = 0;
    let discretionarySpending = 0;
    
    Object.entries(catMap).forEach(([category, amount]) => {
      if (essentialCategories.some(essential => category.includes(essential))) {
        essentialSpending += amount;
      } else if (discretionaryCategories.some(discretionary => category.includes(discretionary))) {
        discretionarySpending += amount;
      }
    });

    const essentialRatio = essentialSpending / expenses;
    const discretionaryRatio = discretionarySpending / expenses;
    const transactionFrequency = transactions.length;

    // ML-inspired classification rules
    if (savingsRate >= 30) {
      return {
        type: "high_saver",
        confidence: Math.min(0.9, 0.7 + (savingsRate - 30) / 50),
        description: "Excellent savings discipline with strong financial control",
        strengths: [
          `Saving ${savingsRate.toFixed(1)}% of your income`,
          "Strong financial discipline",
          "Healthy spending habits"
        ],
        areas_for_improvement: [
          "Consider investment opportunities for your savings",
          "Explore higher-yield savings accounts",
          "Review insurance and protection planning"
        ]
      };
    } else if (savingsRate >= 15) {
      return {
        type: "moderate_spender",
        confidence: 0.8,
        description: "Balanced spending with room for optimization",
        strengths: [
          `Saving ${savingsRate.toFixed(1)}% of your income`,
          "Reasonable discretionary spending",
          "Good financial awareness"
        ],
        areas_for_improvement: [
          "Reduce discretionary spending by 10-15%",
          "Set specific savings goals",
          "Track subscription services"
        ]
      };
    } else if (savingsRate >= 0) {
      return {
        type: "balanced",
        confidence: 0.75,
        description: "Living within means with limited savings",
        strengths: [
          "Living within your means",
          "Managing essential expenses well",
          "Maintaining financial stability"
        ],
        areas_for_improvement: [
          `Increase savings rate from ${savingsRate.toFixed(1)}% to 15%+`,
          "Identify and reduce non-essential expenses",
          "Create emergency fund if not available"
        ]
      };
    } else {
      return {
        type: "overspender",
        confidence: Math.min(0.9, 0.7 + Math.abs(savingsRate) / 50),
        description: "Spending exceeds income - immediate attention needed",
        strengths: [
          "Active financial tracking",
          "Awareness of spending patterns"
        ],
        areas_for_improvement: [
          `Reduce spending by ${Math.abs(savingsRate).toFixed(1)}% to break even`,
          "Create strict budget for essential categories",
          "Review recurring subscriptions and memberships",
          "Consider additional income sources"
        ]
      };
    }
  };

  // ML-Powered Recommendations
  const generateMLRecommendations = (
    profile: SpendingProfile,
    income: number,
    expenses: number,
    catMap: Record<string, number>,
    transactions: TxRow[]
  ): MLRecommendation[] => {
    const recommendations: MLRecommendation[] = [];
    const savingsRate = calculateSavingsRate(income, expenses);

    // High priority recommendations based on spending profile
    if (profile.type === "overspender") {
      recommendations.push({
        category: "spending",
        priority: "high",
        title: "Emergency Spending Control",
        description: "Your spending exceeds income by " + Math.abs(savingsRate).toFixed(1) + "%",
        action: "Freeze discretionary spending for 2 weeks",
        impact: "Immediate cash flow improvement"
      });
    }

    if (savingsRate < 20 && income > 0) {
      recommendations.push({
        category: "savings",
        priority: savingsRate < 10 ? "high" : "medium",
        title: "Boost Savings Rate",
        description: `Current savings rate: ${savingsRate.toFixed(1)}% - Target: 20%+`,
        action: "Automate 10% of income to savings account",
        impact: "Build emergency fund faster"
      });
    }

    // Category-specific recommendations
    const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    if (topCategory && topCategory[1] > income * 0.2) {
      recommendations.push({
        category: "budgeting",
        priority: "medium",
        title: `Optimize ${titleCase(topCategory[0])} Spending`,
        description: `${titleCase(topCategory[0])} consumes ${((topCategory[1] / income) * 100).toFixed(1)}% of income`,
        action: `Set budget limit for ${topCategory[0]} category`,
        impact: "Better expense distribution"
      });
    }

    // Transaction pattern analysis
    const mpesaTransactions = transactions.filter(t => t.method === "mpesa");
    if (mpesaTransactions.length > 20) {
      recommendations.push({
        category: "spending",
        priority: "medium",
        title: "Consolidate Small Transactions",
        description: `High frequency of small transactions (${mpesaTransactions.length} this month)`,
        action: "Batch similar purchases to reduce transaction fees",
        impact: "Save on transaction costs and track spending better"
      });
    }

    // Income optimization
    if (income > 0 && savingsRate > 25) {
      recommendations.push({
        category: "investing",
        priority: "medium",
        title: "Explore Investment Options",
        description: "Strong savings rate indicates capacity for investments",
        action: "Research low-risk investment vehicles",
        impact: "Potential for wealth growth"
      });
    }

    // Essential vs Discretionary analysis
    const essentialSpending = Object.entries(catMap)
      .filter(([cat]) => ["food", "transport", "utilities", "bill"].some(e => cat.includes(e)))
      .reduce((sum, [_, amount]) => sum + amount, 0);
    
    if (essentialSpending > income * 0.5) {
      recommendations.push({
        category: "budgeting",
        priority: "high",
        title: "High Essential Spending",
        description: "Essential expenses consume over 50% of income",
        action: "Review utility providers and transport options",
        impact: "Reduce fixed monthly costs"
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  };

  const exportReport = async () => {
    try {
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
              h1 { color: #0f172a; font-size: 22px; }
              h2 { margin-top: 20px; color: #334155; font-size: 18px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { text-align: left; border-bottom: 1px solid #ddd; padding: 8px; }
              .pos { color: #16a34a; }
              .neg { color: #dc2626; }
              ul { margin-top: 10px; }
              li { margin-bottom: 6px; }
              .profile-card { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 10px 0; }
              .recommendation { background: #fff; border-left: 4px solid #2563eb; padding: 10px; margin: 8px 0; }
            </style>
          </head>
          <body>
            <h1>ML-Powered Financial Insights Report</h1>
            <p><b>Month:</b> ${getMonthKey()}</p>

            <h2>Financial Summary</h2>
            <table>
              <tr><td>Income:</td><td class="pos">${currency(income)}</td></tr>
              <tr><td>Expenses:</td><td class="neg">${currency(expenses)}</td></tr>
              <tr><td>Net Savings:</td>
                <td class="${net >= 0 ? "pos" : "neg"}">${net >= 0 ? "+" : "-"}${currency(Math.abs(net))}</td></tr>
              <tr><td>Savings Rate:</td><td>${savingsRate.toFixed(1)}%</td></tr>
            </table>

            ${spendingProfile ? `
            <h2>Your Spending Profile</h2>
            <div class="profile-card">
              <h3>${titleCase(spendingProfile.type.replace('_', ' '))}</h3>
              <p><b>Confidence:</b> ${(spendingProfile.confidence * 100).toFixed(0)}%</p>
              <p>${spendingProfile.description}</p>
              
              <h4>Strengths:</h4>
              <ul>
                ${spendingProfile.strengths.map(s => `<li>${s}</li>`).join('')}
              </ul>
              
              <h4>Areas for Improvement:</h4>
              <ul>
                ${spendingProfile.areas_for_improvement.map(a => `<li>${a}</li>`).join('')}
              </ul>
            </div>
            ` : ''}

            <h2>ML-Powered Recommendations</h2>
            ${mlRecommendations.map(rec => `
              <div class="recommendation">
                <h4>${rec.title} (${rec.priority.toUpperCase()} Priority)</h4>
                <p><b>Description:</b> ${rec.description}</p>
                <p><b>Recommended Action:</b> ${rec.action}</p>
                <p><b>Expected Impact:</b> ${rec.impact}</p>
              </div>
            `).join('')}

            <h2>Spending by Category</h2>
            <table>
              ${Object.entries(spentByCat)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cat, amt]) => `<tr><td>${titleCase(cat)}</td><td>${currency(amt)}</td></tr>`)
                .join("")}
            </table>
          </body>
        </html>
      `;

      if (Platform.OS === "web") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ unit: "pt", format: "a4" });
        await pdf.html(html, {
          callback: function (pdf) {
            pdf.save(`ML_Financial_Insights_${new Date().toISOString().slice(0, 10)}.pdf`);
          },
          margin: [20, 20, 20, 20],
          autoPaging: "text",
        });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        } else {
          Alert.alert("PDF Saved", `Saved at: ${uri}`);
        }
      }
    } catch (err) {
      console.error("PDF generation error:", err);
      Alert.alert("Error", "Could not generate PDF.");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "#dc2626";
      case "medium": return "#d97706";
      case "low": return "#16a34a";
      default: return "#64748b";
    }
  };

  const getProfileColor = (profileType: string) => {
    switch (profileType) {
      case "high_saver": return "#16a34a";
      case "moderate_spender": return "#d97706";
      case "balanced": return "#2563eb";
      case "overspender": return "#dc2626";
      default: return "#64748b";
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.title}>ML-Powered Financial Insights</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Analyzing your financial patterns...</Text>
        </View>
      ) : (
        <>
          {/* Financial Summary */}
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
            <Text style={styles.savingsRate}>
              Savings Rate: {savingsRate.toFixed(1)}%
            </Text>
          </View>

          {/* ML Spending Profile */}
          {spendingProfile && (
            <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: getProfileColor(spendingProfile.type) }]}>
              <Text style={styles.sectionTitle}>Your Spending Profile</Text>
              <View style={styles.profileHeader}>
                <Text style={[styles.profileType, { color: getProfileColor(spendingProfile.type) }]}>
                  {titleCase(spendingProfile.type.replace('_', ' '))}
                </Text>
                <Text style={styles.confidence}>
                  {(spendingProfile.confidence * 100).toFixed(0)}% Confidence
                </Text>
              </View>
              <Text style={styles.profileDescription}>{spendingProfile.description}</Text>
              
              <View style={styles.strengthsSection}>
                <Text style={styles.subsectionTitle}>Strengths</Text>
                {spendingProfile.strengths.map((strength, index) => (
                  <Text key={index} style={styles.strengthItem}>✓ {strength}</Text>
                ))}
              </View>

              <View style={styles.improvementSection}>
                <Text style={styles.subsectionTitle}>Areas for Improvement</Text>
                {spendingProfile.areas_for_improvement.map((area, index) => (
                  <Text key={index} style={styles.improvementItem}>• {area}</Text>
                ))}
              </View>
            </View>
          )}

          {/* ML Recommendations */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personalized Recommendations</Text>
            {mlRecommendations.length === 0 ? (
              <Text style={styles.muted}>Import more transactions to get ML-powered insights.</Text>
            ) : (
              mlRecommendations.map((rec, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.recommendationCard,
                    { borderLeftColor: getPriorityColor(rec.priority) }
                  ]}
                >
                  <View style={styles.recommendationHeader}>
                    <Text style={styles.recommendationTitle}>{rec.title}</Text>
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(rec.priority) }]}>
                      <Text style={styles.priorityText}>{rec.priority.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.recommendationDesc}>{rec.description}</Text>
                  <Text style={styles.recommendationAction}>
                    <Text style={styles.bold}>Action:</Text> {rec.action}
                  </Text>
                  <Text style={styles.recommendationImpact}>
                    <Text style={styles.bold}>Impact:</Text> {rec.impact}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Top Categories */}
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
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryName}>{titleCase(cat)}</Text>
                      <Text style={styles.categoryPercentage}>
                        {income > 0 ? `${((amt / income) * 100).toFixed(1)}% of income` : ''}
                      </Text>
                    </View>
                    <Text style={styles.categoryAmount}>{currency(amt)}</Text>
                  </View>
                ))
            )}
          </View>

          {/* Export button */}
          <TouchableOpacity style={styles.exportBtn} onPress={exportReport}>
            <Text style={styles.exportText}>
              {Platform.OS === "web" ? "Download ML Insights Report" : "Export ML Insights"}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  title: { fontSize: 26, fontWeight: "800", color: "#0f172a", marginBottom: 16 },
  center: { alignItems: "center", justifyContent: "center", padding: 40 },
  loadingText: { marginTop: 12, color: "#64748b", fontSize: 14 },
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  label: { color: "#64748b", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  val: { fontSize: 18, fontWeight: "800" },
  big: { fontSize: 22, fontWeight: "800" },
  savingsRate: { color: "#64748b", fontSize: 14, marginTop: 4 },
  sectionTitle: { fontWeight: "800", color: "#0f172a", marginBottom: 16, fontSize: 18 },
  muted: { color: "#64748b", fontStyle: "italic" },
  
  // Profile Styles
  profileHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  profileType: { fontSize: 16, fontWeight: "800" },
  confidence: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  profileDescription: { color: "#334155", marginBottom: 16, lineHeight: 20 },
  strengthsSection: { marginBottom: 12 },
  improvementSection: { marginBottom: 8 },
  subsectionTitle: { fontWeight: "700", color: "#0f172a", marginBottom: 8, fontSize: 14 },
  strengthItem: { color: "#16a34a", marginBottom: 4, fontSize: 13 },
  improvementItem: { color: "#dc2626", marginBottom: 4, fontSize: 13 },
  
  // Recommendation Styles
  recommendationCard: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  recommendationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  recommendationTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", flex: 1 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  priorityText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  recommendationDesc: { color: "#334155", fontSize: 13, marginBottom: 6, lineHeight: 18 },
  recommendationAction: { color: "#475569", fontSize: 12, marginBottom: 2 },
  recommendationImpact: { color: "#475569", fontSize: 12 },
  bold: { fontWeight: "700" },
  
  // Category Styles
  categoryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  categoryInfo: { flex: 1 },
  categoryName: { fontWeight: "600", color: "#0f172a", fontSize: 14 },
  categoryPercentage: { color: "#64748b", fontSize: 12 },
  categoryAmount: { fontWeight: "600", color: "#0f172a" },
  
  // Export Button
  exportBtn: {
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  exportText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});