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
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../supabaseClient";
import { getApiBase, checkBackendHealth } from "../utils/api";

export default function MpesaPdfImport({ onImported }: { onImported?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [debugResult, setDebugResult] = useState<any>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);

  // Debug function to test PDF
  const debugPdf = async () => {
    try {
      setBusy(true);
      setProgress("Selecting PDF for debug...");

      const picked = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (picked.canceled || !picked.assets?.[0]) {
        setBusy(false);
        return;
      }

      const asset = picked.assets[0];
      setProgress("Analyzing PDF...");

      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await fetch(asset.uri).then((r) => r.blob());
        form.append("file", new File([blob], "statement.pdf", { type: "application/pdf" }));
      } else {
        form.append("file", {
          uri: asset.uri,
          name: "statement.pdf",
          type: "application/pdf",
        } as any);
      }

      const API_URL = getApiBase().replace(/\/$/, "");
      const endpoint = `${API_URL}/debug-pdf`;

      const res = await fetch(endpoint, { method: "POST", body: form });
      
      if (!res.ok) {
        throw new Error(`Debug failed: ${res.status}`);
      }

      const result = await res.json();
      setDebugResult(result);
      setShowDebugModal(true);
      
      console.log("PDF DEBUG RESULT:", result);
      
    } catch (err: any) {
      console.error("Debug failed", err);
      Alert.alert("Debug Error", err.message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const pickAndUpload = async () => {
    try {
      setBusy(true);
      setProgress("Checking backend connection...");

      // First check if backend is reachable
      const isBackendOnline = await checkBackendHealth();
      if (!isBackendOnline) {
        Alert.alert(
          "Backend Offline", 
          `Cannot connect to server at ${getApiBase()}. Please make sure the backend is running.`
        );
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
      setSelectedFile(asset);
      
      // First try without password
      await uploadPdf(asset, null);
      
    } catch (err: any) {
      console.error("Import failed", err);
      
      // Check if it's a password error
      if (err.message.includes("password protected") || err.message.includes("encrypted") || err.message.includes("password")) {
        setShowPasswordModal(true);
      } else {
        handleError(err);
      }
    } finally {
      if (!showPasswordModal) {
        setBusy(false);
        setProgress("");
      }
    }
  };

  const uploadPdf = async (asset: any, pdfPassword: string | null) => {
    try {
      setProgress("Uploading and parsing PDF...");

      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await fetch(asset.uri).then((r) => r.blob());
        form.append("file", new File([blob], "statement.pdf", { type: "application/pdf" }));
      } else {
        form.append("file", {
          uri: asset.uri,
          name: "statement.pdf",
          type: "application/pdf",
        } as any);
      }
      
      // Add password if provided
      if (pdfPassword) {
        form.append("password", pdfPassword);
      }

      const API_URL = getApiBase().replace(/\/$/, "");
      const endpoint = `${API_URL}/parse-mpesa`;

      // Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(endpoint, { 
        method: "POST", 
        body: form,
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server error: ${errorText}`);
      }

      const payload = await res.json();
      const parsed = payload.transactions ?? [];

      // Get user ID
      const { data: auth } = await supabase.auth.getUser();
      const user_id = auth?.user?.id;
      if (!user_id) throw new Error("Not signed in");

      // Map to DB shape
      const rows = parsed.map((t: any) => {
        const isCredit = t.direction === "credit";
        const counterparty = t.counterparty || t.description || "Unknown Transaction";
        
        // Create title from counterparty (first 30 chars)
        let title = counterparty;
        if (title.length > 30) {
          title = title.substring(0, 30) + "...";
        }

        return {
          user_id,
          ts: t.ts || new Date().toISOString(),
          direction: isCredit ? "credit" : "debit",
          amount: Math.abs(Number(t.amount ?? 0)),
          method: t.method || "mpesa",
          type: t.type || (isCredit ? "income" : "expense"),
          counterparty: counterparty,
          reference: t.reference || "",
          category: t.category || "other",
          notes: t.description || null,
          title: title,
        };
      });

      setProgress(`Inserting ${rows.length} transactions...`);
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) throw error;

      Alert.alert("Success", `Imported ${rows.length} transactions.`);
      onImported?.();
      setShowPasswordModal(false);
      setPassword("");

    } catch (err: any) {
      throw err;
    }
  };

  const handleError = (err: any) => {
    if (err.name === 'AbortError') {
      Alert.alert("Timeout", "The request took too long. Please try again.");
    } else {
      let errorMessage = err.message;
      
      // Handle different error formats
      if (errorMessage.includes('Server error: {')) {
        try {
          const jsonStr = errorMessage.replace('Server error: ', '');
          const errorData = JSON.parse(jsonStr);
          errorMessage = errorData.detail || errorData.message || 'Unknown server error';
        } catch {
          // If JSON parsing fails, use the original message
        }
      }
      
      Alert.alert(
        "Import Error", 
        errorMessage || "Failed to import PDF. Please check the file format and try again."
      );
    }
  };

  const handlePasswordSubmit = async () => {
    if (!selectedFile) return;
    
    setBusy(true);
    setProgress("Trying with password...");
    
    try {
      await uploadPdf(selectedFile, password);
    } catch (err: any) {
      handleError(err);
    } finally {
      setBusy(false);
      setProgress("");
      setShowPasswordModal(false);
      setPassword("");
    }
  };

  const handleCancelPassword = () => {
    setShowPasswordModal(false);
    setPassword("");
    setBusy(false);
    setProgress("");
  };

  const formatDebugResult = (result: any): string => {
    if (!result) return "No debug data";
    
    let output = "";
    
    if (result.file_name) output += `File: ${result.file_name}\n`;
    if (result.file_size) output += `Size: ${result.file_size} bytes\n`;
    if (result.is_valid_pdf !== undefined) output += `Valid PDF: ${result.is_valid_pdf ? "✅" : "❌"}\n\n`;
    
    if (result.pypdf2_info) {
      output += "PyPDF2 Analysis:\n";
      output += `- Pages: ${result.pypdf2_info.pages || 0}\n`;
      output += `- Encrypted: ${result.pypdf2_info.is_encrypted ? "✅ YES" : "❌ No"}\n`;
      if (result.pypdf2_info.metadata) {
        output += `- Metadata: ${JSON.stringify(result.pypdf2_info.metadata)}\n`;
      }
      output += "\n";
    }
    
    if (result.pypdf2_error) {
      output += `PyPDF2 Error: ${result.pypdf2_error}\n\n`;
    }
    
    if (result.pdfplumber_info) {
      output += "PDFPlumber Analysis:\n";
      output += `- Pages: ${result.pdfplumber_info.pages || 0}\n`;
      if (result.pdfplumber_info.page_contents) {
        result.pdfplumber_info.page_contents.forEach((page: any, index: number) => {
          output += `\nPage ${page.page}:\n`;
          output += `- Text Length: ${page.text_length} chars\n`;
          output += `- Preview: ${page.first_200_chars}\n`;
        });
      }
    }
    
    if (result.pdfplumber_error) {
      output += `PDFPlumber Error: ${result.pdfplumber_error}\n`;
    }
    
    if (result.error) {
      output += `General Error: ${result.error}\n`;
    }
    
    return output;
  };

  return (
    <View style={{ gap: 8 }}>
      {/* Main Import Button */}
      <TouchableOpacity
        onPress={pickAndUpload}
        disabled={busy}
        style={{
          backgroundColor: busy ? "#94a3b8" : "#0ea5e9",
          padding: 12,
          borderRadius: 8,
          alignItems: "center",
          minWidth: 150,
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

      {/* Debug Button */}
      <TouchableOpacity
        onPress={debugPdf}
        disabled={busy}
        style={{
          backgroundColor: "#8b5cf6",
          padding: 12,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            🔧 Debug PDF
          </Text>
        )}
      </TouchableOpacity>
      
      {progress ? (
        <Text style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}>
          {progress}
        </Text>
      ) : null}

      {/* Password Modal */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelPassword}
      >
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
              color: '#0f172a',
            }}>
              PDF Password Required
            </Text>
            
            <Text style={{
              fontSize: 14,
              color: '#64748b',
              marginBottom: 16,
            }}>
              This PDF is password protected. M-PESA statements often use your ID number as the password.
            </Text>
            
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                marginBottom: 16,
              }}
              placeholder="Enter PDF password (e.g., ID number)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={false}
              autoFocus={true}
            />
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={handleCancelPassword}
                style={{
                  flex: 1,
                  backgroundColor: '#f1f5f9',
                  padding: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#64748b', fontWeight: '600' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handlePasswordSubmit}
                disabled={!password.trim() || busy}
                style={{
                  flex: 1,
                  backgroundColor: !password.trim() || busy ? '#94a3b8' : '#0ea5e9',
                  padding: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    Submit
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Debug Results Modal */}
      <Modal
        visible={showDebugModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDebugModal(false)}
      >
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
            maxWidth: 500,
            maxHeight: '80%',
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: 'bold',
              marginBottom: 10,
              color: '#0f172a',
            }}>
              PDF Debug Results
            </Text>
            
            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={{
                fontSize: 12,
                fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace',
                color: '#334155',
                lineHeight: 16,
              }}>
                {formatDebugResult(debugResult)}
              </Text>
            </ScrollView>
            
            <TouchableOpacity
              onPress={() => setShowDebugModal(false)}
              style={{
                backgroundColor: '#0ea5e9',
                padding: 12,
                borderRadius: 8,
                alignItems: 'center',
                marginTop: 16,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}