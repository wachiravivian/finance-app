import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  ActivityIndicator,
  TextStyle,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { DrawerScreenProps } from "@react-navigation/drawer";

import { supabase } from "../supabaseClient";
import { DrawerParamList } from "../navigation/AppNavigator";
import { colors, spacing, radius } from "../constants/styles";

type Props = DrawerScreenProps<DrawerParamList, "Profile">;

export default function ProfileScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      setEmail(user.email ?? "");
      // try profiles first, then metadata
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .single();

      setFullName(prof?.full_name ?? (user.user_metadata as any)?.full_name ?? "");
      setPhone(prof?.phone ?? (user.user_metadata as any)?.phone ?? "");
      setLoading(false);
    })();
  }, []);

  async function handleSaveProfile() {
    const phoneTrim = phone.trim();
    const nameTrim = fullName.trim();
    const phoneRegex = /^[0-9+\-\s()]{7,}$/;

    if (!nameTrim) return Alert.alert("Validation", "Please enter your full name.");
    if (!phoneTrim || !phoneRegex.test(phoneTrim)) {
      return Alert.alert("Validation", "Please enter a valid phone number.");
    }

    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      setSaving(false);
      return;
    }

    // upsert profile row
    const { error: upsertErr } = await supabase
      .from("profiles")
      .upsert({ id: user.id, full_name: nameTrim, phone: phoneTrim });

    if (upsertErr) {
      setSaving(false);
      return Alert.alert("Error", upsertErr.message);
    }

    // keep auth metadata in sync
    const { error: metaErr } = await supabase.auth.updateUser({
      data: { full_name: nameTrim, phone: phoneTrim },
    });
    if (metaErr) {
      setSaving(false);
      return Alert.alert("Error", metaErr.message);
    }

    setSaving(false);
    Alert.alert("Saved", "Your profile has been updated.");
  }

  async function handleChangePassword() {
    const pw = newPassword.trim();
    if (!pw || pw.length < 6) {
      return Alert.alert("Validation", "Password must be at least 6 characters.");
    }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setChangingPw(false);
    if (error) return Alert.alert("Error", error.message);
    setNewPassword("");
    Alert.alert("Success", "Password updated successfully.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    // Let AppNavigator swap to AuthStack; no manual reset to "Login" here
    try {
      (navigation as any).closeDrawer?.();
    } catch {}
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F7FAFC" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.centerWrap} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your account details</Text>

          {/* Email (read-only) */}
          <Text style={styles.label}>Email</Text>
          <TextInput value={email} editable={false} style={[styles.input, styles.readonly]} />

          {/* Full name */}
          <Text style={[styles.label, { marginTop: spacing.md }]}>Full Name</Text>
          <TextInput
            placeholder="Your full name"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            placeholderTextColor="#9CA3AF"
          />

          {/* Phone */}
          <Text style={[styles.label, { marginTop: spacing.md }]}>Phone Number</Text>
          <TextInput
            placeholder="Your phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.input}
            placeholderTextColor="#9CA3AF"
          />

          <View style={{ height: spacing.md }} />

          <Button title={saving ? "Saving..." : "Save Profile"} onPress={handleSaveProfile} disabled={saving} />

          <View style={{ height: spacing.lg }} />

          {/* Password section */}
          <Text style={styles.sectionTitle}>Security</Text>
          <Text style={styles.label}>Change Password</Text>
          <TextInput
            placeholder="New password"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            style={styles.input}
            placeholderTextColor="#9CA3AF"
          />
          <View style={{ height: spacing.sm }} />
          <Button
            title={changingPw ? "Updating..." : "Update Password"}
            onPress={handleChangePassword}
            disabled={changingPw}
          />

          <View style={{ height: spacing.lg }} />
          <Button title="Logout" color={colors.danger} onPress={handleLogout} />
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
    fontSize: 24,
    fontWeight: "700" as TextStyle["fontWeight"],
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 6,
    marginBottom: spacing.lg,
  },
  label: {
    marginBottom: 6,
    fontWeight: "600" as TextStyle["fontWeight"],
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    color: colors.text,
  },
  readonly: {
    backgroundColor: "#F3F4F6",
  },
  sectionTitle: {
    fontWeight: "700" as TextStyle["fontWeight"],
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
