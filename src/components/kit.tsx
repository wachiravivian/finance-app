// src/components/kit.tsx
import React, { PropsWithChildren } from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { colors, spacing, radius, shadow } from "../constants/styles";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// 👇 Get the precise, strongly-typed icon name type from the component itself
type MdiName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

// ----- Card -----
export function Card({ style, children }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ----- App Header -----
export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.headerWrap}>
      <Text style={styles.headerTitle}>{title}</Text>
      {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
    </View>
  );
}

// ----- Section Header -----
export function SectionHeader({
  title,
  actionText,
  onAction,
}: {
  title: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionText ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.link}>{actionText}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ----- Buttons -----
export function PrimaryButton({ title, onPress, style }: { title: string; onPress?: () => void; style?: ViewStyle }) {
  return (
    <Pressable style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }, style]} onPress={onPress}>
      <Text style={styles.btnPrimaryText}>{title}</Text>
    </Pressable>
  );
}
export function OutlineButton({ title, onPress, style }: { title: string; onPress?: () => void; style?: ViewStyle }) {
  return (
    <Pressable style={({ pressed }) => [styles.btnOutline, pressed && { opacity: 0.85 }, style]} onPress={onPress}>
      <Text style={styles.btnOutlineText}>{title}</Text>
    </Pressable>
  );
}

// ----- Stat Tile -----
export function StatTile({ label, value, icon }: { label: string; value: string; icon?: MdiName }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIconWrap}>
        <MaterialCommunityIcons name={icon ?? "wallet"} size={18} color={colors.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ----- List Item -----
export function ListItem({
  title,
  subtitle,
  amount,
  positive,
}: {
  title: string;
  subtitle?: string;
  amount?: string;
  positive?: boolean;
}) {
  return (
    <View style={styles.listItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listSub}>{subtitle}</Text> : null}
      </View>
      {amount ? (
        <Text style={[styles.listAmount, { color: positive ? colors.success : colors.danger }]}>{amount}</Text>
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
      )}
    </View>
  );
}

// ----- Floating Action Button -----
export function FAB({ onPress, icon = "plus" as MdiName }: { onPress?: () => void; icon?: MdiName }) {
  return (
    <Pressable onPress={onPress} style={styles.fab}>
      <MaterialCommunityIcons name={icon} size={24} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
    marginBottom: spacing.md,
  },
  headerWrap: {
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
  },
  headerSub: {
    color: colors.muted,
    marginTop: 6,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  link: { color: colors.primary, fontWeight: "700" },

  btnPrimary: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
  btnOutline: {
    height: 46,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#fff",
  },
  btnOutlineText: { color: colors.primary, fontWeight: "800" },

  statTile: {
    backgroundColor: "#F0F7FF",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "flex-start",
    justifyContent: "center",
    flex: 1,
    minWidth: 140,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#E6F0FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.text },
  statLabel: { color: colors.muted, marginTop: 2 },

  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 8,
  },
  listTitle: { fontWeight: "700", color: colors.text },
  listSub: { color: colors.muted, marginTop: 2 },
  listAmount: { fontWeight: "800" },

  fab: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
});
