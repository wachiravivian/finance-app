import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { RectButton } from "react-native-gesture-handler";
import { supabase } from "../supabaseClient";
import { colors, spacing, radius } from "../constants/styles";

// Define possible transaction statuses
type TransactionStatus = "IDLE" | "PENDING_STK" | "PENDING_PAYMENT" | "SUCCESS" | "FAILED";

// Define a safe color for failure since 'colors.error' might not exist.
const FAILURE_COLOR = '#D32F2F';

export default function PaymentsScreen() {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<TransactionStatus>("IDLE");
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null); // NEW: State to store detailed failure reason

  // Ref to manage the polling timer
  const pollingRef = useRef<number | null>(null);

  // --- Status Checker Polling Function ---
  const checkStatus = useCallback(async (requestId: string) => {
    console.log(`Polling status for ${requestId}...`);
    setStatus("PENDING_PAYMENT");
    setFailureMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke("mpesa-query", {
        body: { checkout_request_id: requestId },
      });

      if (error) {
        console.error("Query Error:", error.message);
        // If the query itself fails, do not proceed with polling
        if (pollingRef.current) clearTimeout(pollingRef.current);
        pollingRef.current = null;
        setStatus("FAILED");
        setFailureMessage(`Query failed: ${error.message}`);
        return;
      }

      const remoteStatus = data?.status?.toUpperCase();

      if (remoteStatus === "SUCCESS") {
        if (pollingRef.current) clearTimeout(pollingRef.current);
        pollingRef.current = null;
        setStatus("SUCCESS");
        Alert.alert("Payment Complete", "Transaction successful!");
      } else if (remoteStatus === "FAILED") {
        if (pollingRef.current) clearTimeout(pollingRef.current);
        pollingRef.current = null;
        setStatus("FAILED");
        const msg = data?.status_detail || "The transaction was cancelled or failed by the user. Please try again.";
        setFailureMessage(msg); // Capture failure detail
        Alert.alert("Payment Failed", msg);
      } else {
        // If still PENDING, reschedule the check
        pollingRef.current = setTimeout(() => checkStatus(requestId), 3000) as unknown as number;
      }
    } catch (e) {
      console.error("Polling catch error:", e);
      // Still retry if error, but wait longer
      pollingRef.current = setTimeout(() => checkStatus(requestId), 5000) as unknown as number;
    }
  }, []);

  // Cleanup function for the timer
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, []);


  async function payNow() {
    const amt = Number(amount);
    if (!/^2547\d{8}$/.test(phone)) {
      Alert.alert("Invalid phone", "Enter phone as 2547XXXXXXXX");
      return;
    }
    if (!amt || amt < 1) {
      Alert.alert("Invalid amount", "Enter an amount >= 1");
      return;
    }

    // Clear previous transaction states
    setStatus("PENDING_STK");
    setCheckoutRequestId(null);
    setLastResponse(null);
    setFailureMessage(null); // Clear old failure message
    if (pollingRef.current) clearTimeout(pollingRef.current);


    try {
      setBusy(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user_id = sessionData?.session?.user?.id ?? null;

      // 1. Initiate STK Push
      const { data, error } = await supabase.functions.invoke("mpesa-stk", {
        body: { phone, amount: amt, user_id },
      });

      setLastResponse({ data, error });

      if (error) {
        setStatus("FAILED");
        const msg = error.message ?? "Failed to initiate payment. Check your Edge Function logs.";
        setFailureMessage(`Edge Function Error: ${msg}`); // Capture Edge Function Error
        Alert.alert("STK Error", msg);
        return;
      }

      // 2. Handle M-Pesa API response
      const mpesaResponse = data;

      if (mpesaResponse?.ResponseCode === "0") {
        // STK Push successful
        const requestId = mpesaResponse.CheckoutRequestID;
        setCheckoutRequestId(requestId);

        const msg =
          mpesaResponse.CustomerMessage || "STK Push sent! Please check your phone for the M-Pesa prompt.";
        Alert.alert("Request Sent", msg);

        // 3. Start polling for payment status
        checkStatus(requestId);
      } else {
        // STK Push failed (e.g., duplicate request, invalid number, bad credentials)
        setStatus("FAILED");
        const msg =
          mpesaResponse?.errorMessage ||
          mpesaResponse?.ResultDesc ||
          "STK Push failed to send (check M-Pesa API response/credentials).";
        setFailureMessage(`M-Pesa API Error: ${msg}`); // Capture M-Pesa API Error
        Alert.alert("STK Failed", String(msg));
      }
    } catch (e: any) {
      console.log("mpesa-stk catch error", e);
      setStatus("FAILED");
      const msg = String(e?.message ?? e);
      setFailureMessage(`Client Catch Error: ${msg}`); // Capture Catch Block Error
      Alert.alert("Error", msg);
    } finally {
      setBusy(false);
    }
  }
  
  const getStatusDisplay = () => {
    switch (status) {
      case "PENDING_STK":
        return (
          <View style={styles.statusBox}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.primary }]}>Sending STK Push...</Text>
          </View>
        );
      case "PENDING_PAYMENT":
        return (
          <View style={styles.statusBox}>
            <ActivityIndicator size="small" color={colors.warning} />
            <Text style={[styles.statusText, { color: colors.warning }]}>
              Awaiting M-Pesa payment... (Check your phone)
            </Text>
          </View>
        );
      case "SUCCESS":
        return (
          <View style={styles.statusBox}>
            <Text style={[styles.statusText, { color: colors.success }]}>✅ Payment Successful!</Text>
          </View>
        );
      case "FAILED":
        return (
          <View style={styles.statusBox}>
            {/* Using a guaranteed red color for failure for immediate visibility */}
            <Text style={[styles.statusText, { color: FAILURE_COLOR }]}>❌ Payment Failed. Try Again.</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const isActionDisabled = busy || status === "PENDING_PAYMENT";

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Pay with M-Pesa</Text>

        <Text style={styles.label}>Phone (2547XXXXXXXX)</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="2547XXXXXXXX"
          keyboardType="phone-pad"
          autoCapitalize="none"
          editable={!isActionDisabled}
        />

        <Text style={styles.label}>Amount (Ksh)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="10"
          keyboardType="numeric"
          editable={!isActionDisabled}
        />
        
        {getStatusDisplay()}
        
        {/* NEW: Display detailed failure message */}
        {status === "FAILED" && failureMessage && (
            <View style={{ marginTop: spacing.sm, paddingHorizontal: spacing.sm }}>
                <Text style={{ color: FAILURE_COLOR, fontSize: 13, textAlign: 'center', fontWeight: 'bold' }}>
                    Reason: {failureMessage}
                </Text>
            </View>
        )}

        <RectButton
          style={[styles.btn, isActionDisabled && { opacity: 0.5, backgroundColor: colors.muted }]}
          enabled={!isActionDisabled}
          onPress={payNow}
        >
          <Text style={styles.btnText}>
            {busy
              ? "Processing..."
              : status === "PENDING_PAYMENT"
              ? "Checking Status..."
              : "Pay Now"}
          </Text>
        </RectButton>

        {checkoutRequestId && (
          <Text style={styles.requestIdText}>
            Request ID: {checkoutRequestId}
          </Text>
        )}

        {lastResponse && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Last response (debug):</Text>
            <Text style={{ color: colors.text, fontSize: 12 }}>
              {JSON.stringify(lastResponse, null, 2)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  label: { fontWeight: "700", color: colors.text, marginTop: spacing.md, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    backgroundColor: "#fff",
    color: colors.text
  },
  btn: {
    marginTop: spacing.lg,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "800" },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  statusText: {
    marginLeft: spacing.sm,
    fontWeight: '600',
    fontSize: 14,
  },
  requestIdText: {
    fontSize: 10,
    color: colors.muted,
    marginTop: spacing.sm,
    textAlign: 'center'
  }
});
