// src/components/MpesaPdfImport.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  Modal,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../supabaseClient";
import { getApiBase, checkBackendHealth, testPdfPassword } from "../utils/api";

export default function MpesaPdfImport({ onImported }: { onImported?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [testingPassword, setTestingPassword] = useState(false);

  const pickAndUpload = async () => {
    try {
      setBusy(true);
      setProgress("Checking connection...");

      // Check backend
      const isBackendOnline = await checkBackendHealth();
      if (!isBackendOnline) {
        Alert.alert("Backend Offline", "Please make sure the backend server is running.");
        return;
      }

      setProgress("Selecting PDF file...");
      const picked = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (picked.canceled || !picked.assets?.[0]) {
        setBusy(false);
        setProgress("");
        return;
      }

      const asset = picked.assets[0];
      console.log("📄 Selected file:", asset.name, "Size:", asset.size);
      setSelectedFile(asset);
      
      // First try without password
      await uploadPdf(asset, null);
      
    } catch (err: any) {
      console.error("Import error:", err);
      
      // Check for password error
      if (err.message.includes("password") || err.message.includes("protected") || err.message.includes("ID number")) {
        console.log("🔒 PDF is password protected");
        setShowPasswordModal(true);
      } else {
        Alert.alert("Import Error", err.message || "Failed to import PDF. Please try again.");
      }
    } finally {
      if (!showPasswordModal) {
        setBusy(false);
        setProgress("");
      }
    }
  };

  const testPassword = async () => {
    if (!selectedFile || !password.trim()) {
      Alert.alert("Missing Info", "Please select a PDF file and enter a password.");
      return;
    }
    
    setTestingPassword(true);
    
    try {
      console.log("🔐 Testing password...");
      const result = await testPdfPassword(selectedFile, password);
      console.log("Password test result:", result);

      if (result.success) {
        Alert.alert(
          "✅ Password Works!", 
          `${result.message}\n\nPages: ${result.pages}\nText found: ${result.sample_text_length} characters`
        );
      } else {
        Alert.alert("❌ Password Failed", result.message);
      }
    } catch (err: any) {
      Alert.alert("Test Error", err.message || "Failed to test password");
    } finally {
      setTestingPassword(false);
    }
  };

  const uploadPdf = async (asset: any, pdfPassword: string | null) => {
    try {
      setProgress(pdfPassword ? "Uploading with password..." : "Uploading PDF...");
      console.log("📤 Uploading PDF...", { hasPassword: !!pdfPassword });

      const formData = new FormData();
      
      if (Platform.OS === "web") {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        formData.append("file", blob, "statement.pdf");
      } else {
        formData.append("file", {
          uri: asset.uri,
          name: "statement.pdf",
          type: "application/pdf",
        } as any);
      }
      
      // Add password if provided
      if (pdfPassword && pdfPassword.trim()) {
        formData.append("password", pdfPassword.trim());
        console.log("🔑 Using password:", pdfPassword.trim());
      }

      const API_URL = getApiBase();
      const endpoint = `${API_URL}/parse-mpesa`;
      
      console.log("🌐 Sending to:", endpoint);
      
      const response = await fetch(endpoint, { 
        method: "POST", 
        body: formData,
      });

      const result = await response.json();
      console.log("📨 Server response:", result);

      if (!result.success) {
        // Check if it's a password error
        if (result.message.includes("password") || result.message.includes("ID number")) {
          throw new Error("PASSWORD_REQUIRED: " + result.message);
        }
        throw new Error(result.message || "PDF parsing failed");
      }

      const transactions = result.transactions || [];

      if (transactions.length === 0) {
        Alert.alert(
          "No Transactions Found", 
          "The PDF was processed but no transactions were found.\n\nPlease ensure:\n• It's a valid M-PESA statement\n• It contains transactions\n• Try a different password"
        );
        return;
      }

      // Get user
      const { data: auth } = await supabase.auth.getUser();
      const user_id = auth?.user?.id;
      if (!user_id) throw new Error("Please sign in to import transactions");

      setProgress(`Importing ${transactions.length} transactions...`);

      // Prepare data for database
      const rows = transactions.map((t: any) => ({
        user_id,
        ts: t.ts || new Date().toISOString(),
        direction: t.direction || "debit",
        amount: Math.abs(Number(t.amount || 0)),
        method: t.method || "mpesa",
        type: t.type || "transfer",
        counterparty: t.counterparty || "M-PESA Transaction",
        reference: t.reference || "",
        category: t.category || "other",
        notes: t.description || null,
        title: (t.counterparty || "M-PESA Transaction").substring(0, 30) + (t.counterparty && t.counterparty.length > 30 ? "..." : ""),
      }));

      // Insert into database
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) {
        console.error("❌ Database error:", error);
        throw new Error(`Failed to save transactions: ${error.message}`);
      }

      console.log("✅ Successfully imported", transactions.length, "transactions");
      Alert.alert("🎉 Success!", `Imported ${transactions.length} transactions from your M-PESA statement!`);
      onImported?.();
      setShowPasswordModal(false);
      setPassword("");

    } catch (err: any) {
      console.error("💥 Upload error:", err);
      throw err;
    }
  };

  const handlePasswordSubmit = async () => {
    if (!selectedFile) return;
    
    if (!password.trim()) {
      Alert.alert("Password Required", "Please enter your ID number (PDF password).");
      return;
    }
    
    setBusy(true);
    setProgress("Importing with password...");
    
    try {
      await uploadPdf(selectedFile, password);
    } catch (err: any) {
      console.error("Password submit error:", err);
      
      // Handle password errors
      if (err.message.includes("PASSWORD_REQUIRED")) {
        const cleanMessage = err.message.replace("PASSWORD_REQUIRED: ", "");
        Alert.alert("Password Error", cleanMessage);
      } else {
        Alert.alert("Import Error", err.message || "Failed to import with this password");
      }
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const handleCancelPassword = () => {
    setShowPasswordModal(false);
    setPassword("");
    setBusy(false);
    setProgress("");
  };

  return (
    <View style={{ gap: 8 }}>
      {/* Main Import Button */}
      <TouchableOpacity
        onPress={pickAndUpload}
        disabled={busy}
        style={{
          backgroundColor: busy ? "#ccc" : "#007AFF",
          padding: 12,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            📄 Import M-PESA PDF
          </Text>
        )}
      </TouchableOpacity>
      
      {progress ? (
        <Text style={{ fontSize: 12, color: "#666", textAlign: "center" }}>
          {progress}
        </Text>
      ) : null}

      {/* Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: 'white',
            padding: 20,
            borderRadius: 12,
            width: '100%',
            maxWidth: 400,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: 'bold',
              marginBottom: 10,
            }}>
              🔒 PDF Password Required
            </Text>
            
            <Text style={{
              fontSize: 14,
              color: '#666',
              marginBottom: 16,
              lineHeight: 20,
            }}>
              Your M-PESA statement is password protected.{'\n\n'}
              📋 Usually your ID number{'\n'}
              🔢 Format: 12345678{'\n'}
              📞 Sometimes: 0712345678 (phone number)
            </Text>
            
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                marginBottom: 12,
                backgroundColor: '#f9f9f9',
              }}
              placeholder="Enter your ID number (e.g., 12345678)"
              value={password}
              onChangeText={setPassword}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={true}
            />
            
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={testPassword}
                disabled={!password.trim() || testingPassword}
                style={{
                  flex: 1,
                  backgroundColor: !password.trim() || testingPassword ? '#ccc' : '#34C759',
                  padding: 8,
                  borderRadius: 6,
                  alignItems: 'center',
                }}
              >
                {testingPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>
                    🔐 Test Password
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={handleCancelPassword}
                style={{
                  flex: 1,
                  backgroundColor: '#f0f0f0',
                  padding: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handlePasswordSubmit}
                disabled={!password.trim() || busy}
                style={{
                  flex: 1,
                  backgroundColor: !password.trim() || busy ? '#ccc' : '#007AFF',
                  padding: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Import</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}