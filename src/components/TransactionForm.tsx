// src/components/TransactionForm.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../supabaseClient';

type TxType = 'income' | 'expense';

export default function TransactionForm({ onDone }: { onDone?: () => void }) {
  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<TxType>('expense');
  const [category, setCategory] = useState<string>('general');
  const [description, setDescription] = useState<string>('');

  const handleSubmit = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert('not logged in');

    const { error } = await supabase.from('transactions').insert([{
      user_id: user.id,
      amount: Number(amount),
      type,
      category,
      description,
      occurred_at: new Date().toISOString()
    }]);

    if (error) alert(error.message);
    else {
      // call edge function to recalc insights (no service key in the client; supabase client will call
      // the function that you've deployed in Supabase)
      try { await supabase.functions.invoke('insights', { body: JSON.stringify({ user_id: user.id }) }); }
      catch (e) { console.warn('insights call failed', e); }

      onDone && onDone();
    }
  };

  return (
    <View style={{ padding: 10 }}>
      <Text>Amount (KES)</Text>
      <TextInput keyboardType="numeric" value={amount} onChangeText={setAmount} style={{ borderWidth: 1, padding: 8, marginBottom: 8 }} />

      <Text>Type</Text>
      <Picker selectedValue={type} onValueChange={(value: string) => setType(value as TxType)}>
        <Picker.Item label="Expense" value="expense" />
        <Picker.Item label="Income" value="income" />
      </Picker>

      <Text>Category</Text>
      <TextInput value={category} onChangeText={setCategory} style={{ borderWidth: 1, padding: 8, marginBottom: 8 }} />

      <Text>Description</Text>
      <TextInput value={description} onChangeText={setDescription} style={{ borderWidth: 1, padding: 8, marginBottom: 8 }} />

      <Button title="Save Transaction" onPress={handleSubmit} />
    </View>
  );
}
