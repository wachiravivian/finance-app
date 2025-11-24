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
  Switch,
} from "react-native";
import { DrawerScreenProps } from "@react-navigation/drawer";
//import { ThemedScreen } from '../components/ThemedScreen';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';

import { supabase } from "../supabaseClient";
import { DrawerParamList } from "../navigation/AppNavigator";
import { colors as constantsColors, spacing, radius } from "../constants/styles";
import { useTheme } from "../hooks/useTheme";

type Props = DrawerScreenProps<DrawerParamList, "Profile">;

export default function ProfileScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [profileExists, setProfileExists] = useState(false);

  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");

  const { colors, isDark, toggleTheme } = useTheme();
  const [hasThemeColumn, setHasThemeColumn] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      setEmail(user.email ?? "");
      
      try {
        const { data: prof, error } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          if (error.code === '42703') {
            setHasThemeColumn(false);
            const { data: profBasic } = await supabase
              .from("profiles")
              .select("full_name, phone")
              .eq("id", user.id)
              .maybeSingle();
            
            if (profBasic) {
              setProfileExists(true);
              setFullName(profBasic.full_name ?? "");
              setPhone(profBasic.phone ?? "");
            } else {
              setProfileExists(false);
              setFullName((user.user_metadata as any)?.full_name ?? "");
              setPhone((user.user_metadata as any)?.phone ?? "");
            }
          } else {
            throw error;
          }
        } else if (prof) {
          setProfileExists(true);
          setFullName(prof.full_name ?? "");
          setPhone(prof.phone ?? "");
        } else {
          setProfileExists(false);
          setFullName((user.user_metadata as any)?.full_name ?? "");
          setPhone((user.user_metadata as any)?.phone ?? "");
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        Alert.alert('Error', 'Failed to load profile data');
      }
    } catch (error) {
      console.error('Error in loadProfile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleThemeToggle = async (value: boolean) => {
    toggleTheme();
    
    if (hasThemeColumn && profileExists) {
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        try {
          await supabase
            .from("profiles")
            .upsert({ 
              id: user.id, 
              theme_preference: value ? 'dark' : 'light'
            });
        } catch (error) {
          console.error('Error saving theme preference:', error);
        }
      }
    }
  };

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

    try {
      const updateData: any = { 
        id: user.id, 
        full_name: nameTrim, 
        phone: phoneTrim 
      };
      
      if (hasThemeColumn) {
        updateData.theme_preference = isDark ? 'dark' : 'light';
      }

      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert(updateData);

      if (upsertErr) {
        throw upsertErr;
      }

      const { error: metaErr } = await supabase.auth.updateUser({
        data: { full_name: nameTrim, phone: phoneTrim },
      });
      if (metaErr) {
        throw metaErr;
      }

      setProfileExists(true);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
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
    try {
      (navigation as any).closeDrawer?.();
    } catch {}
  }

  const styles = createStyles(colors);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.centerWrap} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your account details</Text>

          {!profileExists && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>
                Complete your profile to save your information
              </Text>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput 
            value={email} 
            editable={false} 
            style={[styles.input, styles.readonly]}
            placeholderTextColor={colors.subtitle}
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Full Name</Text>
          <TextInput
            placeholder="Your full name"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            placeholderTextColor={colors.subtitle}
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Phone Number</Text>
          <TextInput
            placeholder="Your phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.input}
            placeholderTextColor={colors.subtitle}
          />

          <View style={{ height: spacing.md }} />

          <Button 
            title={saving ? "Saving..." : "Save Profile"} 
            onPress={handleSaveProfile} 
            disabled={saving} 
            color={colors.primary}
          />

          <View style={{ height: spacing.lg }} />

          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.themeContainer}>
            <Text style={styles.themeLabel}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={handleThemeToggle}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={isDark ? colors.primary : "#f4f3f4"}
            />
          </View>

          {!hasThemeColumn && (
            <Text style={styles.warningText}>
              Note: Theme preference is stored locally. Add 'theme_preference' column to your Supabase 'profiles' table to sync across devices.
            </Text>
          )}

          <View style={{ height: spacing.lg }} />

          <Text style={styles.sectionTitle}>Security</Text>
          <Text style={styles.label}>Change Password</Text>
          <TextInput
            placeholder="New password"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            style={styles.input}
            placeholderTextColor={colors.subtitle}
          />
          <View style={{ height: spacing.sm }} />
          <Button
            title={changingPw ? "Updating..." : "Update Password"}
            onPress={handleChangePassword}
            disabled={changingPw}
            color={colors.primary}
          />

          <View style={{ height: spacing.lg }} />
          <Button title="Logout" color={colors.danger} onPress={handleLogout} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const MAX_WIDTH = 720;

const createStyles = (colors: any) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerWrap: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: MAX_WIDTH,
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: "700" as TextStyle["fontWeight"],
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    color: colors.subtitle,
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
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    color: colors.text,
  },
  readonly: {
    backgroundColor: colors.background,
  },
  sectionTitle: {
    fontWeight: "700" as TextStyle["fontWeight"],
    color: colors.text,
    marginBottom: spacing.sm,
  },
  themeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  themeLabel: {
    fontSize: 16,
    fontWeight: "600" as TextStyle["fontWeight"],
    color: colors.text,
  },
  warningText: {
    fontSize: 12,
    color: '#FFA726',
    fontStyle: 'italic',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  warningBanner: {
    backgroundColor: '#FFF3CD',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  warningBannerText: {
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
  },
});
