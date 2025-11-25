// src/screens/LoginScreen.tsx
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
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { AuthStackParamList } from "../navigation/AppNavigator";
import { enhancedSignIn } from "../supabaseClient";
import { colors, spacing, radius } from "../constants/styles";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ route, navigation }: Props) {
  const prefillEmail = route.params?.prefillEmail ?? "";

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleLogin = async () => {
    setErrors({});
    if (!email.trim()) return setErrors({ email: "Please enter your email" });
    if (!password) return setErrors({ password: "Please enter your password" });

    try {
      setLoading(true);
      const result = await enhancedSignIn(email.trim().toLowerCase(), password);
      if (result.user) Alert.alert("✅ Success", "You are now logged in!");
    } catch (error: any) {
      Alert.alert("Login Failed", error.message || "Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>

          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.moneySmart}>MoneySmart</Text>

            <View style={styles.logoContainer}>
              <Icon name="finance" size={40} color="#fff" />
            </View>

            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to manage your finances smartly</Text>
          </View>

          {/* FORM */}
          <View style={styles.form}>
            <InputField
              icon="email-outline"
              placeholder="Email"
              value={email}
              onChange={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              editable={!loading}
            />
            <InputField
              icon="lock-outline"
              placeholder="Password"
              value={password}
              onChange={setPassword}
              secureTextEntry={secure}
              toggleSecure={() => setSecure(!secure)}
              error={errors.password}
              editable={!loading}
              onSubmit={handleLogin}
            />

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
            </Pressable>
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <Pressable onPress={() => navigation.navigate("Signup")} disabled={loading}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Input Field Component
const InputField = ({
  icon,
  placeholder,
  value,
  onChange,
  error,
  editable = true,
  secureTextEntry,
  toggleSecure,
  keyboardType = "default",
  onSubmit,
  autoCapitalize,
}: any) => (
  <View style={{ marginBottom: spacing.md }}>
    <View style={[styles.inputWrap, error && styles.inputWrapError]}>
      <Icon name={icon} size={20} color="#6B7280" />
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChange}
        editable={editable}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        keyboardType={keyboardType}
        onSubmitEditing={onSubmit}
        autoCapitalize={autoCapitalize}
      />
      {toggleSecure && (
        <Pressable onPress={toggleSecure}>
          <Icon name={secureTextEntry ? "eye-off-outline" : "eye-outline"} size={22} />
        </Pressable>
      )}
    </View>
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  card: {
    backgroundColor: "#fff",
    borderRadius: radius.xl,
    padding: spacing.xl,
    elevation: 5,
  },
  header: { alignItems: "center", marginBottom: spacing.lg },
  moneySmart: {
    fontSize: 36,
    fontWeight: "900",
    color: "#8b5cf6",
    marginBottom: 10,
    letterSpacing: 1,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { color: colors.muted, fontSize: 15 },
  form: { marginBottom: spacing.lg },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 56,
  },
  inputWrapError: { borderColor: "#ef4444" },
  input: { flex: 1, marginLeft: 10 },
  errorText: { color: "#ef4444", fontSize: 12 },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: "#8b5cf6",
    borderRadius: radius.lg,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  footer: { alignItems: "center" },
  footerText: { fontSize: 14 },
  footerLink: { color: "#8b5cf6", fontWeight: "700" },
});
