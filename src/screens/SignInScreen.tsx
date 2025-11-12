// src/screens/SignInScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { supabase } from '../supabaseClient';

export default function SignInScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else {
      // session automatically handled by onAuthStateChange in navigator
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Email</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize='none' style={{borderWidth:1, padding:8, marginBottom:10}} />
      <Text>Password</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry style={{borderWidth:1, padding:8, marginBottom:10}} />
      <Button title="Sign In" onPress={handleSignIn} />
      <Button title="Create account" onPress={() => navigation.navigate('SignUp')} />
    </View>
  );
}
