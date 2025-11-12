import React, { useState } from 'react';
import { View, TextInput, Button, Text, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../supabaseClient';

export default function BudgetForm({ onDone }: { onDone?: () => void }) {
  const [category, setCategory] = useState<string>('general');
  const [amount, setAmount] = useState<string>('');
  const [period, setPeriod] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');

  const handleSave = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return Alert.alert('Error', 'You must be logged in.');

    const amt = Number(amount);
    if (!category.trim() || isNaN(amt) || amt <= 0)
      return Alert.alert('Validation', 'Please enter valid details.');

    // Standardized monthly key
    const budgetMonth = new Date().toISOString().slice(0, 7); // e.g. "2025-11"

    const { error } = await supabase.from('budgets').insert([
      {
        user_id: user.id,
        category: category.trim(),
        amount_monthly: amt,
        budget_month: budgetMonth,
      },
    ]);

    if (error) Alert.alert('Error', error.message);
    else {
      setCategory('');
      setAmount('');
      onDone && onDone();
    }
  };

  return (
    <View style={{ padding: 10 }}>
      <Text>Category</Text>
      <TextInput
        value={category}
        onChangeText={setCategory}
        style={{ borderWidth: 1, padding: 8, marginBottom: 8 }}
      />

      <Text>Amount (KES)</Text>
      <TextInput
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        style={{ borderWidth: 1, padding: 8, marginBottom: 8 }}
      />

      <Text>Period</Text>
      <Picker
        selectedValue={period}
        onValueChange={(value: string) => setPeriod(value as 'monthly' | 'weekly' | 'yearly')}
      >
        <Picker.Item label="Monthly" value="monthly" />
        <Picker.Item label="Weekly" value="weekly" />
        <Picker.Item label="Yearly" value="yearly" />
      </Picker>

      <Button title="Save Budget" onPress={handleSave} />
    </View>
  );
}
