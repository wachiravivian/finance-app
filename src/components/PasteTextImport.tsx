// src/components/PasteTextImport.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { supabase } from "../supabaseClient";
import { getApiBase } from "../utils/api";

// ✅ Multiline text input (Web + Native)
function MultilineInput(props: any) {
  if (Platform.OS === "web") {
    return (
      <textarea
        {...props}
        style={{
          width: "100%",
          minHeight: 160,
          padding: 8,
          border: "1px solid #ddd",
          borderRadius: 8,
          fontFamily: "monospace",
          fontSize: 14,
        }}
      />
    );
  }

  const { TextInput } = require("react-native");
  return (
    <TextInput
      {...props}
      multiline
      style={{
        width: "100%",
        minHeight: 160,
        padding: 8,
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
      }}
    />
  );
}

export default function PasteTextImport({
  onImported,
}: {
  onImported?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");

  const submit = async () => {
    try {
      if (!text.trim()) {
        Alert.alert(
          "Paste text",
          "Please paste one or more M-PESA statement lines first."
        );
        return;
      }

      setBusy(true);

      const API_URL = getApiBase();
      const endpoint = `${API_URL}/parse-text`;

      console.log("Uploading text to:", endpoint);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `Backend error ${res.status}`);
      }

      const payload = await res.json();
      const parsedTransactions = payload?.transactions ?? [];
      const count = parsedTransactions.length;

      if (count === 0) {
        Alert.alert(
          "No transactions found",
          "Try cleaning up your pasted text and re-import."
        );
        setText("");
        return;
      }

      // Get user ID for database insertion
      const { data: auth } = await supabase.auth.getUser();
      const user_id = auth?.user?.id;
      if (!user_id) throw new Error("Not signed in");

      // Map to database format
      const rows = parsedTransactions.map((t: any) => {
        const isCredit = t.direction === "credit";
        const counterparty = t.counterparty || t.description || "Unknown Transaction";
        let title = counterparty;
        if (title.length > 30) {
          title = title.substring(0, 30) + "...";
        }

        return {
          user_id,
          ts: t.ts || new Date().toISOString(),
          direction: isCredit ? "credit" : "debit",
          amount: Math.abs(Number(t.amount ?? 0)),
          method: t.method || "mpesa",
          type: t.type || (isCredit ? "income" : "expense"),
          counterparty: counterparty,
          reference: t.reference || "",
          category: t.category || "other",
          notes: t.description || null,
          title: title,
        };
      });

      // Insert into database
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) throw error;

      Alert.alert(
        "Import complete 🎉",
        `Imported ${rows.length} transactions.`
      );

      setText("");
      onImported?.();
    } catch (e: any) {
      console.error("PasteText import error:", e);
      Alert.alert("Import failed", e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8, maxWidth: 640, width: "100%" }}>
      <Text style={{ fontWeight: "700" }}>Paste M-PESA statement lines</Text>

      <MultilineInput
        placeholder={`Paste your M-PESA transactions in this format:\n\nTKH4EAJ1EV 2025-11-17 09:13:19 Pay Bill Online to 859528 - MALI Completed -1,500.00\nTKH4EAIV6K 2025-11-17 08:54:58 Deposit of Funds at Agent Till Completed 1,500.00\nTKGEPABXUD 2025-11-16 12:36:14 Funds received from CORINIA LIKOVE Completed 950.00`}
        value={text}
        onChange={(e: any) => setText(e?.target?.value ?? e)}
      />

      <TouchableOpacity
        onPress={submit}
        disabled={busy}
        style={{
          backgroundColor: busy ? "#94a3b8" : "#16a34a",
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            Parse & Import
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}