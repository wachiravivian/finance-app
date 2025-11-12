// src/screens/LoginScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Pressable,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../supabaseClient";
import { colors, spacing, radius } from "../constants/styles";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
      pointerEvents="box-none"
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled" // 👈 let taps pass to inputs
      >
        <View style={styles.card}>
          <Text style={styles.title}>Welcome Back!</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
          />

          <Pressable style={({ pressed }) => [styles.button, pressed && { opacity: 0.9 }]} onPress={handleLogin}>
            <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign In"}</Text>
          </Pressable>

          <Text style={styles.link} onPress={() => navigation.navigate("ForgotPassword")}>
            Forgot Password?
          </Text>

          <View style={{ height: spacing.sm }} />
          <Text style={styles.footer}>
            Don’t have an account?{" "}
            <Text style={styles.footerLink} onPress={() => navigation.navigate("Signup")}>
              Sign Up
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center" },
  subtitle: { color: colors.muted, textAlign: "center", marginTop: 6, marginBottom: spacing.lg },
  label: { fontWeight: "700", color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.md,
    backgroundColor: "#fff",
  },
  button: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "800" },
  link: {
    textAlign: "center",
    marginTop: spacing.md,
    color: colors.muted,
    fontWeight: "700",
  },
  footer: { textAlign: "center", color: colors.muted, marginTop: spacing.md },
  footerLink: { color: colors.primary, fontWeight: "800" },
});
