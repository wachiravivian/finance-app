import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, FlatList } from 'react-native';
import { Button, Modal, Portal, TextInput, Provider as PaperProvider, ProgressBar } from 'react-native-paper';
import { RouteProp, useRoute } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import { colors, spacing, radius } from '../constants/styles';

type ParamList = {
  GoalDetail: { goalId: string };
};

export default function GoalDetailScreen() {
  const route = useRoute<RouteProp<ParamList, 'GoalDetail'>>();
  const goalId = route.params.goalId;

  const [goal, setGoal] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<any[]>([]);

  const progress = useMemo(() => {
    if (!goal) return 0;
    const p = (goal.current_amount || 0) / (goal.target_amount || 1);
    return Math.min(1, Math.max(0, p));
  }, [goal]);

  const load = async () => {
    setLoading(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { data: goalsData, error } = await supabase.from('goals').select('*').eq('id', goalId).single();
    if (!error) setGoal(goalsData);

    // try to load contributions if table exists
    const { data: contribs } = await supabase
      .from('goal_contributions')
      .select('*')
      .eq('user_id', user.id)
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false });
    if (contribs) setHistory(contribs);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addContribution = async () => {
    const val = Number(amount);
    if (!val || val <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number.');
      return;
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    // 1) Update the goal current_amount (increment)
    const newAmount = (goal?.current_amount || 0) + val;
    const { error: updateErr } = await supabase
      .from('goals')
      .update({ current_amount: newAmount })
      .eq('id', goalId);
    if (updateErr) return Alert.alert('Error', updateErr.message);

    // 2) (Optional) Log contribution if table exists
    const { error: logErr } = await supabase
  .from('goal_contributions')
  .insert([{ user_id: user.id, goal_id: goalId, amount: val, note }]);

// ignore if the table doesn't exist or any logging error
// (you can optionally check logErr?.message if you want)


    setAmount('');
    setNote('');
    setShowModal(false);
    load();
  };

  if (loading || !goal) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <Text>Loading goal…</Text>
      </View>
    );
  }

  return (
    <PaperProvider>
      <View style={styles.container}>
        <Text style={styles.title}>{goal.title}</Text>
        <Text style={{ color: colors.muted, marginBottom: 6 }}>
          Target: KES {Number(goal.target_amount).toLocaleString()}
        </Text>

        <ProgressBar progress={progress} color={colors.primary} style={styles.progress}/>
        <Text style={{ marginTop: 6 }}>
          Saved: <Text style={{ fontWeight:'700' }}>KES {Number(goal.current_amount).toLocaleString()}</Text> ({Math.round(progress * 100)}%)
        </Text>

        <View style={{ marginTop: spacing.lg, gap: 8 }}>
          <Button mode="contained" onPress={() => setShowModal(true)}>Add contribution</Button>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ fontWeight:'700', marginBottom: 8 }}>Contribution History</Text>
          {history.length === 0 ? (
            <Text style={{ color: colors.muted }}>No contributions yet.</Text>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(i) => String(i.id)}
              ItemSeparatorComponent={() => <View style={{ height:8 }} />}
              renderItem={({ item }) => (
                <View style={{ padding:12, backgroundColor:'#fff', borderRadius:12, borderWidth:1, borderColor:'#F3F4F6' }}>
                  <Text style={{ fontWeight:'600' }}>+ KES {Number(item.amount).toLocaleString()}</Text>
                  {item.note ? <Text style={{ color: colors.muted }}>{item.note}</Text> : null}
                  <Text style={{ color: colors.muted, marginTop:4 }}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
              )}
            />
          )}
        </View>

        <Portal>
          <Modal visible={showModal} onDismiss={() => setShowModal(false)} contentContainerStyle={styles.modal}>
            <Text style={{ fontWeight:'700', fontSize:16, marginBottom: 8 }}>Add contribution</Text>
            <TextInput
              label="Amount (KES)"
              mode="outlined"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              style={{ marginBottom: 8 }}
            />
            <TextInput
              label="Note (optional)"
              mode="outlined"
              value={note}
              onChangeText={setNote}
              style={{ marginBottom: 12 }}
            />
            <Button mode="contained" onPress={addContribution}>Save</Button>
          </Modal>
        </Portal>
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding: spacing.lg, backgroundColor: '#F9FAFB' },
  title: { fontSize: 22, fontWeight:'800', marginBottom: 4 },
  progress: { height: 12, borderRadius: 8, marginTop: 4, backgroundColor:'#EEF2FF' },
  modal: {
    backgroundColor:'#fff', padding: spacing.lg, margin: 20, borderRadius: radius.lg,
  },
});
