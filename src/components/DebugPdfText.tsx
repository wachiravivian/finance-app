// src/components/DebugPdfText.tsx
import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, ScrollView } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { getApiBase } from "../utils/api";

export default function DebugPdfText() {
  const [busy, setBusy] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const debugPdf = async () => {
    try {
      setBusy(true);
      setDebugInfo(null);

      const picked = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (picked.canceled || !picked.assets?.[0]) {
        setBusy(false);
        return;
      }

      const asset = picked.assets[0];

      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await fetch(asset.uri).then((r) => r.blob());
        const file = new File([blob], asset.name ?? "statement.pdf", { type: "application/pdf" });
        form.append("file", file);
      } else {
        // @ts-ignore
        form.append("file", {
          uri: asset.uri,
          name: asset.name ?? "statement.pdf",
          type: "application/pdf",
        });
      }

      const API_URL = getApiBase();
      const res = await fetch(`${API_URL}/debug-mpesa-text`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }

      const data = await res.json();
      console.log("PDF Debug Data:", data);
      setDebugInfo(data);

    } catch (e: any) {
      Alert.alert("Debug Failed", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12, padding: 16, backgroundColor: "#fff", borderRadius: 8 }}>
      <Text style={{ fontWeight: "700", fontSize: 16 }}>🔍 Debug PDF Text Extraction</Text>
      
      <TouchableOpacity
        onPress={debugPdf}
        disabled={busy}
        style={{
          backgroundColor: "#8b5cf6",
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700" }}>Select PDF to Debug</Text>
        )}
      </TouchableOpacity>

      {debugInfo && (
        <ScrollView style={{ maxHeight: 400, backgroundColor: "#f8fafc", padding: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>
            Total Lines (First 2 Pages): {debugInfo.total_lines_first_two_pages}
          </Text>
          
          {debugInfo.pages_preview?.map((page: any, idx: number) => (
            <View key={idx} style={{ marginBottom: 16 }}>
              <Text style={{ fontWeight: "700", color: "#0ea5e9" }}>
                Page {page.page} - {page.lines} lines
              </Text>
              <View style={{ backgroundColor: "#fff", padding: 8, borderRadius: 4, marginTop: 4 }}>
                {page.sample?.map((line: string, lineIdx: number) => (
                  <Text key={lineIdx} style={{ fontSize: 11, fontFamily: "monospace", marginBottom: 2 }}>
                    {line || "(empty line)"}
                  </Text>
                ))}
                {page.lines > 10 && (
                  <Text style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    ... {page.lines - 10} more lines
                  </Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}