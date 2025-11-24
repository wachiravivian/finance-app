// screens/GoalsScreen.tsx - CLEANED VERSION WITHOUT DEBUG/TEST BUTTONS
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
  ActivityIndicator,
  RefreshControl,
  Vibration,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { supabase } from "../supabaseClient";
import { useTheme } from "../hooks/useTheme";
import { useFocusEffect } from '@react-navigation/native';

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

type Payment = {
  id: string;
  goal_id: string;
  amount: number;
  mpesa_receipt: string;
  phone_number: string;
  status: string;
  created_at: string;
};

type PaymentModalState = {
  visible: boolean;
  goal: Goal | null;
  amount: string;
  phone: string;
  loading: boolean;
  error?: string;
};

type ManualAddModalState = {
  visible: boolean;
  goal: Goal | null;
  amount: string;
  loading: boolean;
  error?: string;
};

type PaymentHistoryModalState = {
  visible: boolean;
  goal: Goal | null;
  payments: Payment[];
  loading: boolean;
};

type PaymentSuccessState = {
  visible: boolean;
  goalName: string;
  amount: number;
  receipt?: string;
  goalId?: string;
};

const formatCurrency = (amount: number) => `KSH ${Number(amount).toLocaleString()}`;
const { width: screenWidth } = Dimensions.get("window");

