// src/screens/RemindersScreen.tsx - COMPLETELY UPDATED
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  Modal, 
  TextInput, 
  StyleSheet,
  Switch,
  ScrollView,
  Platform
} from "react-native";
import { supabase } from "../supabaseClient";
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';

type Reminder = {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  due_date: string;
  is_recurring: boolean;
  status: "pending" | "paid" | "missed" | "upcoming";
  reminder_sent: boolean;
  category: string;
};

// Configure notifications handler
// Fix the notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  } as Notifications.NotificationBehavior),
});

// Fix the scheduleNotification function
const scheduleNotification = async (title: string, body: string, seconds: number) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
    },
    trigger: {
      type: 'timeInterval',
      seconds: seconds,
    } as Notifications.TimeIntervalTriggerInput,
  });
};

export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [newReminder, setNewReminder] = useState({
    title: "",
    amount: "",
    due_date: new Date(),
    is_recurring: false,
    category: "bills"
  });

  // Configure notifications
  useEffect(() => {
    configureNotifications();
  }, []);

  const configureNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please enable notifications for reminder alerts');
    }
  };

  const loadReminders = async () => {
    try {
      console.log("🔄 Loading reminders...");
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.log("❌ No user found");
        return;
      }

      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", user.user.id)
        .order("due_date", { ascending: true });

      if (error) {
        console.error("❌ Reminders load error:", error);
        Alert.alert("Error", "Failed to load reminders: " + error.message);
      } else {
        console.log("✅ Loaded reminders:", data?.length || 0);
        const updatedReminders = await updateReminderStatuses(data || []);
        setReminders(updatedReminders);
        calculateNotificationCount(updatedReminders);
        await scheduleNotifications(updatedReminders);
      }
    } catch (error) {
      console.error("❌ Unexpected error loading reminders:", error);
    }
  };

  const updateReminderStatuses = async (reminders: Reminder[]) => {
    const today = new Date();
    const updatedReminders = reminders.map(reminder => {
      const dueDate = new Date(reminder.due_date);
      const timeDiff = dueDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

      let status: Reminder["status"] = reminder.status;
      
      if (reminder.status === "paid") return reminder;
      
      if (daysDiff < 0) {
        status = "missed";
      } else if (daysDiff <= 1) {
        status = "upcoming";
      } else {
        status = "pending";
      }

      return { ...reminder, status };
    });

    // Update statuses in database
    for (const reminder of updatedReminders) {
      if (reminder.status !== "paid") {
        await supabase
          .from("reminders")
          .update({ status: reminder.status })
          .eq("id", reminder.id);
      }
    }

    return updatedReminders;
  };

  const calculateNotificationCount = (reminders: Reminder[]) => {
    const count = reminders.filter(
      reminder => reminder.status === "upcoming" || reminder.status === "missed"
    ).length;
    setNotificationCount(count);
  };

  const scheduleNotifications = async (reminders: Reminder[]) => {
    try {
      // Cancel all existing notifications
      await Notifications.cancelAllScheduledNotificationsAsync();

      for (const reminder of reminders) {
        if (reminder.status === "paid" || reminder.reminder_sent) continue;

        const dueDate = new Date(reminder.due_date);
        const now = new Date();
        
        // Schedule notification for 1 day before due date
        const notificationTime = new Date(dueDate);
        notificationTime.setDate(notificationTime.getDate() - 1);

        if (notificationTime > now) {
          // Convert to seconds for trigger
          const triggerSeconds = Math.floor((notificationTime.getTime() - now.getTime()) / 1000);
          
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "💰 Bill Reminder",
              body: `"${reminder.title}" of KES ${reminder.amount} is due tomorrow!`,
              sound: 'default',
              data: { reminderId: reminder.id },
            },
            trigger: {
              seconds: triggerSeconds > 0 ? triggerSeconds : 1,
            },
          });
        }

        // Schedule notification for due date
        if (dueDate > now) {
          // Convert to seconds for trigger
          const triggerSeconds = Math.floor((dueDate.getTime() - now.getTime()) / 1000);
          
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "⏰ Payment Due Today",
              body: `"${reminder.title}" - KES ${reminder.amount} is due today!`,
              sound: 'default',
              data: { reminderId: reminder.id },
            },
            trigger: {
              seconds: triggerSeconds > 0 ? triggerSeconds : 1,
            },
          });
        }
      }
    } catch (error) {
      console.error("❌ Error scheduling notifications:", error);
    }
  };

  useEffect(() => {
    loadReminders();
    
    // Listen for notifications
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      loadReminders();
    });

    return () => subscription.remove();
  }, []);

  // Platform-specific date input
  const renderDateInput = () => {
    if (Platform.OS === 'web') {
      return (
        <input
          type="date"
          value={newReminder.due_date.toISOString().split('T')[0]}
          onChange={(e) => {
            const date = new Date(e.target.value);
            setNewReminder({ ...newReminder, due_date: date });
          }}
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            fontSize: 16,
            width: '100%'
          }}
        />
      );
    }

    return (
      <>
        <TouchableOpacity 
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar" size={20} color="#666" />
          <Text style={styles.dateInputText}>
            {newReminder.due_date.toLocaleDateString()}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={newReminder.due_date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                setNewReminder({ ...newReminder, due_date: selectedDate });
              }
            }}
          />
        )}
      </>
    );
  };

  const addReminder = async () => {
    console.log("🔄 Attempting to save reminder...");
    console.log("Reminder data:", newReminder);
    
    if (!newReminder.title) {
      console.log("❌ Validation failed: No title");
      Alert.alert("Error", "Please enter a title for your reminder");
      return;
    }

    const { data: user } = await supabase.auth.getUser();
    console.log("User:", user?.user?.id);
    
    if (!user.user) {
      console.log("❌ No user found");
      Alert.alert("Error", "Please log in to create reminders");
      return;
    }

    const dueDate = newReminder.due_date.toISOString().split('T')[0];
    console.log("Formatted due date:", dueDate);

    try {
      const { data, error } = await supabase.from("reminders").insert([
        {
          user_id: user.user.id,
          title: newReminder.title,
          amount: Number(newReminder.amount) || 0,
          due_date: dueDate,
          is_recurring: newReminder.is_recurring,
          status: "pending",
          reminder_sent: false,
          category: newReminder.category,
        },
      ]).select();

      if (error) {
        console.log("❌ Database error:", error);
        Alert.alert("Error", error.message);
      } else {
        console.log("✅ Reminder saved successfully!", data);
        setModalVisible(false);
        setNewReminder({ 
          title: "", 
          amount: "", 
          due_date: new Date(), 
          is_recurring: false,
          category: "bills" 
        });
        loadReminders();
        Alert.alert("Success", "Reminder added with notifications scheduled!");
      }
    } catch (error) {
      console.log("❌ Unexpected error:", error);
      Alert.alert("Error", "Failed to save reminder");
    }
  };

  const markAsPaid = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from("reminders")
        .update({ status: "paid" })
        .eq("id", reminderId);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        loadReminders();
      }
    } catch (error) {
      console.error("Error marking as paid:", error);
    }
  };

  const deleteReminder = async (reminderId: string) => {
    Alert.alert(
      "Delete Reminder",
      "Are you sure you want to delete this reminder?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("reminders")
                .delete()
                .eq("id", reminderId);

              if (error) {
                Alert.alert("Error", error.message);
              } else {
                loadReminders();
              }
            } catch (error) {
              console.error("Error deleting reminder:", error);
            }
          }
        }
      ]
    );
  };

  const getStatusIcon = (status: Reminder["status"]) => {
    switch (status) {
      case "paid": return { icon: "checkmark-circle", color: "#28a745" };
      case "missed": return { icon: "close-circle", color: "#dc3545" };
      case "upcoming": return { icon: "warning", color: "#ffc107" };
      default: return { icon: "time", color: "#6c757d" };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "bills": return "receipt";
      case "subscriptions": return "repeat";
      case "rent": return "home";
      case "utilities": return "flash";
      case "other": return "document";
      default: return "alert-circle";
    }
  };

  const formatCountdown = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const timeDiff = due.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) return `${Math.abs(daysDiff)} days overdue`;
    if (daysDiff === 0) return "Due today";
    if (daysDiff === 1) return "Due tomorrow";
    return `Due in ${daysDiff} days`;
  };

  return (
    <View style={styles.container}>
      {/* Header with Notification Badge */}
      <View style={styles.header}>
        <Text style={styles.title}>Bill Reminders</Text>
        <View style={styles.notificationContainer}>
          <Ionicons name="notifications" size={24} color="#333" />
          {notificationCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notificationCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {reminders.filter(r => r.status === "upcoming").length}
          </Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {reminders.filter(r => r.status === "missed").length}
          </Text>
          <Text style={styles.statLabel}>Missed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {reminders.filter(r => r.status === "paid").length}
          </Text>
          <Text style={styles.statLabel}>Paid</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Add New Reminder</Text>
      </TouchableOpacity>

      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[
            styles.reminderCard,
            item.status === "missed" && styles.missedCard,
            item.status === "upcoming" && styles.upcomingCard,
            item.status === "paid" && styles.paidCard
          ]}>
            <View style={styles.reminderHeader}>
              <View style={styles.reminderTitleContainer}>
                <Ionicons 
                  name={getCategoryIcon(item.category) as any} 
                  size={20} 
                  color="#007AFF" 
                />
                <Text style={styles.reminderTitle}>{item.title}</Text>
              </View>
              <Ionicons 
                name={getStatusIcon(item.status).icon as any} 
                size={24} 
                color={getStatusIcon(item.status).color} 
              />
            </View>

            <Text style={styles.reminderAmount}>KES {item.amount.toLocaleString()}</Text>
            
            <View style={styles.reminderFooter}>
              <View style={styles.dateContainer}>
                <Ionicons name="calendar" size={16} color="#666" />
                <Text style={styles.reminderDate}>
                  {new Date(item.due_date).toLocaleDateString()} • {formatCountdown(item.due_date)}
                </Text>
              </View>
              
              <View style={styles.actionButtons}>
                {item.status !== "paid" && (
                  <TouchableOpacity 
                    style={styles.paidButton}
                    onPress={() => markAsPaid(item.id)}
                  >
                    <Text style={styles.paidButtonText}>Mark Paid</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => deleteReminder(item.id)}
                >
                  <Ionicons name="trash" size={16} color="#dc3545" />
                </TouchableOpacity>
              </View>
            </View>

            {item.is_recurring && (
              <View style={styles.recurringBadge}>
                <Ionicons name="repeat" size={12} color="#007AFF" />
                <Text style={styles.recurringText}>Recurring</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateTitle}>No reminders yet</Text>
            <Text style={styles.emptyStateText}>
              Add your first bill reminder to get started with smart notifications
            </Text>
          </View>
        }
      />

      {/* Add Reminder Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Reminder</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <TextInput
                style={styles.input}
                placeholder="Reminder title (e.g., 'Electricity Bill')"
                value={newReminder.title}
                onChangeText={(text) => setNewReminder({ ...newReminder, title: text })}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Amount (KES)"
                keyboardType="numeric"
                value={newReminder.amount}
                onChangeText={(text) => setNewReminder({ ...newReminder, amount: text })}
              />

              {/* Platform-specific date input */}
              {renderDateInput()}

              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Recurring monthly</Text>
                <Switch
                  value={newReminder.is_recurring}
                  onValueChange={(value) => setNewReminder({ ...newReminder, is_recurring: value })}
                  trackColor={{ false: "#767577", true: "#81b0ff" }}
                  thumbColor={newReminder.is_recurring ? "#007AFF" : "#f4f3f4"}
                />
              </View>

              <View style={styles.categoryContainer}>
                <Text style={styles.categoryLabel}>Category</Text>
                <View style={styles.categoryOptions}>
                  {["bills", "subscriptions", "rent", "utilities", "other"].map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        newReminder.category === category && styles.categoryButtonActive
                      ]}
                      onPress={() => setNewReminder({ ...newReminder, category })}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        newReminder.category === category && styles.categoryButtonTextActive
                      ]}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={addReminder}
              >
                <Ionicons name="notifications" size={18} color="#fff" />
                <Text style={styles.saveButtonText}>Save with Reminders</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Keep all your existing styles exactly the same...
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f8f9fa" },
  header: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: "bold", color: "#1a1a1a" },
  notificationContainer: { position: "relative" },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#dc3545",
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: { color: "white", fontSize: 10, fontWeight: "bold" },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  statLabel: {
    fontSize: 12,
    color: "#6c757d",
    marginTop: 4,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#007AFF", 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 20,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addButtonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  reminderCard: {
    backgroundColor: "white", 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  missedCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#dc3545",
  },
  upcomingCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#ffc107",
  },
  paidCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#28a745",
    opacity: 0.8,
  },
  reminderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  reminderTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  reminderTitle: { 
    fontSize: 16, 
    fontWeight: "bold", 
    flex: 1,
    color: "#1a1a1a",
  },
  reminderAmount: { 
    fontSize: 18, 
    fontWeight: "bold", 
    color: "#007AFF",
    marginBottom: 8,
  },
  reminderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  reminderDate: { 
    fontSize: 12, 
    color: "#666",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  paidButton: {
    backgroundColor: "#28a745",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  paidButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
  },
  deleteButton: {
    padding: 6,
  },
  recurringBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  recurringText: {
    fontSize: 10,
    color: "#007AFF",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },
  modalContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "rgba(0,0,0,0.5)" 
  },
  modalContent: { 
    backgroundColor: "white", 
    borderRadius: 16, 
    width: "90%", 
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#1a1a1a" },
  modalScroll: {
    padding: 20,
  },
  input: { 
    borderWidth: 1, 
    borderColor: "#ddd", 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 16,
    fontSize: 16,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateInputText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  switchLabel: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  categoryOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  categoryButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  categoryButtonText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  categoryButtonTextActive: {
    color: "white",
  },
  modalActions: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  saveButton: {
    backgroundColor: "#007AFF",
    flexDirection: "row",
    gap: 8,
  },
  cancelButtonText: {
    color: "#666",
    fontWeight: "bold",
    fontSize: 16,
  },
  saveButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});