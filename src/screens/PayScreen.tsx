// src/screens/PayScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { colors, spacing, radius } from "../constants/styles";
import { supabase } from "../supabaseClient";
import { payGoalStk, sanitizePhone } from "../lib/payments";

type Goal = {
  id: string;
  name?: string | null;
  target_amount?: number | null;
  saved_amount?: number | null;
};

export default function PayScreen() {
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Load user goals
  useEffect(() => {
    (async () => {
      setLoadingGoals(true);
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        setGoals([]);
        setLoadingGoals(false);
        return;
      }
      const { data, error } = await supabase
        .from("goals")
        .select("id, name, target_amount, saved_amount")
        .order("created_at", { ascending: false });

      if (error) {
        console.log("goals load error:", error);
        setGoals([]);
      } else {
        setGoals(data || []);
      }
      setLoadingGoals(false);
    })();
  }, []);

  async function onSubmit() {
    try {
      if (!selectedGoalId) {
        Alert.alert("Missing Goal", "Please select a goal to pay.");
        return;
      }
      const amt = Number(amount);
      if (!amt || amt < 1) {
        Alert.alert("Invalid Amount", "Please enter a valid amount (>= 1).");
        return;
      }
      const ph = sanitizePhone(phone);
      if (!/^2547\d{8}$/.test(ph)) {
        Alert.alert(
          "Invalid Phone",
          "Use format 2547XXXXXXXX (no +, no spaces)."
        );
        return;
      }

      setSubmitting(true);
      const resp = await payGoalStk({
        goal_id: selectedGoalId,
        amount: amt,
        phone: ph,
      });
      setSubmitting(false);

      Alert.alert(
        "STK Sent",
        resp?.CustomerMessage ||
          "Prompt sent. Approve on your phone to complete payment."
      );

      // Optional: clear amount
      setAmount("");
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert("Payment Error", e?.message || "Failed to start STK push.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pay to Goal (M-Pesa STK)</Text>
      <Text style={styles.subtitle}>
        Pick a goal, enter amount and your M-Pesa number. You’ll receive a push
        prompt on the phone to approve.
      </Text>

      {/* Goal selector */}
      <Text style={styles.label}>Select Goal</Text>
      {loadingGoals ? (
        <View style={styles.rowCenter}>
          <ActivityIndicator />
          <Text style={styles.muted}> Loading goals…</Text>
        </View>
      ) : goals.length === 0 ? (
        <Text style={styles.muted}>You have no goals yet.</Text>
      ) : (
        <View style={styles.pillGroup}>
          {goals.map((g) => {
            const active = selectedGoalId === g.id;
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => setSelectedGoalId(g.id)}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {g.name || "Goal"}{" "}
                  {g.saved_amount != null && g.target_amount != null
                    ? `(${Math.min(
                        100,
                        Math.round(
                          (Number(g.saved_amount) / Math.max(1, Number(g.target_amount))) * 100
                        )
                      )}%)`
                    : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Amount */}
      <Text style={styles.label}>Amount (KES)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 500"
        keyboardType={Platform.select({ ios: "number-pad", android: "numeric" })}
        value={amount}
        onChangeText={setAmount}
      />

      {/* Phone */}
      <Text style={styles.label}>M-Pesa Phone (2547XXXXXXXX)</Text>
      <TextInput
        style={styles.input}
        placeholder="2547XXXXXXXX"
        keyboardType="phone-pad"
        autoCapitalize="none"
        value={phone}
        onChangeText={setPhone}
      />

      <TouchableOpacity
        style={[styles.submit, submitting && styles.submitDisabled]}
        onPress={onSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Pay to Goal</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.note}>
        After you approve the STK prompt, the system will update your goal and
        create a matching transaction once Safaricom sends the callback.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 4 },
  subtitle: { color: colors.muted, marginBottom: spacing.md },
  label: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  submit: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  muted: { color: colors.muted },
  pillGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  } as any,
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillText: { color: colors.text, fontWeight: "700" },
  pillTextActive: { color: "#fff" },
  note: { marginTop: spacing.md, color: colors.muted, fontSize: 12 },
});