export default function GoalsScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState<Goal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Goal> | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Payment modal state
  const [paymentModal, setPaymentModal] = useState<PaymentModalState>({
    visible: false,
    goal: null,
    amount: "",
    phone: "",
    loading: false,
    error: "",
  });

  // Manual add modal state
  const [manualAddModal, setManualAddModal] = useState<ManualAddModalState>({
    visible: false,
    goal: null,
    amount: "",
    loading: false,
    error: "",
  });

  // Payment history modal state
  const [paymentHistoryModal, setPaymentHistoryModal] = useState<PaymentHistoryModalState>({
    visible: false,
    goal: null,
    payments: [],
    loading: false,
  });

  // Payment success modal state
  const [paymentSuccess, setPaymentSuccess] = useState<PaymentSuccessState>({
    visible: false,
    goalName: '',
    amount: 0,
    receipt: '',
    goalId: ''
  });

  const getUser = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      setCurrentUser(data.user);
      return data.user;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  };

  const loadGoals = useCallback(async () => {
    try {
      setLoading(true);
      const user = await getUser();
      if (!user) {
        console.log("No user found");
        return;
      }
      
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setData(data || []);
      console.log("Loaded goals:", data?.length || 0);
    } catch (err: any) {
      console.error('Error loading goals:', err);
      Alert.alert("Error", err.message || "Failed to load goals");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPaymentHistory = async (goalId: string) => {
    try {
      setPaymentHistoryModal(prev => ({ ...prev, loading: true }));
      
      const { data: payments, error } = await supabase
        .from("goal_payments")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPaymentHistoryModal(prev => ({
        ...prev,
        payments: payments || [],
        loading: false
      }));
    } catch (err: any) {
      console.error('Error loading payment history:', err);
      setPaymentHistoryModal(prev => ({ ...prev, loading: false }));
    }
  };

  // REAL-TIME UPDATES SETUP
  useEffect(() => {
    const setupRealTimeUpdates = async () => {
      const user = await getUser();
      if (!user) return;

      console.log('🔔 Setting up real-time updates for user:', user.id);

      // Subscribe to goal_updates table
      const goalUpdatesSubscription = supabase
        .channel('goal_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'goal_updates',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🔄 Real-time goal update received:', payload);
            handleRealTimeUpdate(payload.new);
          }
        )
        .subscribe((status) => {
          console.log('📡 Real-time subscription status:', status);
        });

      // Subscribe to goals table changes for this user
      const goalsSubscription = supabase
        .channel('goals_changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'goals',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🔄 Real-time goal change received:', payload);
            handleGoalUpdate(payload.new);
          }
        )
        .subscribe();

      return () => {
        goalUpdatesSubscription.unsubscribe();
        goalsSubscription.unsubscribe();
      };
    };

    setupRealTimeUpdates();
  }, []);

  // Handle real-time updates from goal_updates table
  const handleRealTimeUpdate = async (update: any) => {
    console.log('📢 Processing real-time update:', update);
    
    if (update.type === 'mpesa_payment_success') {
      // Refresh goals to get updated amounts
      await loadGoals();
      
      // Vibrate for success
      Vibration.vibrate(500);
      
      // Show success message
      setPaymentSuccess({
        visible: true,
        goalName: update.message.includes('for') 
          ? update.message.split('for ')[1] 
          : 'your goal',
        amount: update.amount,
        receipt: update.mpesa_receipt,
        goalId: update.goal_id
      });
      
      console.log('✅ Payment success modal shown for:', update.goal_id);
      
    } else if (update.type === 'mpesa_payment_failed') {
      // Show failure message
      Alert.alert(
        '❌ Payment Failed',
        update.message || 'Your MPESA payment failed. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Handle direct goal updates
  const handleGoalUpdate = (updatedGoal: Goal) => {
    console.log('🎯 Goal updated:', updatedGoal);
    setData(prev => prev.map(goal => 
      goal.id === updatedGoal.id ? updatedGoal : goal
    ));
  };

  // Backup polling for updates (every 15 seconds)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      loadGoals();
      console.log('🕒 Polling for updates...');
    }, 15000);

    return () => clearInterval(pollInterval);
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🎯 Screen focused, refreshing goals...');
      loadGoals();
    }, [loadGoals])
  );

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGoals();
    setRefreshing(false);
  };

  // Validate phone number
  const validatePhone = (phone: string): { isValid: boolean; error?: string } => {
    if (!phone || phone.trim().length === 0) {
      return { isValid: false, error: "Phone number is required" };
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.startsWith('254') && cleanPhone.length === 12) {
      return { isValid: true };
    } else if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      return { isValid: true };
    } else if (cleanPhone.startsWith('7') && cleanPhone.length === 9) {
      return { isValid: true };
    } else {
      return { 
        isValid: false, 
        error: "Please enter a valid Kenyan phone number (e.g., 07XX XXX XXX)" 
      };
    }
  };

  // ENHANCED MPESA PAYMENT FUNCTION
  const makePaymentToGoal = async () => {
    const { goal, amount, phone } = paymentModal;
    
    setPaymentModal(prev => ({ ...prev, error: "" }));

    // Validation
    if (!goal) {
      setPaymentModal(prev => ({ ...prev, error: "No goal selected" }));
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setPaymentModal(prev => ({ ...prev, error: "Please enter a valid amount" }));
      return;
    }

    if (Number(amount) < 10) {
      setPaymentModal(prev => ({ ...prev, error: "Minimum amount is KSH 10" }));
      return;
    }

    if (Number(amount) > 70000) {
      setPaymentModal(prev => ({ ...prev, error: "Maximum amount is KSH 70,000" }));
      return;
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.isValid) {
      setPaymentModal(prev => ({ ...prev, error: phoneValidation.error }));
      return;
    }

    setPaymentModal(prev => ({ ...prev, loading: true }));

    try {
      const user = await getUser();
      if (!user) {
        throw new Error("Please log in to make payments");
      }

      console.log('💰 Initiating MPESA payment...');
      console.log('📝 Payment details:', { 
        phone, 
        amount: Number(amount), 
        goal: goal.name, 
        user: user.id 
      });

      // Show immediate processing feedback
      Alert.alert(
        "🔄 Processing Payment",
        `Initiating MPESA payment of KSH ${Number(amount).toLocaleString()} to "${goal.name}"...\n\nYou will receive a prompt on ${phone} shortly.`,
        [{ text: "OK" }]
      );

      // Call MPESA function
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('mpesa-stk-goal', {
        body: {
          phone: phone,
          amount: Number(amount),
          goal_id: goal.id,
          user_id: user.id
        }
      });

      console.log('💰 MPESA function FULL response:', JSON.stringify({ paymentData, paymentError }, null, 2));

      if (paymentError) {
        console.error('❌ Function invocation error:', paymentError);
        throw new Error(`Payment service error: ${paymentError.message}`);
      }

      // Check if we got any response
      if (!paymentData) {
        throw new Error('No response received from payment service');
      }

      // Check for success flag
      if (paymentData.success === false) {
        throw new Error(paymentData.error || paymentData.message || 'Payment initiation failed');
      }

      if (!paymentData.success) {
        // If success property doesn't exist or is false
        throw new Error(paymentData.error || paymentData.ResponseDescription || 'Payment was not successful');
      }

      // SUCCESS! Show immediate confirmation
      console.log('✅ Payment initiated successfully:', paymentData);
      
      // Close payment modal immediately
      setPaymentModal({
        visible: false,
        goal: null,
        amount: "",
        phone: "",
        loading: false,
        error: "",
      });

      // Show waiting message with more details
      Alert.alert(
        "📱 MPESA Prompt Sent!", 
        `Check your phone ${phone} to complete the payment of KSH ${Number(amount).toLocaleString()} for "${goal.name}".\n\n💡 Enter your MPESA PIN when prompted.\n\nYour goal will update automatically once payment is confirmed.`,
        [{ 
          text: "OK, I'll check my phone",
          onPress: () => {
            // Start polling for this specific goal
            setTimeout(() => {
              loadGoals();
              console.log('🔄 First auto-refresh after payment');
            }, 5000);
          }
        }]
      );

      // Create a temporary optimistic update
      setData(prev => prev.map(g => 
        g.id === goal.id 
          ? { ...g, saved_amount: g.saved_amount + Number(amount) }
          : g
      ));

    } catch (err: any) {
      console.error("💥 Payment error details:", err);
      console.error("💥 Error message:", err.message);
      
      let errorMessage = "Payment failed. ";
      
      // Specific error handling
      if (err.message?.includes('credentials') || err.message?.includes('configured')) {
        errorMessage += "MPESA service is not properly configured.";
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        errorMessage += "Network error. Please check your internet connection.";
      } else if (err.message?.includes('authentication') || err.message?.includes('token')) {
        errorMessage += "MPESA authentication failed.";
      } else if (err.message?.includes('Insufficient balance')) {
        errorMessage += "Insufficient MPESA balance.";
      } else if (err.message?.includes('transaction value')) {
        errorMessage += "Invalid transaction amount.";
      } else {
        errorMessage += err.message || "Please try again later.";
      }
      
      setPaymentModal(prev => ({ ...prev, error: errorMessage }));
      Alert.alert("❌ Payment Failed", errorMessage);
    } finally {
      setPaymentModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Manual add to savings
  const handleManualAdd = async () => {
    const { goal, amount } = manualAddModal;
    
    setManualAddModal(prev => ({ ...prev, error: "" }));

    if (!goal) {
      setManualAddModal(prev => ({ ...prev, error: "No goal selected" }));
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setManualAddModal(prev => ({ ...prev, error: "Please enter a valid amount" }));
      return;
    }

    setManualAddModal(prev => ({ ...prev, loading: true }));

    try {
      const user = await getUser();
      if (!user) {
        throw new Error("Please log in to add savings");
      }

      const newAmount = goal.saved_amount + Number(amount);
      const { error } = await supabase
        .from("goals")
        .update({ saved_amount: newAmount })
        .eq("id", goal.id);
      
      if (error) throw error;
      
      // Update local state immediately
      setData((prev) =>
        prev.map((g) => (g.id === goal.id ? { ...g, saved_amount: newAmount } : g))
      );
      
      Alert.alert(
        "✅ Success", 
        `KSH ${Number(amount).toLocaleString()} added to "${goal.name}"`,
        [{ 
          text: "OK", 
          onPress: () => setManualAddModal({ 
            visible: false, 
            goal: null, 
            amount: "", 
            loading: false,
            error: "",
          })
        }]
      );
    } catch (err: any) {
      console.error('Error adding manual savings:', err);
      setManualAddModal(prev => ({ 
        ...prev, 
        error: err.message || "Failed to add savings. Please try again." 
      }));
    } finally {
      setManualAddModal(prev => ({ ...prev, loading: false }));
    }
  };

  const openEdit = (g?: Goal) => {
    console.log("Opening edit modal for goal:", g?.name);
    setDraft(
      g
        ? { ...g }
        : { id: "", name: "", target_amount: 0, saved_amount: 0, status: "active" }
    );
    setOpen(true);
  };

  const openPaymentModal = (goal: Goal) => {
    console.log("Opening payment modal for goal:", goal.name);
    setPaymentModal({
      visible: true,
      goal,
      amount: "",
      phone: "",
      loading: false,
      error: "",
    });
  };

  const openManualAddModal = (goal: Goal) => {
    console.log("Opening manual add modal for goal:", goal.name);
    setManualAddModal({
      visible: true,
      goal,
      amount: "",
      loading: false,
      error: "",
    });
  };

  const openPaymentHistoryModal = async (goal: Goal) => {
    console.log("Opening payment history for goal:", goal.name);
    setPaymentHistoryModal({
      visible: true,
      goal,
      payments: [],
      loading: true,
    });
    
    await loadPaymentHistory(goal.id);
  };

  const closeSuccessModal = () => {
    setPaymentSuccess({
      visible: false,
      goalName: '',
      amount: 0,
      receipt: '',
      goalId: ''
    });
  };

  const viewGoalDetails = () => {
    closeSuccessModal();
    if (paymentSuccess.goalId) {
      const goal = data.find(g => g.id === paymentSuccess.goalId);
      if (goal) {
        openPaymentHistoryModal(goal);
      }
    }
  };

  const markGoalAsCompleted = async (goalId: string) => {
    Alert.alert(
      "Mark as Completed",
      "Are you sure you want to mark this goal as completed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Complete",
          style: "default",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("goals")
                .update({ status: "completed" })
                .eq("id", goalId);

              if (error) throw error;

              setData((prev) =>
                prev.map((goal) =>
                  goal.id === goalId ? { ...goal, status: "completed" } : goal
                )
              );
              Alert.alert("✅ Success", "Goal marked as completed!");
            } catch (err: any) {
              console.error('Error marking goal as completed:', err);
              Alert.alert("Error", err.message || "Failed to update goal");
            }
          },
        },
      ]
    );
  };

  const reactivateGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from("goals")
        .update({ status: "active" })
        .eq("id", goalId);

      if (error) throw error;

      setData((prev) =>
        prev.map((goal) =>
          goal.id === goalId ? { ...goal, status: "active" } : goal
        )
      );
      Alert.alert("✅ Success", "Goal reactivated!");
    } catch (err: any) {
      console.error('Error reactivating goal:', err);
      Alert.alert("Error", err.message || "Failed to reactivate goal");
    }
  };

  const save = async () => {
    console.log("Saving goal:", draft);
    
    if (!draft?.name || !draft?.target_amount) {
      Alert.alert("Missing Information", "Please fill in all required fields");
      return;
    }

    if (Number(draft.target_amount) <= 0) {
      Alert.alert("Invalid Amount", "Target amount must be greater than 0");
      return;
    }

    try {
      const user = await getUser();
      if (!user) {
        Alert.alert("Error", "Please log in to save goals");
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
        if (error) throw error;
        setData((prev) => [created?.[0], ...prev]);
        Alert.alert("✅ Success", "Goal created successfully!");
      } else {
        const { error } = await supabase
          .from("goals")
          .update(goalData)
          .eq("id", draft.id);
        if (error) throw error;
        setData((prev) =>
          prev.map((item) =>
            item.id === draft.id ? { ...item, ...goalData } : item
          )
        );
        Alert.alert("✅ Success", "Goal updated successfully!");
      }
      setOpen(false);
    } catch (err: any) {
      console.error('Error saving goal:', err);
      Alert.alert("Error", err.message || "Failed to save goal");
    }
  };

  const deleteGoal = async (goalId: string) => {
    Alert.alert(
      "Delete Goal",
      "Are you sure you want to delete this goal? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("goals")
                .delete()
                .eq("id", goalId);

              if (error) throw error;

              setData((prev) => prev.filter((goal) => goal.id !== goalId));
              Alert.alert("✅ Success", "Goal deleted successfully!");
            } catch (err: any) {
              console.error('Error deleting goal:', err);
              Alert.alert("Error", err.message || "Failed to delete goal");
            }
          },
        },
      ]
    );
  };

  const renderGoalCard = ({ item }: { item: Goal }) => {
    const current = Number(item.saved_amount || 0);
    const target = Number(item.target_amount || 1);
    const pct = Math.min(100, Math.round((current / target) * 100));
    const isCompleted = item.status === 'completed' || pct >= 100;
    const primary = colors.primary;

    return (
      <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: isCompleted ? '#10b981' : `${primary}22` }]}>
            <Icon 
              name={isCompleted ? "check" : "target"} 
              size={24} 
              color={isCompleted ? "#fff" : primary} 
            />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text }]}>{item.name}</Text>
              {isCompleted && (
                <View style={[styles.completedBadge, { backgroundColor: '#10b981' }]}>
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              )}
            </View>
            <Text style={[styles.amount, { color: colors.text }]}>
              {formatCurrency(current)} / {formatCurrency(target)}
            </Text>
            <Text style={[styles.progressText, { color: colors.subtitle }]}>
              {pct}% complete
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => openGoalMenu(item)}
          >
            <Icon name="dots-vertical" size={20} color={colors.subtitle} />
          </TouchableOpacity>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressWrap}>
            <View
              style={[
                styles.progressFill,
                { 
                  width: `${pct}%`, 
                  backgroundColor: isCompleted ? '#10b981' : primary 
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.actionBtn, 
              { 
                backgroundColor: isCompleted ? '#9ca3af' : colors.primary,
                opacity: isCompleted ? 0.6 : 1
              }
            ]}
            onPress={() => openPaymentModal(item)}
            disabled={isCompleted}
          >
            <Icon name="cellphone" size={16} color="#fff" />
            <Text style={styles.btnText}>
              {isCompleted ? 'Completed' : 'MPESA Pay'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.actionBtn, 
              { 
                backgroundColor: isCompleted ? '#9ca3af' : "#10b981",
                opacity: isCompleted ? 0.6 : 1
              }
            ]}
            onPress={() => openManualAddModal(item)}
            disabled={isCompleted}
          >
            <Icon name="plus-circle" size={16} color="#fff" />
            <Text style={styles.btnText}>
              {isCompleted ? 'Completed' : 'Add Cash'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#6b7280" }]}
            onPress={() => openPaymentHistoryModal(item)}
          >
            <Icon name="history" size={16} color="#fff" />
            <Text style={styles.btnText}>History</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const openGoalMenu = (goal: Goal) => {
    const isCompleted = goal.status === 'completed';
    
    Alert.alert(
      goal.name,
      "Choose an action",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Edit Goal", onPress: () => openEdit(goal) },
        { text: "View Payment History", onPress: () => openPaymentHistoryModal(goal) },
        isCompleted 
          ? { text: "Reactivate Goal", onPress: () => reactivateGoal(goal.id) }
          : { text: "Mark as Completed", onPress: () => markGoalAsCompleted(goal.id) },
        { 
          text: "Delete Goal", 
          style: "destructive",
          onPress: () => deleteGoal(goal.id) 
        },
      ]
    );
  };

  const renderPaymentItem = ({ item }: { item: Payment }) => (
    <View style={[styles.paymentItem, { backgroundColor: colors.background }]}>
      <View style={styles.paymentHeader}>
        <View style={styles.paymentAmount}>
          <Text style={[styles.paymentAmountText, { color: colors.text }]}>
            {formatCurrency(item.amount)}
          </Text>
          <View style={[
            styles.statusBadge,
            { 
              backgroundColor: item.status === 'completed' ? '#10b98120' : 
                             item.status === 'failed' ? '#ef444420' : '#f59e0b20'
            }
          ]}>
            <Text style={[
              styles.statusText,
              { 
                color: item.status === 'completed' ? '#10b981' : 
                       item.status === 'failed' ? '#ef4444' : '#f59e0b'
              }
            ]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={[styles.paymentDate, { color: colors.subtitle }]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      
      <View style={styles.paymentDetails}>
        <Text style={[styles.paymentPhone, { color: colors.subtitle }]}>
          📱 {item.phone_number}
        </Text>
        {item.mpesa_receipt && (
          <Text style={[styles.paymentReceipt, { color: colors.subtitle }]}>
            Receipt: {item.mpesa_receipt}
          </Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading your goals...
        </Text>
      </View>
    );
  }

  const totalSaved = data.reduce((sum, goal) => sum + goal.saved_amount, 0);
  const totalTarget = data.reduce((sum, goal) => sum + goal.target_amount, 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Goals</Text>
          <Text style={[styles.headerSubtitle, { color: colors.subtitle }]}>
            Track and achieve your financial dreams
          </Text>
          
          {/* Overall Progress */}
          {data.length > 0 && (
            <View style={styles.overallProgress}>
              <View style={styles.overallProgressText}>
                <Text style={[styles.overallAmount, { color: colors.text }]}>
                  {formatCurrency(totalSaved)} saved
                </Text>
                <Text style={[styles.overallTarget, { color: colors.subtitle }]}>
                  of {formatCurrency(totalTarget)} target
                </Text>
              </View>
              <Text style={[styles.overallPercentage, { color: colors.primary }]}>
                {Math.round(overallProgress)}%
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => openEdit()}
          >
            <Icon name="plus" size={20} color="#fff" />
            <Text style={styles.addButtonText}>New Goal</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Goals List */}
      <FlatList
        data={data}
        renderItem={renderGoalCard}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="target" size={64} color={colors.subtitle} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No goals yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.subtitle }]}>
              Create your first savings goal to get started on your financial journey
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              onPress={() => openEdit()}
            >
              <Icon name="plus" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Create Your First Goal</Text>
            </TouchableOpacity>
          </View>
        }
        ListHeaderComponent={
          data.length > 0 ? (
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
                <Icon name="target" size={24} color={colors.primary} />
                <Text style={[styles.statNumber, { color: colors.text }]}>{data.length}</Text>
                <Text style={[styles.statLabel, { color: colors.subtitle }]}>Total Goals</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
                <Icon name="check-circle" size={24} color="#10b981" />
                <Text style={[styles.statNumber, { color: colors.text }]}>
                  {data.filter(g => g.status === 'completed').length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.subtitle }]}>Completed</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
                <Icon name="trending-up" size={24} color="#f59e0b" />
                <Text style={[styles.statNumber, { color: colors.text }]}>
                  {data.filter(g => g.status === 'active').length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.subtitle }]}>In Progress</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* GOAL EDIT MODAL */}
      <Modal visible={open} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {draft?.id ? "Edit Goal" : "New Goal"}
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setOpen(false)}
              >
                <Icon name="close" size={24} color={colors.subtitle} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.label, { color: colors.text }]}>Goal Name *</Text>
              <TextInput
                placeholder="What are you saving for?"
                placeholderTextColor={colors.subtitle}
                value={draft?.name ?? ""}
                onChangeText={(t) => setDraft((p) => ({ ...p, name: t }))}
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.background, 
                    color: colors.text, 
                    borderColor: colors.border 
                  },
                ]}
              />

              <Text style={[styles.label, { color: colors.text }]}>Target Amount (KSH) *</Text>
              <TextInput
                placeholder="How much do you need?"
                placeholderTextColor={colors.subtitle}
                value={draft?.target_amount?.toString() ?? ""}
                onChangeText={(t) => setDraft((p) => ({ ...p, target_amount: Number(t) }))}
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.background, 
                    color: colors.text, 
                    borderColor: colors.border 
                  },
                ]}
                keyboardType="numeric"
              />

              <Text style={[styles.label, { color: colors.text }]}>Current Savings (KSH)</Text>
              <TextInput
                placeholder="Amount already saved"
                placeholderTextColor={colors.subtitle}
                value={draft?.saved_amount?.toString() ?? ""}
                onChangeText={(t) => setDraft((p) => ({ ...p, saved_amount: Number(t) }))}
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.background, 
                    color: colors.text, 
                    borderColor: colors.border 
                  },
                ]}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={save}
              >
                <Text style={styles.saveButtonText}>
                  {draft?.id ? "Update Goal" : "Create Goal"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PAYMENT MODAL */}
      <Modal visible={paymentModal.visible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Pay to {paymentModal.goal?.name}
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setPaymentModal({
                  visible: false,
                  goal: null,
                  amount: "",
                  phone: "",
                  loading: false,
                  error: "",
                })}
              >
                <Icon name="close" size={24} color={colors.subtitle} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {paymentModal.error ? (
                <View style={[styles.errorBanner, { backgroundColor: `${colors.danger}15` }]}>
                  <Icon name="alert-circle" size={20} color={colors.danger} />
                  <Text style={[styles.errorText, { color: colors.danger }]}>
                    {paymentModal.error}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.label, { color: colors.text }]}>
                MPESA Phone Number *
              </Text>
              <TextInput
                placeholder="07XX XXX XXX"
                placeholderTextColor={colors.subtitle}
                value={paymentModal.phone}
                onChangeText={(text) => setPaymentModal(prev => ({ ...prev, phone: text, error: "" }))}
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.background, 
                    color: colors.text, 
                    borderColor: paymentModal.error ? colors.danger : colors.border 
                  },
                ]}
                keyboardType="phone-pad"
              />

              <Text style={[styles.label, { color: colors.text }]}>
                Amount (KSH) *
              </Text>
              <TextInput
                placeholder="Enter amount"
                placeholderTextColor={colors.subtitle}
                value={paymentModal.amount}
                onChangeText={(text) => setPaymentModal(prev => ({ ...prev, amount: text, error: "" }))}
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.background, 
                    color: colors.text, 
                    borderColor: paymentModal.error ? colors.danger : colors.border 
                  },
                ]}
                keyboardType="numeric"
              />

              <View style={[styles.infoBox, { backgroundColor: `${colors.primary}10` }]}>
                <Text style={[styles.infoTitle, { color: colors.primary }]}>
                  Real MPESA Payment
                </Text>
                <View style={styles.infoItem}>
                  <Icon name="check-circle" size={16} color={colors.primary} />
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    You'll receive an MPESA prompt on your phone
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Icon name="check-circle" size={16} color={colors.primary} />
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    Enter your MPESA PIN to complete payment
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Icon name="check-circle" size={16} color={colors.primary} />
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    Payment will be automatically added to your goal
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton, 
                  { 
                    backgroundColor: paymentModal.loading ? colors.subtitle : colors.primary,
                    opacity: paymentModal.loading ? 0.7 : 1
                  }
                ]}
                onPress={makePaymentToGoal}
                disabled={paymentModal.loading}
              >
                {paymentModal.loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="cellphone" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>
                      Pay KSH {paymentModal.amount || "0"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MANUAL ADD MODAL */}
      <Modal visible={manualAddModal.visible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Add to {manualAddModal.goal?.name}
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setManualAddModal({
                  visible: false,
                  goal: null,
                  amount: "",
                  loading: false,
                  error: "",
                })}
              >
                <Icon name="close" size={24} color={colors.subtitle} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {manualAddModal.error ? (
                <View style={[styles.errorBanner, { backgroundColor: `${colors.danger}15` }]}>
                  <Icon name="alert-circle" size={20} color={colors.danger} />
                  <Text style={[styles.errorText, { color: colors.danger }]}>
                    {manualAddModal.error}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.label, { color: colors.text }]}>
                Amount (KSH) *
              </Text>
              <TextInput
                placeholder="Enter amount to add"
                placeholderTextColor={colors.subtitle}
                value={manualAddModal.amount}
                onChangeText={(text) => setManualAddModal(prev => ({ ...prev, amount: text, error: "" }))}
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.background, 
                    color: colors.text, 
                    borderColor: manualAddModal.error ? colors.danger : colors.border 
                  },
                ]}
                keyboardType="numeric"
              />

              <View style={[styles.infoBox, { backgroundColor: `${colors.primary}10` }]}>
                <Text style={[styles.infoText, { color: colors.text }]}>
                  This will manually add the amount to your goal savings. Use this for cash deposits or bank transfers.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton, 
                  { 
                    backgroundColor: manualAddModal.loading ? colors.subtitle : colors.primary,
                    opacity: manualAddModal.loading ? 0.7 : 1
                  }
                ]}
                onPress={handleManualAdd}
                disabled={manualAddModal.loading}
              >
                {manualAddModal.loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="plus-circle" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>
                      Add KSH {manualAddModal.amount || "0"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PAYMENT HISTORY MODAL */}
      <Modal visible={paymentHistoryModal.visible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Payment History - {paymentHistoryModal.goal?.name}
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setPaymentHistoryModal({
                  visible: false,
                  goal: null,
                  payments: [],
                  loading: false,
                })}
              >
                <Icon name="close" size={24} color={colors.subtitle} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {paymentHistoryModal.loading ? (
                <View style={styles.loadingPaymentHistory}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.text }]}>
                    Loading payment history...
                  </Text>
                </View>
              ) : paymentHistoryModal.payments.length === 0 ? (
                <View style={styles.emptyPaymentHistory}>
                  <Icon name="receipt" size={64} color={colors.subtitle} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    No payments yet
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.subtitle }]}>
                    Make your first payment to see the history here
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={paymentHistoryModal.payments}
                  renderItem={renderPaymentItem}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.paymentList}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* PAYMENT SUCCESS MODAL */}
      <Modal visible={paymentSuccess.visible} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={[styles.successModalContainer, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.successIcon}>
              <Icon name="check-circle" size={80} color="#10b981" />
            </View>
            
            <Text style={[styles.successTitle, { color: colors.text }]}>
              Payment Successful! 🎉
            </Text>
            
            <Text style={[styles.successMessage, { color: colors.subtitle }]}>
              Your payment of {formatCurrency(paymentSuccess.amount)} has been successfully added to:
            </Text>
            
            <Text style={[styles.successGoalName, { color: colors.primary }]}>
              "{paymentSuccess.goalName}"
            </Text>
            
            {paymentSuccess.receipt && paymentSuccess.receipt !== 'Unknown' && (
              <View style={styles.receiptContainer}>
                <Text style={[styles.receiptLabel, { color: colors.subtitle }]}>
                  MPESA Receipt:
                </Text>
                <Text style={[styles.receiptNumber, { color: colors.text }]}>
                  {paymentSuccess.receipt}
                </Text>
              </View>
            )}

            <View style={styles.successNote}>
              <Icon name="information" size={16} color={colors.primary} />
              <Text style={[styles.successNoteText, { color: colors.subtitle }]}>
                Your goal has been updated automatically
              </Text>
            </View>
            
            <View style={styles.successButtons}>
              <TouchableOpacity
                style={[styles.successButton, { backgroundColor: colors.primary }]}
                onPress={closeSuccessModal}
              >
                <Text style={styles.successButtonText}>Continue</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.successButton, { backgroundColor: '#6b7280' }]}
                onPress={viewGoalDetails}
              >
                <Text style={styles.successButtonText}>View Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overallProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  overallProgressText: {
    flex: 1,
  },
  overallAmount: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  overallTarget: {
    fontSize: 14,
    fontWeight: '500',
  },
  overallPercentage: {
    fontSize: 20,
    fontWeight: '800',
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    flexGrow: 1,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 12,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontWeight: "700",
    fontSize: 18,
    flex: 1,
  },
  completedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  completedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  amount: {
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "500",
  },
  menuButton: {
    padding: 4,
    marginLeft: 8,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressWrap: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyButtonText: {
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  // Payment History Styles
  loadingPaymentHistory: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyPaymentHistory: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  paymentList: {
    paddingBottom: 20,
  },
  paymentItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentAmountText: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  paymentDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  paymentDetails: {
    gap: 4,
  },
  paymentPhone: {
    fontSize: 14,
    fontWeight: '500',
  },
  paymentReceipt: {
    fontSize: 12,
    fontWeight: '400',
  },
  // Success Modal Styles
  successModalContainer: {
    margin: 20,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  successGoalName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  receiptContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  receiptLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  receiptNumber: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  successNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    padding: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  successNoteText: {
    fontSize: 12,
    fontWeight: '600',
  },
  successButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  successButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  successButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});