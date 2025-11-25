// src/screens/SignupScreen.tsx
import React, { useState, useEffect, useRef } from "react";
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
  SafeAreaView,
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSignup = async () => {
    if (!email || !password || !fullName || !phone) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    if (password !== confirm) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      const result = await enhancedSignUp(email, password, {
        full_name: fullName,
        phone,
      });

      if (result.user) {
        Alert.alert("🎉 Success", "Account created!", [
          { text: "Go to Login", onPress: () => navigation.navigate("Login") },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Signup Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>

            {/* HEADER */}
            <View style={styles.header}>
              <Text style={styles.moneySmart}>MoneySmart</Text>

              <View style={styles.logoContainer}>
                <Icon name="finance" size={40} color="#fff" />
              </View>

              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Start your smart finance journey</Text>
            </View>

            {/* FORM */}
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={fullName}
              onChangeText={setFullName}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            {/* PASSWORD */}
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Icon
                  name={showPassword ? "eye-off" : "eye"}
                  size={22}
                  color="#6b7280"
                />
              </Pressable>
            </View>

            {/* CONFIRM PASSWORD */}
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm Password"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
              />
              <Pressable onPress={() => setShowConfirm(!showConfirm)}>
                <Icon
                  name={showConfirm ? "eye-off" : "eye"}
                  size={22}
                  color="#6b7280"
                />
              </Pressable>
            </View>

            <Pressable
              style={styles.primaryBtn}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Create Account</Text>
              )}
            </Pressable>

            {/* LOGIN LINK */}
            <Pressable onPress={() => navigation.navigate("Login")}>
              <Text style={styles.loginLink}>
                Already have an account? <Text style={styles.loginBold}>Sign in</Text>
              </Text>
            </Pressable>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  root: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  moneySmart: {
    fontSize: 36,
    fontWeight: "900",
    color: "#8b5cf6",
    marginBottom: 10,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.muted,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: 12,
    padding: 14,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
  },
  primaryBtn: {
    backgroundColor: "#8b5cf6",
    borderRadius: radius.lg,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  loginLink: {
    marginTop: 20,
    textAlign: "center",
    color: "#6b7280",
  },
  loginBold: {
    color: "#8b5cf6",
    fontWeight: "700",
  },
});