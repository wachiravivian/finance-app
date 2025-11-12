// src/navigation/AppNavigator.tsx
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
  type DrawerContentComponentProps,
} from "@react-navigation/drawer";

import { colors, spacing } from "../constants/styles";
import { supabase } from "../supabaseClient";
import { useAuth } from "../hooks/useAuth";

// Screens (app)
import DashboardScreen from "../screens/DashboardScreen";
import BudgetsScreen from "../screens/BudgetsScreen";
import GoalsScreen from "../screens/GoalsScreen";
import RemindersScreen from "../screens/RemindersScreen";
import TransactionsScreen from "../screens/TransactionsScreen";
import PayScreen from "../screens/PayScreen";
import ProfileScreen from "../screens/ProfileScreen";
import GoalDetailScreen from "../screens/GoalDetailScreen";

// Admin screens
import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import AdminUsersScreen from "../screens/AdminUsersScreen";
import AdminReportsScreen from "../screens/AdminReportsScreen";
import AdminAddUserScreen from "../screens/AdminAddUserScreen";

// Auth screens
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignUpScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";

// ✅ Direct (default) import for Insights — no lazy, no wrapper
import InsightsScreen from "../screens/InsightsScreen";

// ---------- Types ----------
export type DrawerParamList = {
  // user routes
  Dashboard: undefined;
  Budgets: undefined;
  Goals: undefined;
  Reminders: undefined;
  Transactions: undefined;
  Insights: undefined;
  Pay: undefined;
  Profile: undefined;

  // admin routes
  Admin: undefined;
  AdminUsers: undefined;
  AdminReports: undefined;
  AdminAddUser: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

export type RootStackParamList = {
  AppDrawer: undefined;
  GoalDetail: { goalId: string };
  AuthStack: undefined;
};

// ---------- Navigators ----------
const Drawer = createDrawerNavigator<DrawerParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

// ---------- Custom Drawer Content ----------
function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { profile } = useAuth();
  const email = profile?.email ?? "—";
  const role = (profile?.role ?? "user").toUpperCase();

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <DrawerContentScrollView {...props}>
      {/* Profile header */}
      <View style={styles.profileBox}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{(email?.[0] ?? "U").toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
          <Text style={styles.profileRole}>{role}</Text>
        </View>
      </View>

      {/* Default drawer items */}
      <DrawerItemList {...props} />

      {/* Logout button */}
      <View style={{ marginTop: spacing.md }}>
        <DrawerItem
          label="Log out"
          onPress={handleSignOut}
          labelStyle={{ fontWeight: "700", color: "#B00020" }}
        />
      </View>
    </DrawerContentScrollView>
  );
}

// ---------- Drawer Stacks ----------
function AppDrawerNavigator() {
  const { isAdmin } = useAuth();

  if (isAdmin) {
    // Admin-only menu
    return (
      <Drawer.Navigator
        key="admin"
        initialRouteName="Admin"
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: colors.text,
        }}
      >
        <Drawer.Screen name="Admin" component={AdminDashboardScreen} options={{ title: "Admin Dashboard" }} />
        <Drawer.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: "Users" }} />
        <Drawer.Screen name="AdminReports" component={AdminReportsScreen} options={{ title: "Reports" }} />
        <Drawer.Screen name="AdminAddUser" component={AdminAddUserScreen} options={{ title: "Add User" }} />
        <Drawer.Screen name="Profile" component={ProfileScreen} />
      </Drawer.Navigator>
    );
  }

  // Regular user menu
  return (
    <Drawer.Navigator
      key="user"
      initialRouteName="Dashboard"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: colors.text,
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen name="Budgets" component={BudgetsScreen} />
      <Drawer.Screen name="Goals" component={GoalsScreen} />
      <Drawer.Screen name="Reminders" component={RemindersScreen} />
      <Drawer.Screen name="Transactions" component={TransactionsScreen} />
      {/* ✅ Use the imported InsightsScreen directly */}
      <Drawer.Screen name="Insights" component={InsightsScreen} />
      <Drawer.Screen name="Pay" component={PayScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
    </Drawer.Navigator>
  );
}

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

// ---------- Root ----------
export default function AppNavigator() {
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSignedIn(!!data.session);
      setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });

    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator />
      </View>
    );
  }

  const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: "#fff" } };

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator>
        {signedIn ? (
          <>
            <RootStack.Screen name="AppDrawer" component={AppDrawerNavigator} options={{ headerShown: false }} />
            <RootStack.Screen name="GoalDetail" component={GoalDetailScreen} options={{ title: "Goal Details" }} />
          </>
        ) : (
          <RootStack.Screen name="AuthStack" component={AuthStackNavigator} options={{ headerShown: false }} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  profileBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomColor: "#EEE",
    borderBottomWidth: 1,
    marginBottom: spacing.xs,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800" },
  profileEmail: { color: colors.text, fontWeight: "800" },
  profileRole: { color: "#64748b", fontSize: 12, marginTop: 2 },
});
