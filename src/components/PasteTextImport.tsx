import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { supabase } from "../supabaseClient";
import { getApiBase } from "../utils/api";

/** Same DB-aligned rules as in MpesaPdfImport.tsx */
const ALLOWED_METHODS = new Set(["mpesa", "cash", "bank"]);
const ALLOWED_TYPES = new Set([
  "paybill","buygoods","send","received","airtime","withdraw","deposit","charge","reversal","other",
]);

function mapDirectionByType(type: string, amount: number): "in" | "out" {
  const t = (type || "").toLowerCase();
  if (["received", "deposit", "reversal"].includes(t)) return "in";
  if (["send", "paybill", "buygoods", "withdraw", "airtime", "charge"].includes(t)) return "out";
  return Number(amount) >= 0 ? "in" : "out";
}
function sanitizeType(val: any): string {
  const v = String(val ?? "").toLowerCase().trim();
  return ALLOWED_TYPES.has(v) ? v : "other";
}
function sanitizeMethod(val: any): string {
  const v = String(val ?? "").toLowerCase().trim() || "mpesa";
  return ALLOWED_METHODS.has(v) ? v : "mpesa";
}
function buildTitle(t: any): string {
  const cp = (t?.counterparty ?? "").toString().trim();
  const ty = (t?.type ?? "").toString().trim();
  if (cp) return cp;
  if (ty) return `M-PESA ${ty.toUpperCase()}`;
  return "Transaction";
}

// Simple multiline input
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
      style={{ width: "100%", minHeight: 160, padding: 8, borderWidth: 1, borderColor: "#ddd", borderRadius: 8 }}
    />
  );
}

export default function PasteTextImport({ onImported }: { onImported?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");

  const submit = async () => {
    try {
      if (!text.trim()) {
        Alert.alert("Paste text", "Paste one or more statement lines first.");
        return;
      }
      setBusy(true);

      const API_URL = getApiBase();
      const res = await fetch(`${API_URL}/parse-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        let msg = "";
        try { const j = await res.json(); msg = j?.detail || JSON.stringify(j); }
        catch { msg = await res.text(); }
        throw new Error(msg || `Backend error ${res.status}`);
      }

      const payload = await res.json(); // { count, transactions }
      const txns = Array.isArray(payload?.transactions) ? payload.transactions : [];

      const { data: u } = await supabase.auth.getUser();
      const user_id = u?.user?.id;
      if (!user_id) throw new Error("Not signed in.");
      if (txns.length === 0) {
        Alert.alert("No transactions found", "Double-check your pasted lines.");
        setBusy(false); return;
      }

      const rows = txns.map((t: any) => {
        const amountNum = Number(t.amount ?? 0);
        const type = sanitizeType(t.type);
        const direction = mapDirectionByType(type, amountNum);
        const method = sanitizeMethod(t.method);
        return {
          user_id,
          ts: t.ts,
          direction,                                // 'in' | 'out'
          amount: Math.abs(isFinite(amountNum) ? amountNum : 0),
          method,                                   // 'mpesa' | 'cash' | 'bank'
          type,                                     // allowed set
          counterparty: String(t.counterparty ?? ""),
          reference: String(t.reference ?? ""),
          category: String(t.category ?? "other").toLowerCase(),
          notes: String(t.notes ?? ""),
          title: buildTitle(t),
        };
      });

      const { data: inserted, error: insertError } = await supabase
        .from("transactions")
        .insert(rows)
        .select("id");

      if (insertError) {
        console.error("Insert failed:", insertError);
        Alert.alert("Insert failed", insertError.message);
        return;
      }

      Alert.alert("Import complete", `Imported ${inserted?.length ?? rows.length} transactions`);
      setText("");
      onImported?.();
    } catch (e: any) {
      Alert.alert("Import failed", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8, maxWidth: 640, width: "100%" }}>
      <Text style={{ fontWeight: "700" }}>Paste M-PESA statement lines</Text>

      <MultilineInput
        placeholder={`Example:\n01/11/2025 PayBill 888888 KPLC Ref ABC12345 KES 2,450.00\n03-11-2025 Buy Goods Naivas TILL 12345 Ref XYZ98765 KES 1,250.00\n04/11/2025 M-PESA Received From John 0712... Ref QWER5678 KES 5,000.00\n05/11/2025 Transaction fee Charge Ref T1234AB KES 27.00\n06/11/2025 Withdraw Agent 123456 Ref WDR78901 KES 1,000.00`}
        value={text}
        onChange={(e: any) => setText(e?.target?.value ?? e)}
      />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          onPress={submit}
          disabled={busy}
          style={{ backgroundColor: "#16a34a", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Parse & Import</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
