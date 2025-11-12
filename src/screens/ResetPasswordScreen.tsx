import React, { useState } from "react";
import { View, TextInput, Button, Alert } from "react-native";
import { supabase } from "../supabaseClient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

export default function ResetPasswordScreen({ navigation }: Props) {
  const [password, setPassword] = useState("");

  async function handleResetPassword() {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) Alert.alert("Error", error.message);
    else {
      Alert.alert("Success", "Password updated.");
      navigation.navigate("Login");
    }
  }

  return (
    <View style={{ padding: 20 }}>
      <TextInput placeholder="New password" secureTextEntry value={password} onChangeText={setPassword} style={{ borderWidth: 1, marginBottom: 10 }} />
      <Button title="Reset Password" onPress={handleResetPassword} />
    </View>
  );
}
