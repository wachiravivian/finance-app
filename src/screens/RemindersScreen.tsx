// src/screens/RemindersScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../supabaseClient";
import { useTheme } from "../hooks/useTheme";

type Reminder = {
  id: string;
  title: string;
  amount?: string | number;
  description?: string;
  due_date?: string;
  user_id: string;
  status?: "upcoming" | "missed" | "paid";
};

type TabType = "upcoming" | "missed" | "paid";

export default function RemindersScreen() {
  const { colors, isDark } = useTheme();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [showModal, setShowModal] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState("");
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;

      if (!userId) return;

      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const withStatus = (data || []).map((r) => ({
        ...r,
        status: r.status || getStatus(r),
      }));

      setReminders(withStatus);
    } catch {
      Alert.alert("Error", "Failed to load reminders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  useEffect(() => {
    setFilteredReminders(reminders.filter((r) => r.status === activeTab));
  }, [reminders, activeTab]);

  const getStatus = (r: Reminder): TabType => {
    if (!r.due_date) return "upcoming";
    const due = new Date(r.due_date);
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return due < today ? "missed" : "upcoming";
  };

  const saveReminder = async () => {
    if (!title.trim()) {
      Alert.alert("Validation", "Title is required");
      return;
    }

    const safeAmount = amount ? String(amount).trim() : "";

    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;

      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        due_date: selectedDate.toISOString(),
        user_id: userId,
        status: "upcoming",
      };

      if (safeAmount) payload.amount = safeAmount;

      if (editingReminder) {
        await supabase.from("reminders").update(payload).eq("id", editingReminder.id);
      } else {
        await supabase.from("reminders").insert(payload);
      }

      setShowModal(false);
      resetForm();
      fetchReminders();
      Alert.alert("Success", "Reminder saved!");
    } catch {
      Alert.alert("Error", "Failed to save reminder");
    }
  };

  const resetForm = () => {
    setTitle("");
    setAmount("");
    setDescription("");
    setSelectedDate(new Date());
    setEditingReminder(null);
  };

  const deleteReminder = async (id: string) => {
    await supabase.from("reminders").delete().eq("id", id);
    fetchReminders();
  };

  const openEdit = (r: Reminder) => {
    setEditingReminder(r);
    setTitle(r.title);
    setAmount(r.amount ? String(r.amount) : "");
    setDescription(r.description || "");
    setSelectedDate(r.due_date ? new Date(r.due_date) : new Date());
    setShowModal(true);
  };

  const renderItem = ({ item }: { item: Reminder }) => (
    <View style={[styles.reminderCard, { backgroundColor: colors.card }]}>
      <View style={styles.row}>
        <Text style={[styles.titleText, { color: colors.text }]}>{item.title}</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => openEdit(item)}>
            <Ionicons name="pencil" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteReminder(item.id)}>
            <Ionicons name="trash" size={20} color="red" />
          </TouchableOpacity>
        </View>
      </View>

      {item.amount && <Text style={{ color: colors.text }}>KES {item.amount}</Text>}
      {!!item.description && <Text style={{ color: colors.text }}>{item.description}</Text>}
      <Text style={{ color: colors.text }}>
        {item.due_date ? new Date(item.due_date).toLocaleDateString() : ""}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>Reminders</Text>

      <View style={styles.tabs}>
        {(["upcoming", "missed", "paid"] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={{ color: activeTab === tab ? "#fff" : colors.text }}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: colors.primary }]}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.addText}>Add Reminder</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={filteredReminders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}

      {/* MODAL */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <TextInput
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
            />
            <TextInput
              placeholder="Amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              style={styles.input}
            />

            {Platform.OS === "web" ? (
              <input
                type="date"
                value={selectedDate.toISOString().split("T")[0]}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                style={{ padding: 10, borderRadius: 6, marginBottom: 10 }}
              />
            ) : (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                onChange={(e, d) => d && setSelectedDate(d)}
              />
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={saveReminder}>
              <Text style={{ color: "#fff" }}>
                {editingReminder ? "Update" : "Save"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  screenTitle: { fontSize: 24, fontWeight: "700", marginBottom: 10 },
  reminderCard: { padding: 12, borderRadius: 10, marginBottom: 10 },
  titleText: { fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  actions: { flexDirection: "row", gap: 10 },
  tabs: { flexDirection: "row", gap: 6, marginBottom: 10 },
  tab: { padding: 8, borderRadius: 6 },
  addBtn: { flexDirection: "row", padding: 10, borderRadius: 8, justifyContent: "center" },
  addText: { color: "#fff", marginLeft: 6 },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalBox: { width: "90%", padding: 16, borderRadius: 12 },
  input: { borderWidth: 1, borderRadius: 6, padding: 10, marginBottom: 10 },
  saveBtn: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8, alignItems: "center" },
});
