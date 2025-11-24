// src/screens/SignupScreen.tsx
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
  Animated,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { AuthStackParamList } from "../navigation/AppNavigator";
import { enhancedSignUp } from "../supabaseClient";
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
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const phoneRegex = /^[0-9+\-\s()]{7,}$/;

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!fullName.trim()) newErrors.fullName = "Please enter your full name";
    if (!phone.trim()) newErrors.phone = "Please enter your phone number";
    else if (!phoneRegex.test(phone)) newErrors.phone = "Please enter a valid phone number";

    if (!email.trim()) newErrors.email = "Please enter your email";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Enter a valid email";

    if (!password) newErrors.password = "Please create a password";
    else if (password.length < 6) newErrors.password = "Password must be at least 6 characters";

    if (!confirm) newErrors.confirm = "Please confirm your password";
    else if (password !== confirm) newErrors.confirm = "Passwords do not match";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: string, value: string) => {
    if (errors[field]) setErrors({ ...errors, [field]: "" });

    switch (field) {
      case "fullName": setFullName(value); break;
      case "phone": setPhone(value); break;
      case "email": setEmail(value); break;
      case "password": setPassword(value); break;
      case "confirm": setConfirm(value); break;
    }
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      setErrors({});
      const result = await enhancedSignUp(
        email.trim().toLowerCase(),
        password,
        { full_name: fullName.trim(), phone: phone.trim() }
      );

      if (result.user) {
        Alert.alert(
          "🎉 Account Created!",
          "Your account has been created successfully!",
          [
            {
              text: "Continue to Sign In",
              onPress: () => navigation.navigate("Login", { prefillEmail: email.trim().toLowerCase() }),
            },
          ]
        );
      }
    } catch (error: any) {
      if (error.message.includes("email") || error.message.includes("Email")) {
        setErrors({ email: error.message });
      } else if (error.message.includes("password") || error.message.includes("Password")) {
        setErrors({ password: error.message });
      } else {
        Alert.alert("Signup Failed", error.message || "An unexpected error occurred");
      }
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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Icon name="finance" size={40} color="#fff" />
            </View>
            <Text style={styles.title}>Welcome!</Text>
            <Text style={styles.subtitle}>Create your account to get started</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <InputField
              icon="account-outline"
              placeholder="Full Name"
              value={fullName}
              onChange={(val) => handleFieldChange("fullName", val)}
              error={errors.fullName}
              editable={!loading}
            />
            <InputField
              icon="phone-outline"
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={phone}
              onChange={(val) => handleFieldChange("phone", val)}
              error={errors.phone}
              editable={!loading}
            />
            <InputField
              icon="email-outline"
              placeholder="Email"
              keyboardType="email-address"
              value={email}
              onChange={(val) => handleFieldChange("email", val)}
              error={errors.email}
              editable={!loading}
              autoCapitalize="none"
            />
            <InputField
              icon="lock-outline"
              placeholder="Password"
              value={password}
              secureTextEntry={secure}
              onChange={(val) => handleFieldChange("password", val)}
              toggleSecure={() => setSecure((s) => !s)}
              error={errors.password}
              editable={!loading}
            />
            <InputField
              icon="lock-check-outline"
              placeholder="Confirm Password"
              value={confirm}
              secureTextEntry={secure2}
              onChange={(val) => handleFieldChange("confirm", val)}
              toggleSecure={() => setSecure2((s) => !s)}
              error={errors.confirm}
              editable={!loading}
              onSubmit={handleSignup}
            />

            {/* Signup Button */}
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
            </Pressable>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => navigation.navigate("Login")} disabled={loading}>
              <Text style={styles.footerLink}>Sign In</Text>
            </Pressable>
          </View>
        </Animated.View>
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
