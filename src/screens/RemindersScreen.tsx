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
import * as Notifications from 'expo-notifications';

type Reminder = {
  id: string;
  title: string;
  amount?: string;
  due_date?: string;
  created_at?: string;
  user_id: string;
  status?: 'upcoming' | 'missed' | 'paid';
};

type TabType = 'upcoming' | 'missed' | 'paid';

export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const { colors, isDark } = useTheme();

  // Configure notifications
  useEffect(() => {
    const setupNotifications = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please enable notifications for reminder alerts.');
      }
    };
    setupNotifications();
  }, []);

  // Fetch reminders
  const fetchReminders = async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) return setReminders([]);

      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", userId)
        .order("due_date", { ascending: true });

      if (error) throw error;

      // Update status based on due date
      const updatedReminders = (data || []).map(reminder => {
        let status: 'upcoming' | 'missed' | 'paid' = reminder.status || 'upcoming';
        
        // Only update status if it's not already paid
        if (status !== 'paid' && reminder.due_date) {
          const dueDate = new Date(reminder.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dueDate.setHours(0, 0, 0, 0);
          
          if (dueDate < today) {
            status = 'missed';
          }
        }
        
        return { ...reminder, status };
      });

      setReminders(updatedReminders);
    } catch (err: any) {
      console.error("Error fetching reminders:", err);
      Alert.alert("Error", `Failed to load reminders: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  // Filter reminders based on active tab
  useEffect(() => {
    const filtered = reminders.filter(rem => rem.status === activeTab);
    setFilteredReminders(filtered);
  }, [reminders, activeTab]);

  // Schedule notification for reminder - FIXED VERSION
  const scheduleNotification = async (reminder: Reminder) => {
    if (!reminder.due_date) return;

    const triggerDate = new Date(reminder.due_date);
    triggerDate.setHours(9, 0, 0); // Notify at 9 AM on due date

    // Only schedule if the date is in the future
    if (triggerDate > new Date()) {
      // Create proper trigger object for expo-notifications
      const trigger: Notifications.DateTriggerInput = {
        type: 'date',
        date: triggerDate,
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Reminder Due!',
          body: `${reminder.title}${reminder.amount ? ` - KES ${reminder.amount}` : ''} is due today.`,
          sound: 'default',
        },
        trigger,
      });
    }
  };

  // Add new reminder
  const addReminder = async () => {
    if (!title.trim()) return Alert.alert("Validation", "Enter a title");

    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) return Alert.alert("Error", "User not authenticated");

      // Determine initial status based on due date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(selectedDate);
      dueDate.setHours(0, 0, 0, 0);
      
      const initialStatus = dueDate < today ? 'missed' : 'upcoming';

      const reminderData: any = {
        title: title.trim(),
        user_id: userId,
        due_date: selectedDate.toISOString(),
        status: initialStatus,
      };

      if (amount.trim()) reminderData.amount = amount.trim();

      const { data, error } = await supabase
        .from("reminders")
        .insert([reminderData])
        .select();

      if (error) throw error;

      // Schedule notification for new reminder
      if (data && data[0]) {
        await scheduleNotification(data[0]);
      }

      setTitle("");
      setAmount("");
      setSelectedDate(new Date());
      setShowModal(false);
      fetchReminders();
      Alert.alert("Success", "Reminder added successfully!");
    } catch (err: any) {
      console.error("Error adding reminder:", err);
      Alert.alert("Error", `Failed to save reminder: ${err.message}`);
    }
  };

  // Mark reminder as paid - FIXED VERSION
  const markAsPaid = async (reminderId: string) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      
      if (!userId) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      // Update only the status field
      const { error } = await supabase
        .from("reminders")
        .update({ status: 'paid' })
        .eq("id", reminderId)
        .eq("user_id", userId); // Extra security check

      if (error) {
        // If there's an error about updated_at field, try without it
        if (error.message.includes('updated_at')) {
          const { error: retryError } = await supabase
            .from("reminders")
            .update({ status: 'paid' })
            .eq("id", reminderId)
            .eq("user_id", userId);
            
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      // Update local state immediately for better UX
      setReminders(prev => 
        prev.map(rem => 
          rem.id === reminderId ? { ...rem, status: 'paid' } : rem
        )
      );
      
      Alert.alert("Success", "Reminder marked as paid!");
    } catch (err: any) {
      console.error("Error updating reminder:", err);
      Alert.alert("Error", `Failed to update reminder: ${err.message}`);
      // Refresh to sync with server
      fetchReminders();
    }
  };

  // Delete reminder
  const deleteReminder = async (reminderId: string) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      
      if (!userId) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      const { error } = await supabase
        .from("reminders")
        .delete()
        .eq("id", reminderId)
        .eq("user_id", userId);

      if (error) throw error;

      // Update local state immediately
      setReminders(prev => prev.filter(rem => rem.id !== reminderId));
      
      Alert.alert("Success", "Reminder deleted successfully!");
    } catch (err: any) {
      console.error("Error deleting reminder:", err);
      Alert.alert("Error", `Failed to delete reminder: ${err.message}`);
    }
  };

  const renderReminderItem = ({ item }: { item: Reminder }) => (
    <View style={[styles.reminderItem, { borderColor: colors.border, backgroundColor: colors.cardBackground || colors.card }]}>
      <View style={styles.reminderHeader}>
        <Text style={[styles.reminderTitle, { color: colors.text }]}>{item.title}</Text>
        {item.amount && <Text style={[styles.reminderAmount, { color: colors.text }]}>KES {item.amount}</Text>}
      </View>
      
      {item.due_date && (
        <Text style={[styles.reminderDate, { color: colors.subtitle || colors.textSecondary }]}>
          Due: {new Date(item.due_date).toLocaleDateString()}
        </Text>
      )}
      
      <View style={styles.reminderActions}>
        {item.status === 'upcoming' && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => markAsPaid(item.id)}
          >
            <Text style={styles.actionButtonText}>Mark as Paid</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
          onPress={() => {
            Alert.alert(
              "Delete Reminder",
              "Are you sure you want to delete this reminder?",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteReminder(item.id) }
              ]
            );
          }}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
      
      {/* Status Badge */}
      <View style={[
        styles.statusBadge,
        { 
          backgroundColor: 
            item.status === 'paid' ? '#10b981' : 
            item.status === 'missed' ? '#ef4444' : 
            colors.primary 
        }
      ]}>
        <Text style={styles.statusBadgeText}>
          {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Upcoming'}
        </Text>
      </View>
    </View>
  );

  const TabButton = ({ tab, label }: { tab: TabType; label: string }) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tab && [styles.activeTab, { backgroundColor: colors.primary }]
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[
        styles.tabText,
        { color: activeTab === tab ? '#fff' : colors.text }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading reminders...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Reminders</Text>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TabButton tab="upcoming" label="Upcoming" />
        <TabButton tab="missed" label="Missed" />
        <TabButton tab="paid" label="Paid" />
      </View>

      <TouchableOpacity
        style={[styles.addNewButton, { backgroundColor: colors.primary }]}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addNewText}>Add Reminder</Text>
      </TouchableOpacity>

      <FlatList
        data={filteredReminders}
        keyExtractor={(item) => item.id}
        renderItem={renderReminderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              No {activeTab} reminders found
            </Text>
          </View>
        }
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? "#00000090" : "#00000050" }]}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Reminder</Text>
              
              <TextInput
                placeholder="Title *"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={setTitle}
                style={[styles.input, { backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.text, borderColor: colors.border }]}
              />
              
              <TextInput
                placeholder="Amount (KES)"
                placeholderTextColor={colors.textSecondary}
                value={amount}
                onChangeText={setAmount}
                style={[styles.input, { backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.text, borderColor: colors.border }]}
                keyboardType="numeric"
              />

              <TouchableOpacity 
                onPress={() => setShowDatePicker(true)} 
                style={[styles.datePickerBtn, { borderColor: colors.primary }]}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  Due Date: {selectedDate.toLocaleDateString('en-GB')}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (date) setSelectedDate(date);
                  }}
                />
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.cancelBtn, { borderColor: colors.primary }]} 
                  onPress={() => setShowModal(false)}
                >
                  <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]} 
                  onPress={addReminder}
                >
                  <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 16 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 16 },
  
  // Tab styles
  tabContainer: { 
    flexDirection: "row", 
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  activeTab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  
  addNewButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 12, 
    borderRadius: 8, 
    marginBottom: 16 
  },
  addNewText: { color: "#fff", fontWeight: "600", fontSize: 16, marginLeft: 8 },
  
  reminderItem: { 
    padding: 16, 
    borderRadius: 8, 
    borderWidth: 1, 
    marginBottom: 8,
    position: 'relative',
  },
  reminderHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginBottom: 4,
    paddingRight: 70, // Space for status badge
  },
  reminderTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  reminderAmount: { fontSize: 16, fontWeight: "700", marginLeft: 8 },
  reminderDate: { fontSize: 14, marginBottom: 12 },
  
  reminderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 10,
  },
  
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyText: { 
    textAlign: 'center', 
    marginTop: 16, 
    fontSize: 16,
    opacity: 0.7,
  },
  
  modalOverlay: { flex: 1 },
  modalScrollContent: { flexGrow: 1, justifyContent: "center" },
  modalContent: { 
    borderRadius: 16, 
    padding: 20, 
    margin: 20, 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 12, 
    elevation: 5 
  },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 16 },
  input: { 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 12, 
    borderWidth: 1, 
    fontSize: 16 
  },
  datePickerBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 20 
  },
  dateText: { marginLeft: 8, fontWeight: "500", fontSize: 16 },
  modalActions: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    gap: 12 
  },
  cancelBtn: { 
    borderWidth: 1, 
    borderRadius: 8, 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    flex: 1, 
    alignItems: "center" 
  },
  cancelText: { fontWeight: "600", fontSize: 16 },
  saveBtn: { 
    borderRadius: 8, 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    flex: 1, 
    alignItems: "center" 
  },
  saveText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});