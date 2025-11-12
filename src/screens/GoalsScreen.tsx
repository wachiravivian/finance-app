import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { RectButton } from "react-native-gesture-handler";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { supabase } from "../supabaseClient";
import { colors, radius, spacing } from "../constants/styles";
import { formatCurrency } from "../utils/format";

type Goal = {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  current_amount: number | null;
};

export default function GoalsScreen() {
  const [data, setData] = useState<Goal[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // edit/new modal
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Goal> | null>(null);

  const getUser = async () => (await supabase.auth.getUser()).data.user;

  const load = useCallback(async () => {
    const user = await getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true } as any);
    if (error) return Alert.alert("Error", error.message);
    setData(data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onDelete = (g: Goal) => {
    Alert.alert("Delete goal?", `This will delete "${g.title}".`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const prev = data;
          setData((arr) => arr.filter((x) => x.id !== g.id));
          const { error } = await supabase.from("goals").delete().eq("id", g.id);
          if (error) {
            setData(prev);
            Alert.alert("Error", error.message);
          }
        },
      },
    ]);
  };

  const openEdit = (g?: Goal) => {
    setDraft(
      g
        ? { ...g }
        : { id: "", title: "", target_amount: 0, current_amount: 0 }
    );
    setOpen(true);
  };

  const save = async () => {
    if (!draft?.title || !draft?.target_amount) {
      Alert.alert("Missing", "Please fill title and target.");
      return;
    }

    if (!draft.id) {
      // create
      const user = await getUser();
      if (!user) return;
      const { data: created, error } = await supabase
        .from("goals")
        .insert([
          {
            user_id: user.id,
            title: draft.title,
            target_amount: Number(draft.target_amount),
            current_amount: Number(draft.current_amount || 0),
          },
        ])
        .select("*");
      if (error) return Alert.alert("Error", error.message);
      setOpen(false);
      setData((arr) => [...arr, ...(created as any[])]);
    } else {
      // update
      const prev = data;
      setData((arr) =>
        arr.map((x) =>
          x.id === draft.id
            ? {
                ...x,
                title: draft.title!,
                target_amount: Number(draft.target_amount),
                current_amount: Number(draft.current_amount || 0),
              }
            : x
        )
      );
      setOpen(false);

      const { error } = await supabase
        .from("goals")
        .update({
          title: draft.title,
          target_amount: Number(draft.target_amount),
          current_amount: Number(draft.current_amount || 0),
        })
        .eq("id", draft.id);
      if (error) {
        setData(prev);
        Alert.alert("Error", error.message);
      }
    }
  };

  const renderItem = ({ item }: { item: Goal }) => {
    const current = Number(item.current_amount || 0);
    const pct = item.target_amount ? Math.min(100, Math.round((current / item.target_amount) * 100)) : 0;

    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.muted}>
            {formatCurrency(current)} / {formatCurrency(item.target_amount)}
          </Text>
        </View>
        <View style={styles.progressWrap}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.muted}>{pct}%</Text>

        <View style={styles.actions}>
          <RectButton style={[styles.btn, styles.edit]} onPress={() => openEdit(item)}>
            <Icon name="pencil" size={18} color="#fff" />
            <Text style={styles.btnText}>Edit</Text>
          </RectButton>
          <RectButton style={[styles.btn, styles.delete]} onPress={() => onDelete(item)}>
            <Icon name="delete" size={18} color="#fff" />
            <Text style={styles.btnText}>Delete</Text>
          </RectButton>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Goals</Text>
        <RectButton style={styles.addBtn} onPress={() => openEdit()}>
          <Icon name="plus" size={18} color="#fff" />
          <Text style={styles.addText}>New</Text>
        </RectButton>
      </View>

      <FlatList
        data={data}
        keyExtractor={(x) => String(x.id)}
        renderItem={renderItem}
        onRefresh={onRefresh}
        refreshing={refreshing}
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{draft?.id ? "Edit Goal" : "New Goal"}</Text>
            <Text style={styles.label}>Goal title</Text>
            <TextInput
              placeholder="e.g. Emergency Fund"
              value={draft?.title ?? ""}
              onChangeText={(t) => setDraft((d) => ({ ...(d || {}), title: t }))}
              style={styles.input}
            />
            <Text style={styles.label}>Target (Ksh)</Text>
            <TextInput
              placeholder="e.g. 30000"
              keyboardType="numeric"
              value={draft?.target_amount?.toString() ?? ""}
              onChangeText={(t) =>
                setDraft((d) => ({ ...(d || {}), target_amount: Number(t || 0) }))
              }
              style={styles.input}
            />
            <Text style={styles.label}>Current (Ksh)</Text>
            <TextInput
              placeholder="optional"
              keyboardType="numeric"
              value={(draft?.current_amount ?? 0).toString()}
              onChangeText={(t) =>
                setDraft((d) => ({ ...(d || {}), current_amount: Number(t || 0) }))
              }
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <RectButton style={[styles.btn, styles.cancel]} onPress={() => setOpen(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </RectButton>
              <RectButton style={[styles.btn, styles.save]} onPress={save}>
                <Text style={styles.btnText}>{draft?.id ? "Save" : "Create"}</Text>
              </RectButton>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  header: { fontSize: 22, fontWeight: "800", color: colors.text },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8 as any,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  addText: { color: "#fff", fontWeight: "700" },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontWeight: "700", fontSize: 16, color: colors.text },
  muted: { color: colors.muted },

  progressWrap: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  progressFill: { height: 8, backgroundColor: colors.primary },

  actions: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8 as any,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  edit: { backgroundColor: colors.secondary },
  delete: { backgroundColor: "#EF4444" },

  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: "#fff", borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  label: { fontWeight: "700", color: colors.text, marginTop: spacing.sm, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    backgroundColor: "#fff",
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: spacing.md },
  cancel: { backgroundColor: colors.muted },
  save: { backgroundColor: colors.primary },
  btnText: { color: "#fff", fontWeight: "700" },
});
