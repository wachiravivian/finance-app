// components/AddTransactionModal.tsx
import React, { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, Alert, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "../supabaseClient";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function AddTransactionModal({ visible, onClose, onSaved }: Props) {
  const [ts, setTs] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [direction, setDirection] = useState<"debit" | "credit">("debit");
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("shopping");
  const [type, setType] = useState<string>("buygoods");
  const [counterparty, setCounterparty] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const reset = () => {
    setTs(new Date());
    setDirection("debit");
    setAmount("");
    setCategory("shopping");
    setType("buygoods");
    setCounterparty("");
    setReference("");
    setNotes("");
  };

  const save = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) {
      Alert.alert("Invalid amount", "Enter a positive amount.");
      return;
    }
    try {
      const { data: u } = await supabase.auth.getUser();
      const user_id = u?.user?.id;
      if (!user_id) throw new Error("Not signed in.");

      const row = {
        user_id,
        ts: ts.toISOString(),
        direction,
        amount: amt,
        method: "mpesa", // or allow picker
        type,
        counterparty: counterparty || null,
        reference: reference || null,
        category: category || null,
        notes: notes || null,
      };

      const { error } = await supabase.from("transactions").insert([row]);
      if (error) throw error;

      onSaved?.();
      reset();
      onClose();
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? String(e));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#0006", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#fff", padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 8 }}>
          <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 8 }}>Add Transaction</Text>

          <TouchableOpacity onPress={() => setShowPicker(true)} style={{ padding: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 8 }}>
            <Text>{ts.toLocaleString()}</Text>
          </TouchableOpacity>

          {showPicker && (
            <DateTimePicker
              value={ts}
              mode="datetime"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_, d) => {
                setShowPicker(false);
                if (d) setTs(d);
              }}
            />
          )}

          {/* Direction */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["debit", "credit"] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => setDirection(opt)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: direction === opt ? "#0ea5e9" : "#ddd",
                  backgroundColor: direction === opt ? "#e0f2fe" : "#fff",
                }}
              >
                <Text style={{ color: direction === opt ? "#0369a1" : "#000" }}>{opt.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            placeholder="Amount (KES)"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            style={{ borderWidth: 1, borderColor: "#ddd", padding: 10, borderRadius: 8 }}
          />

          <TextInput
            placeholder="Category (e.g., food, utilities, transport, income)"
            value={category}
            onChangeText={setCategory}
            style={{ borderWidth: 1, borderColor: "#ddd", padding: 10, borderRadius: 8 }}
          />

          <TextInput
            placeholder="Type (e.g., buygoods, paybill, send, received)"
            value={type}
            onChangeText={setType}
            style={{ borderWidth: 1, borderColor: "#ddd", padding: 10, borderRadius: 8 }}
          />

          <TextInput
            placeholder="Counterparty (e.g., Naivas TILL 12345)"
            value={counterparty}
            onChangeText={setCounterparty}
            style={{ borderWidth: 1, borderColor: "#ddd", padding: 10, borderRadius: 8 }}
          />

          <TextInput
            placeholder="Reference (M-PESA Ref)"
            value={reference}
            onChangeText={setReference}
            style={{ borderWidth: 1, borderColor: "#ddd", padding: 10, borderRadius: 8 }}
          />

          <TextInput
            placeholder="Notes"
            value={notes}
            onChangeText={setNotes}
            style={{ borderWidth: 1, borderColor: "#ddd", padding: 10, borderRadius: 8 }}
          />

          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
            <TouchableOpacity onPress={onClose} style={{ padding: 10 }}>
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} style={{ backgroundColor: "#16a34a", padding: 10, borderRadius: 8 }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
