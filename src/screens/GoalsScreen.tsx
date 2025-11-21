import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { supabase } from "../supabaseClient";
import { colors, radius, spacing } from "../constants/styles";
import DateTimePicker from '@react-native-community/datetimepicker';

type Goal = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  deadline?: string | null;
  status: string;
  created_at?: string;
};

// Currency formatter
const formatCurrency = (amount: number) => {
  return `KES ${Number(amount).toLocaleString()}`;
};

const { width: screenWidth } = Dimensions.get('window');

export default function GoalsScreen() {
  const [data, setData] = useState<Goal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Goal> | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [quickSaveAmount, setQuickSaveAmount] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const getUser = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user;
  };

  const load = useCallback(async () => {
    try {
      const user = await getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Goals load error:", error);
        Alert.alert("Error", error.message);
        return;
      }
      
      let goals: Goal[] = data || [];
      
      // Check if we have any goals, if not create a default one
      if (goals.length === 0) {
        const { data: newGoal } = await supabase
          .from("goals")
          .insert([{
            user_id: user.id,
            name: "Emergency Fund",
            target_amount: 50000,
            saved_amount: 0,
            status: 'active',
          }])
          .select();
          
        if (newGoal) {
          goals = [newGoal[0], ...goals];
        }
      }
      
      setData(goals);
    } catch (error) {
      console.error("Failed to load goals:", error);
      Alert.alert("Error", "Failed to load goals");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onDelete = async (g: Goal) => {
    Alert.alert("Delete goal?", `This will delete "${g.name}".`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("goals")
              .delete()
              .eq("id", g.id);

            if (error) {
              Alert.alert("Error", error.message);
            } else {
              setData(prev => prev.filter(item => item.id !== g.id));
            }
          } catch (error) {
            Alert.alert("Error", "Failed to delete goal");
          }
        },
      },
    ]);
  };

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      setDraft(prev => ({ 
        ...prev, 
        deadline: date.toISOString().split('T')[0] 
      }));
    }
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  const addToSavings = async (goalId: string, amount: number) => {
    if (!amount || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    try {
      const goal = data.find(g => g.id === goalId);
      if (!goal) return;

      const newAmount = goal.saved_amount + amount;
      
      const { error } = await supabase
        .from("goals")
        .update({ saved_amount: newAmount })
        .eq("id", goalId);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        setData(prev => 
          prev.map(g => 
            g.id === goalId 
              ? { ...g, saved_amount: newAmount }
              : g
          )
        );
        Alert.alert("Success", `KES ${amount} added to ${goal.name}`);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to add savings");
    }
  };

  const openEdit = (g?: Goal) => {
    setDraft(
      g
        ? { 
            ...g,
            deadline: g.deadline || "",
          }
        : { 
            id: "", 
            name: "", 
            target_amount: 0, 
            saved_amount: 0, 
            status: "active",
            deadline: "",
          }
    );
    
    if (g?.deadline) {
      setSelectedDate(new Date(g.deadline));
    } else {
      setSelectedDate(new Date());
    }
    
    setOpen(true);
  };

  const save = async () => {
    if (!draft?.name || !draft?.target_amount) {
      Alert.alert("Missing", "Please fill name and target amount.");
      return;
    }

    try {
      const user = await getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in.");
        return;
      }

      const goalData = {
        user_id: user.id,
        name: draft.name.trim(),
        target_amount: Number(draft.target_amount),
        saved_amount: Number(draft.saved_amount || 0),
        deadline: draft.deadline || null,
        status: draft.status || "active",
      };

      if (!draft.id) {
        const { data: created, error } = await supabase
          .from("goals")
          .insert([goalData])
          .select();

        if (error) {
          Alert.alert("Error", error.message);
        } else if (created && created[0]) {
          setOpen(false);
          setData(prev => [created[0] as Goal, ...prev]);
          setDraft(null);
        }
      } else {
        const { error } = await supabase
          .from("goals")
          .update(goalData)
          .eq("id", draft.id);

        if (error) {
          Alert.alert("Error", error.message);
        } else {
          setOpen(false);
          setData(prev => 
            prev.map(item => 
              item.id === draft.id 
                ? { ...item, ...goalData } as Goal
                : item
            )
          );
          setDraft(null);
        }
      }
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert("Error", "Failed to save goal");
    }
  };

  const renderGoalCard = (item: Goal) => {
    const current = Number(item.saved_amount || 0);
    const target = Number(item.target_amount || 1);
    const pct = Math.min(100, Math.round((current / target) * 100));
    const daysLeft = item.deadline ? Math.ceil((new Date(item.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

    // Default color for all goals
    const defaultColor = '#667eea';

    return (
      <TouchableOpacity 
        style={[
          styles.card,
          { 
            borderLeftColor: defaultColor, 
            borderLeftWidth: 6,
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 5,
          }
        ]}
        onPress={() => setSelectedGoal(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.goalIconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: `${defaultColor}20` }]}>
              <Icon 
                name="target" 
                size={24} 
                color={defaultColor} 
              />
            </View>
          </View>
          
          <View style={styles.goalInfo}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.amount}>
              {formatCurrency(current)} / {formatCurrency(target)}
            </Text>
          </View>
        </View>
        
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Progress</Text>
            <Text style={styles.percentage}>{pct}%</Text>
          </View>
          <View style={styles.progressWrap}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${pct}%`,
                  backgroundColor: defaultColor
                }
              ]} 
            />
          </View>
        </View>
        
        <View style={styles.cardFooter}>
          <View style={styles.footerInfo}>
            {item.deadline && (
              <View style={styles.deadlineContainer}>
                <Icon name="calendar" size={14} color="#64748b" />
                <Text style={styles.deadline}>
                  {daysLeft && daysLeft > 0 ? `${daysLeft} days left` : 'Due: ' + new Date(item.deadline).toLocaleDateString()}
                </Text>
              </View>
            )}
            <View style={styles.statusIndicator}>
              <View 
                style={[
                  styles.statusDot,
                  { backgroundColor: pct >= 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }
                ]} 
              />
              <Text style={styles.statusText}>
                {pct >= 100 ? 'Completed' : pct >= 50 ? 'On Track' : 'Needs Attention'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.addMoneyBtn]} 
            onPress={() => {
              Alert.prompt(
                `Add to ${item.name}`,
                'Enter amount to add:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Add', 
                    onPress: (amount) => {
                      if (amount) {
                        addToSavings(item.id, Number(amount));
                      }
                    }
                  }
                ],
                'plain-text',
                '',
                'numeric'
              );
            }}
          >
            <Icon name="plus-circle" size={16} color="#fff" />
            <Text style={styles.btnText}>Add Money</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, styles.editBtn]} 
            onPress={() => openEdit(item)}
          >
            <Icon name="pencil" size={16} color="#fff" />
            <Text style={styles.btnText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, styles.deleteBtn]} 
            onPress={() => onDelete(item)}
          >
            <Icon name="delete" size={16} color="#fff" />
            <Text style={styles.btnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Goals</Text>
          <Text style={styles.headerSubtitle}>Track and achieve your financial dreams</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => openEdit()}>
          <Icon name="plus" size={20} color="#fff" />
          <Text style={styles.addButtonText}>New Goal</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderGoalCard(item)}
        onRefresh={onRefresh}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIllustration}>
              <Icon name="target" size={80} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyTitle}>No goals yet</Text>
            <Text style={styles.emptySubtitle}>
              Start your savings journey by creating your first goal
            </Text>
            <TouchableOpacity style={styles.createFirstButton} onPress={() => openEdit()}>
              <Text style={styles.createFirstText}>Create Your First Goal</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Edit/Create Modal */}
      <Modal 
        visible={open} 
        animationType="slide" 
        transparent 
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {draft?.id ? "Edit Goal" : "Create New Goal"}
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}>
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Goal Name</Text>
                <TextInput
                  placeholder="What are you saving for?"
                  value={draft?.name ?? ""}
                  onChangeText={(text) => setDraft(prev => ({ ...prev, name: text }))}
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Target Amount</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>KES</Text>
                  <TextInput
                    placeholder="50000"
                    keyboardType="numeric"
                    value={draft?.target_amount?.toString() ?? ""}
                    onChangeText={(text) => 
                      setDraft(prev => ({ ...prev, target_amount: Number(text) || 0 }))
                    }
                    style={styles.amountInput}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Currently Saved</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>KES</Text>
                  <TextInput
                    placeholder="0"
                    keyboardType="numeric"
                    value={draft?.saved_amount?.toString() ?? "0"}
                    onChangeText={(text) => 
                      setDraft(prev => ({ ...prev, saved_amount: Number(text) || 0 }))
                    }
                    style={styles.amountInput}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Target Date (Optional)</Text>
                <TouchableOpacity style={styles.dateInput} onPress={showDatepicker}>
                  <Icon name="calendar" size={20} color="#64748b" />
                  <Text style={styles.dateText}>
                    {draft?.deadline ? new Date(draft.deadline).toLocaleDateString() : 'Select a date'}
                  </Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                  minimumDate={new Date()}
                />
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setOpen(false);
                  setDraft(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={save}
              >
                <Text style={styles.saveButtonText}>
                  {draft?.id ? "Update Goal" : "Create Goal"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { 
    flex: 1, 
    backgroundColor: '#f8fafc', 
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.lg || 24,
    paddingTop: 60,
    paddingBottom: spacing.lg || 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: spacing.md || 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.lg || 24,
    margin: spacing.lg || 24,
    marginBottom: spacing.md || 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  goalIconContainer: {
    marginRight: 12,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalInfo: {
    flex: 1,
  },
  title: {
    fontWeight: "700",
    fontSize: 18,
    color: '#0f172a',
    marginBottom: 4,
  },
  amount: {
    fontWeight: "700",
    color: '#0f172a',
    fontSize: 16,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  percentage: {
    fontWeight: "700",
    color: '#0f172a',
    fontSize: 14,
  },
  progressWrap: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  cardFooter: {
    marginBottom: 8,
  },
  footerInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deadlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deadline: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  addMoneyBtn: {
    backgroundColor: '#667eea',
  },
  editBtn: {
    backgroundColor: '#10b981',
  },
  deleteBtn: {
    backgroundColor: "#ef4444",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyIllustration: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  createFirstButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createFirstText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg || 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: '#0f172a',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: spacing.lg || 24,
  },
  formGroup: {
    marginBottom: spacing.lg || 24,
  },
  label: {
    fontWeight: "700",
    color: '#0f172a',
    marginBottom: 8,
    fontSize: 16,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    fontSize: 16,
    color: '#0f172a',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    paddingVertical: 14,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  dateText: {
    fontSize: 16,
    color: '#0f172a',
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    padding: spacing.lg || 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  saveButton: {
    backgroundColor: '#667eea',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelButtonText: {
    color: '#64748b',
    fontWeight: "700",
    fontSize: 16,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});