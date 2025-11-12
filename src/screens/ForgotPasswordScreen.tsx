import React, { useState } from "react";
import { View, TextInput, Button, Alert } from "react-native";
import { supabase } from "../supabaseClient";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");

  async function handleForgotPassword() {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "exp://127.0.0.1:19000/reset", // update to your app link
    });
    if (error) Alert.alert("Error", error.message);
    else Alert.alert("Check email", "Password reset link sent.");
  }

  return (
    <View style={{ padding: 20 }}>
      <TextInput placeholder="Enter your email" value={email} onChangeText={setEmail} style={{ borderWidth: 1, marginBottom: 10 }} />
      <Button title="Send Reset Link" onPress={handleForgotPassword} />
    </View>
  );
}
