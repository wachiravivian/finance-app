// src/screens/RemindersScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, ScrollView } from "react-native";
import { supabase } from "../supabaseClient";

type Reminder = {
  id: string;
  title: string;
  due_at: string | null;
  done: boolean;
};

export default function RemindersScreen() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Reminder[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) {
        setItems([]);
        return;
      }
      const { data, error } = await supabase
        .from("reminders")
        .select("id, title, due_at, done")
        .eq("user_id", userId)
        .order("done", { ascending: true })
        .order("due_at", { ascending: true })
        .limit(500);

      if (error) throw error;
      setItems((data as any[]) ?? []);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Load failed", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) throw new Error("Not signed in.");

      const due_at = due ? new Date(due).toISOString() : null;
      const { error } = await supabase
        .from("reminders")
        .insert({ user_id: userId, title: title.trim(), due_at, done: false });

      if (error) throw error;
      setTitle("");
      setDue("");
      load();
    } catch (e: any) {
      Alert.alert("Create failed", e?.message ?? String(e));
    }
  };

  const toggleDone = async (id: string, done: boolean) => {
    try {
      const { error } = await supabase
        .from("reminders")
        .update({ done: !done })
        .eq("id", id);
      if (error) throw error;
      load();
    } catch (e: any) {
      Alert.alert("Update failed", e?.message ?? String(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Reminders</Text>

      <View style={styles.row}>
        <TextInput
          placeholder="Reminder title"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <TextInput
          placeholder="Due date (YYYY-MM-DD)"
          value={due}
          onChangeText={setDue}
          style={[styles.input, { flex: 0.8 }]}
        />
        <TouchableOpacity style={styles.btn} onPress={add} disabled={!title.trim()}>
          <Text style={styles.btnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : items.length === 0 ? (
        <Text style={{ color: "#64748b" }}>No reminders yet.</Text>
      ) : (
        items.map((r) => (
          <View key={r.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, r.done && { textDecorationLine: "line-through", color: "#64748b" }]}>
                {r.title}
              </Text>
              {r.due_at && (
                <Text style={styles.dueText}>
                  Due: {new Date(r.due_at).toLocaleString()}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => toggleDone(r.id, r.done)} style={styles.smallBtn}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>{r.done ? "Undo" : "Done"}</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: "800", color: "#0f172a" },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 10 },
  btn: { backgroundColor: "#16a34a", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "800" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#eef2f7" },
  itemTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  dueText: { color: "#64748b", fontSize: 12, marginTop: 4 },
  smallBtn: { backgroundColor: "#0ea5e9", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
});
