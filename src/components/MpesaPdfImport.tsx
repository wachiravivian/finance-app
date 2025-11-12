import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../supabaseClient";
import { getApiBase } from "../utils/api";

/** === DB-aligned constraints ===
 * direction: 'in' | 'out'
 * method: 'mpesa' | 'cash' | 'bank'
 * type:   'paybill' | 'buygoods' | 'send' | 'received' | 'airtime' | 'withdraw' | 'deposit' | 'charge' | 'reversal' | 'other'
 * title: NOT NULL (we will always send)
 */

const ALLOWED_METHODS = new Set(["mpesa", "cash", "bank"]);
const ALLOWED_TYPES = new Set([
  "paybill","buygoods","send","received","airtime","withdraw","deposit","charge","reversal","other",
]);

// Map common M-PESA verbs to direction 'in' / 'out'
function mapDirectionByType(type: string, amount: number): "in" | "out" {
  const t = (type || "").toLowerCase();
  if (["received", "deposit", "reversal"].includes(t)) return "in";
  if (["send", "paybill", "buygoods", "withdraw", "airtime", "charge"].includes(t)) return "out";
  return Number(amount) >= 0 ? "in" : "out"; // fallback by sign
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

export default function MpesaPdfImport({ onImported }: { onImported?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const pickAndUpload = async () => {
    try {
      setBusy(true);
      setProgress("Selecting file...");

      const picked = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) {
        setBusy(false);
        setProgress("");
        return;
      }
      const asset = picked.assets[0];

      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert("File too large", "Please select a PDF smaller than 10MB");
        setBusy(false);
        setProgress("");
        return;
      }

      setProgress("Uploading PDF...");
      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await fetch(asset.uri).then((r) => r.blob());
        const file = new File([blob], asset.name ?? "statement.pdf", { type: "application/pdf" });
        form.append("file", file);
      } else {
        // @ts-ignore react-native FormData file object
        form.append("file", { uri: asset.uri, name: asset.name ?? "statement.pdf", type: "application/pdf" });
      }

      const API_URL = getApiBase();
      const res = await fetch(`${API_URL}/parse-mpesa`, { method: "POST", body: form });
      if (!res.ok) {
        let detail = "";
        try { const j = await res.json(); detail = j?.detail || JSON.stringify(j); }
        catch { detail = await res.text(); }
        throw new Error(detail || `Backend error ${res.status}`);
      }

      setProgress("Processing transactions...");
      const payload = await res.json(); // { count, transactions }
      const txns = Array.isArray(payload?.transactions) ? payload.transactions : [];

      const { data: u } = await supabase.auth.getUser();
      const user_id = u?.user?.id;
      if (!user_id) throw new Error("Not signed in.");
      if (txns.length === 0) {
        Alert.alert("No transactions found", "Try a text-based statement or the Paste Text importer.");
        setBusy(false); setProgress(""); return;
      }

      setProgress(`Saving ${txns.length} transactions...`);
      const rows = txns.map((t: any) => {
        const amountNum = Number(t.amount ?? 0);
        const type = sanitizeType(t.type);
        const direction = mapDirectionByType(type, amountNum);
        const method = sanitizeMethod(t.method);
        return {
          user_id,
          ts: t.ts,                                 // ISO string ok for timestamptz
          direction,                                // 'in' | 'out'
          amount: Math.abs(isFinite(amountNum) ? amountNum : 0),
          method,                                   // 'mpesa' | 'cash' | 'bank'
          type,                                     // whitelisted
          counterparty: String(t.counterparty ?? ""),
          reference: String(t.reference ?? ""),
          category: String(t.category ?? "other").toLowerCase(),
          notes: String(t.notes ?? ""),
          title: buildTitle(t),                     // NOT NULL
        };
      });

      const { data: inserted, error: insertError } = await supabase
        .from("transactions")
        .insert(rows)
        .select("id");

      if (insertError) {
        console.error("Insert failed:", insertError);
        Alert.alert("Database Error", insertError.message);
      } else {
        Alert.alert("Import Successful 🎉", `Imported ${inserted?.length ?? rows.length} transactions`);
        onImported?.();
      }
    } catch (e: any) {
      Alert.alert("Import Failed", e?.message ?? String(e));
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <TouchableOpacity
        onPress={pickAndUpload}
        disabled={busy}
        style={{
          backgroundColor: busy ? "#94a3b8" : "#0ea5e9",
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 18 }}>📄</Text>}
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
          {busy ? "Processing..." : "Import M-PESA PDF"}
        </Text>
      </TouchableOpacity>

      {progress ? <Text style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}>{progress}</Text> : null}
    </View>
  );
}
