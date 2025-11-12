// src/components/PdfImport.tsx
import React from "react";
import { TouchableOpacity, Text, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../supabaseClient";

export function PdfImport({ onImported }: { onImported?: () => void }) {
  async function handlePickPdf() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;

      const file = res.assets[0];
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log("Invoking user-import-mpesa-pdf…");
      const { data, error } = await supabase.functions.invoke(
        "user-import-mpesa-pdf",
        {
          headers: { "Content-Type": "application/json" },
          body: {
            name: file.name ?? "statement.pdf",
            pdf_base64: base64,
            debug: true, // <-- show diagnostics
          },
        }
      );

      console.log("user-import-mpesa-pdf response:", { data, error });

      if (error) {
        Alert.alert("Import failed", error.message ?? "Edge Function error");
        return;
      }

      const imported = data?.imported_count ?? 0;
      const diag = data?.diagnostics as string[] | undefined;

      Alert.alert(
        "Import complete",
        `${imported} transactions imported.${
          diag?.length ? `\n\nDetails:\n- ${diag.slice(0, 5).join("\n- ")}` : ""
        }`
      );

      // trigger parent reload
      onImported?.();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "PDF import error");
    }
  }

  return (
    <TouchableOpacity
      onPress={handlePickPdf}
      style={{
        backgroundColor: "#2563EB",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "800" }}>Import M-PESA PDF</Text>
    </TouchableOpacity>
  );
}
