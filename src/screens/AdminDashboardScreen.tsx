// src/screens/AdminDashboardScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { DrawerScreenProps } from "@react-navigation/drawer";
import { DrawerParamList } from "../navigation/AppNavigator";
import { spacing, radius } from "../constants/styles";
import { useTheme } from "../hooks/useTheme";
import { supabase } from "../supabaseClient";

type Props = DrawerScreenProps<DrawerParamList, "AdminDashboard">;

type Stats = {
  users: number;
  reports: number;
  active: number;
};

export default function AdminDashboardScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats>({ users: 0, reports: 0, active: 0 });

  const loadStats = async () => {
    try {
      setLoading(true);

      // First, try to call Edge Function for stats
      const { data, error } = await supabase.functions.invoke("admin-get-stats");

      if (error) {
        console.warn("Edge function failed, using direct database queries:", error.message);
        throw new Error("Edge function unavailable");
      }

      if (!data) {
        throw new Error("No data returned from admin-get-stats");
      }

      // Handle potential nulls gracefully
      setStats({
        users: data.users ?? 0,
        reports: data.reports ?? 0,
        active: data.active ?? 0,
      });

    } catch (err: any) {
      console.log("Using fallback database queries:", err.message);
      
      // Fallback: Use direct database queries
      try {
        // Get total users count
        const { count: usersCount, error: usersError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (usersError) {
          console.error("Error fetching users count:", usersError);
          throw usersError;
        }

        // Get total reports count (adjust table name as needed)
        const { count: reportsCount, error: reportsError } = await supabase
          .from('reports') // Replace with your actual reports table name
          .select('*', { count: 'exact', head: true });

        if (reportsError) {
          console.warn("Could not fetch reports count:", reportsError);
          // Continue without throwing - reports might not exist yet
        }

        // For active users, you might want to define what "active" means
        // This is a simple fallback - adjust based on your business logic
        const { count: activeUsersCount, error: activeError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'); // Adjust this filter based on your user status field

        if (activeError) {
          console.warn("Could not fetch active users count:", activeError);
          // Fallback to total users if active count fails
        }

        setStats({
          users: usersCount || 0,
          reports: reportsCount || 0,
          active: activeUsersCount || usersCount || 0, // Fallback to total users if active count unavailable
        });

      } catch (fallbackError: any) {
        console.error("All fallback methods failed:", fallbackError);
        Alert.alert(
          "Connection Error", 
          "Unable to load dashboard data. Please check your connection and try again."
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.subtitle, marginTop: 10 }}>Loading admin data...</Text>
      </View>
    );
  }

  return (
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
      <Text style={[styles.title, { color: colors.text }]}>Admin Dashboard</Text>
      <Text style={[styles.subtitle, { color: colors.subtitle }]}>
        Overview of platform activity
      </Text>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.subtitle }]}>Total Users</Text>
        <Text style={[styles.cardValue, { color: colors.primary }]}>{stats.users}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.subtitle }]}>Total Reports</Text>
        <Text style={[styles.cardValue, { color: colors.primary }]}>{stats.reports}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.subtitle }]}>Active Users</Text>
        <Text style={[styles.cardValue, { color: colors.primary }]}>{stats.active}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  center: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  title: { 
    fontSize: 24, 
    fontWeight: "700", 
    marginBottom: spacing.sm 
  },
  subtitle: { 
    fontSize: 14, 
    marginBottom: spacing.lg 
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardLabel: { 
    fontSize: 14, 
    fontWeight: "600" 
  },
  cardValue: { 
    fontSize: 28, 
    fontWeight: "800", 
    marginTop: spacing.sm 
  },
});