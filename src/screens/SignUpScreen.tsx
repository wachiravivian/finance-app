// src/screens/SignupScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { AuthStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../supabaseClient";
import { colors, spacing, radius } from "../constants/styles";

type Props = NativeStackScreenProps<AuthStackParamList, "Signup">;

export default function SignupScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [secure, setSecure] = useState(true);
  const [secure2, setSecure2] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const phoneRegex = /^[0-9+\-\s()]{7,}$/; // simple allowlist; tweak to your locale if needed

  async function handleSignup() {
    setErr(null);
    const e = email.trim();
    const p = password;
    const c = confirm;
    const n = fullName.trim();
    const ph = phone.trim();

    if (!n) return setErr("Please enter your full name.");
    if (!ph || !phoneRegex.test(ph)) return setErr("Please enter a valid phone number.");
    if (!e) return setErr("Please enter your email.");
    if (!p || p.length < 6) return setErr("Password must be at least 6 characters.");
    if (p !== c) return setErr("Passwords do not match.");

    try {
      setLoading(true);
      // Save phone & name in user metadata
      const { error } = await supabase.auth.signUp({
        email: e,
        password: p,
        options: {
          data: { full_name: n, phone: ph },
        },
      });

      if (error) {
        setErr(error.message);
      } else {
        // If email confirmations are on, user may need to confirm before session exists.
        // The DB trigger will still create the profile row with metadata when the user is confirmed.
        navigation.navigate("Login");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F7FAFC" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.centerWrap}>
        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join us and start managing your finances</Text>

          {/* Full Name */}
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputWrap}>
            <Icon name="account-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Enter your full name"
              value={fullName}
              onChangeText={setFullName}
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Phone Number */}
          <Text style={[styles.label, { marginTop: spacing.md }]}>Phone Number</Text>
          <View style={styles.inputWrap}>
            <Icon name="phone-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Enter your phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Email */}
          <Text style={[styles.label, { marginTop: spacing.md }]}>Email</Text>
          <View style={styles.inputWrap}>
            <Icon name="email-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Password */}
          <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
          <View style={styles.inputWrap}>
            <Icon name="lock-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Create a password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secure}
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />
            <Pressable onPress={() => setSecure((s) => !s)} hitSlop={12}>
              <Icon name={secure ? "eye-off-outline" : "eye-outline"} size={20} color="#6B7280" />
            </Pressable>
          </View>

          {/* Confirm */}
          <Text style={[styles.label, { marginTop: spacing.md }]}>Confirm Password</Text>
          <View style={styles.inputWrap}>
            <Icon name="lock-check-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Confirm your password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={secure2}
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />
            <Pressable onPress={() => setSecure2((s) => !s)} hitSlop={12}>
              <Icon name={secure2 ? "eye-off-outline" : "eye-outline"} size={20} color="#6B7280" />
            </Pressable>
          </View>

          {/* Error */}
          {err ? <Text style={styles.error}>{err}</Text> : null}

          {/* Create Account */}
          <Pressable
            onPress={handleSignup}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
          </Pressable>

          <View style={styles.bottomRow}>
            <Text style={{ color: "#6B7280" }}>Already have an account?</Text>
            <Pressable onPress={() => navigation.navigate("Login")} hitSlop={8}>
              <Text style={styles.linkStrong}>Sign In</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const MAX_WIDTH = 720;

const styles = StyleSheet.create({
  centerWrap: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: MAX_WIDTH,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    color: colors.text,
  },
  subtitle: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 6,
    marginBottom: spacing.lg,
  },
  label: { fontWeight: "700", color: colors.text, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    height: 48,
  },
  input: { flex: 1, paddingVertical: 10, color: colors.text },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: "#1976D2",
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  bottomRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8 as any,
  },
  linkStrong: { color: "#1976D2", fontWeight: "700", marginLeft: 6 },
  error: { color: "#B00020", marginTop: 8, fontSize: 13 },
});
