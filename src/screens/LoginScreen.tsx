// src/screens/LoginScreen.tsx
import React, { useState, useEffect } from "react";
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
      if (result.user) {
        Alert.alert("✅ Success", "You are now logged in!");
        // Navigate to your main app screen here
      }
    } catch (error: any) {
      Alert.alert("Login Failed", error.message || "Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Icon name="finance" size={40} color="#fff" />
            </View>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          {/* Form */}
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
              toggleSecure={() => setSecure((s) => !s)}
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
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign In</Text>
              )}
            </Pressable>
          </View>

          {/* Footer */}
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

// Reusable InputField component
type InputFieldProps = {
  icon: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  editable?: boolean;
  secureTextEntry?: boolean;
  toggleSecure?: () => void;
  keyboardType?: any;
  onSubmit?: () => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

const InputField: React.FC<InputFieldProps> = ({
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
}) => (
  <View style={{ marginBottom: spacing.md }}>
    <View style={[styles.inputWrap, error && styles.inputWrapError]}>
      <Icon name={icon} size={20} color="#6B7280" style={{ marginRight: spacing.sm }} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
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
        <Pressable onPress={toggleSecure} hitSlop={12} disabled={!editable}>
          <Icon name={secureTextEntry ? "eye-off-outline" : "eye-outline"} size={22} color="#6B7280" />
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
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  header: { alignItems: "center", marginBottom: spacing.lg },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 6,
  },
  title: { fontSize: 32, fontWeight: "800", color: "#8b5cf6", marginBottom: spacing.xs },
  subtitle: { color: colors.muted, textAlign: "center", fontSize: 16, marginBottom: spacing.md },
  form: { marginBottom: spacing.lg },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(229, 231, 235, 0.8)",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: "#fff",
    height: 56,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputWrapError: { borderColor: "#ef4444", backgroundColor: "#fef2f2" },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  errorText: { color: "#ef4444", fontSize: 12, marginTop: spacing.xs, marginLeft: spacing.sm },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: "#8b5cf6",
    borderRadius: radius.lg,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 6,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.6 },
  footer: { alignItems: "center", marginTop: spacing.lg },
  footerText: { color: colors.muted, fontSize: 14, marginBottom: spacing.xs },
  footerLink: { color: "#8b5cf6", fontWeight: "700", fontSize: 14 },
});
