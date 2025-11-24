import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { 
  NavigationContainer, 
  DarkTheme, 
  DefaultTheme, 
  ThemeProvider as NavigationThemeProvider 
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { 
  createDrawerNavigator, 
  DrawerContentScrollView, 
  DrawerItemList, 
  DrawerItem,
  DrawerNavigationProp 
} from "@react-navigation/drawer";
import { RouteProp } from "@react-navigation/native";

import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/styles";
import { supabase } from "../supabaseClient";
import { useAuth } from "../hooks/useAuth";

// Screens - Make sure these are properly typed in their own files
import DashboardScreen from "../screens/DashboardScreen";
import BudgetsScreen from "../screens/BudgetsScreen";
import GoalsScreen from "../screens/GoalsScreen";
import RemindersScreen from "../screens/RemindersScreen";
import TransactionsScreen from "../screens/TransactionsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import AdminUsersScreen from "../screens/AdminUsersScreen";
import AdminReportsScreen from "../screens/AdminReportsScreen";
import AdminAddUserScreen from "../screens/AdminAddUserScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignUpScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import InsightsScreen from "../screens/InsightsScreen";

const Drawer = createDrawerNavigator<DrawerParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

// Define parameter lists
export type AuthStackParamList = {
Login: { prefillEmail?: string } | undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

export type DrawerParamList = {
  Dashboard: undefined;
  Budgets: undefined;
  Goals: undefined;
  Reminders: undefined;
  Transactions: undefined;
  Insights: undefined;
  Profile: undefined;
  AdminDashboard: undefined;
  AdminUsers: undefined;
  AdminReports: undefined;
  AdminAddUser: undefined;
};

export type RootStackParamList = {
  AuthStack: undefined;
  AppDrawer: undefined;
};

// Define proper types for drawer content
type CustomDrawerContentProps = {
  navigation: DrawerNavigationProp<DrawerParamList>;
};

// Create properly typed screen components that wrap your actual screens
const TypedDashboardScreen = (props: any) => <DashboardScreen {...props} />;
const TypedBudgetsScreen = (props: any) => <BudgetsScreen {...props} />;
const TypedGoalsScreen = (props: any) => <GoalsScreen {...props} />;
const TypedRemindersScreen = (props: any) => <RemindersScreen {...props} />;
const TypedTransactionsScreen = (props: any) => <TransactionsScreen {...props} />;
const TypedInsightsScreen = (props: any) => <InsightsScreen {...props} />;
const TypedProfileScreen = (props: any) => <ProfileScreen {...props} />;
const TypedAdminDashboardScreen = (props: any) => <AdminDashboardScreen {...props} />;
const TypedAdminUsersScreen = (props: any) => <AdminUsersScreen {...props} />;
const TypedAdminReportsScreen = (props: any) => <AdminReportsScreen {...props} />;
const TypedAdminAddUserScreen = (props: any) => <AdminAddUserScreen {...props} />;
const TypedLoginScreen = (props: any) => <LoginScreen {...props} />;
const TypedSignupScreen = (props: any) => <SignupScreen {...props} />;
const TypedForgotPasswordScreen = (props: any) => <ForgotPasswordScreen {...props} />;
const TypedResetPasswordScreen = (props: any) => <ResetPasswordScreen {...props} />;

function CustomDrawerContent(props: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const email = profile?.email ?? "—";
  const role = (profile?.role ?? "user").toUpperCase();

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: colors.background }}>
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
      }}>
        <View style={{
          width: 42, 
          height: 42, 
          borderRadius: 21,
          backgroundColor: colors.primary,
          alignItems: "center", 
          justifyContent: "center",
        }}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>
            {(email?.[0] ?? "U").toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>{email}</Text>
          <Text style={{ color: colors.subtitle, fontSize: 12 }}>{role}</Text>
        </View>
      </View>
      <DrawerItemList {...props} />
      <DrawerItem
        label="Log out"
        onPress={handleSignOut}
        labelStyle={{ fontWeight: "700", color: colors.danger }}
      />
    </DrawerContentScrollView>
  );
}

function UserDrawerNavigator() {
  const { colors } = useTheme();
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBackground },
        headerTintColor: colors.text,
        drawerStyle: { backgroundColor: colors.background },
        drawerLabelStyle: { color: colors.text },
      }}
    >
      <Drawer.Screen name="Dashboard" component={TypedDashboardScreen} />
      <Drawer.Screen name="Budgets" component={TypedBudgetsScreen} />
      <Drawer.Screen name="Goals" component={TypedGoalsScreen} />
      <Drawer.Screen name="Reminders" component={TypedRemindersScreen} />
      <Drawer.Screen name="Transactions" component={TypedTransactionsScreen} />
      <Drawer.Screen 
        name="Insights" 
        component={TypedInsightsScreen} 
        options={{ title: "Financial Insights" }} 
      />
      <Drawer.Screen name="Profile" component={TypedProfileScreen} />
    </Drawer.Navigator>
  );
}

function AdminDrawerNavigator() {
  const { colors } = useTheme();
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBackground },
        headerTintColor: colors.text,
        drawerStyle: { backgroundColor: colors.background },
        drawerLabelStyle: { color: colors.text },
      }}
    >
      <Drawer.Screen name="AdminDashboard" component={TypedAdminDashboardScreen} />
      <Drawer.Screen name="AdminUsers" component={TypedAdminUsersScreen} />
      <Drawer.Screen name="AdminReports" component={TypedAdminReportsScreen} />
      <Drawer.Screen name="AdminAddUser" component={TypedAdminAddUserScreen} />
      <Drawer.Screen name="Profile" component={TypedProfileScreen} />
    </Drawer.Navigator>
  );
}

function AppDrawerNavigator() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDrawerNavigator /> : <UserDrawerNavigator />;
}

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={TypedLoginScreen} />
      <AuthStack.Screen name="Signup" component={TypedSignupScreen} />
      <AuthStack.Screen name="ForgotPassword" component={TypedForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={TypedResetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

// Root stack
export default function AppNavigator() {
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const { isDark, colors } = useTheme();

  useEffect(() => {
    let mounted = true;
    
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setSignedIn(!!session);
          setChecking(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (mounted) {
          setChecking(false);
        }
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSignedIn(!!session);
        if (!checking) {
          setChecking(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <View style={{ 
        flex: 1, 
        alignItems: "center", 
        justifyContent: "center", 
        backgroundColor: colors.background 
      }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.text }}>
          Checking authentication...
        </Text>
      </View>
    );
  }

  // Create navigation theme synced with your ThemeContext
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.cardBackground,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationThemeProvider value={navTheme}>
      <NavigationContainer theme={navTheme}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {signedIn ? (
            <RootStack.Screen name="AppDrawer" component={AppDrawerNavigator} />
          ) : (
            <RootStack.Screen name="AuthStack" component={AuthStackNavigator} />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </NavigationThemeProvider>
  );
}