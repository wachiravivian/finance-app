import React from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native";
import { ProgressBar } from "react-native-paper";
import { PieChart } from "react-native-chart-kit";
import { colors, spacing, radius, typography } from "../constants/styles";
import { formatCurrency } from "../utils/format";
import DashboardBadges from "../components/DashboardBadges";


const screenWidth = Dimensions.get("window").width - 40;

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Dashboard</Text>

      {/* NEW: badges row */}
      <DashboardBadges />

      {/* ...your existing dashboard content/charts/cards... */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "800", color: "#0f172a", marginBottom: 12 },
});