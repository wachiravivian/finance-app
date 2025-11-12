import React, { ReactNode } from "react";
import { View, Text, type ColorValue } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { colors, spacing, radius, typography, shadow } from "../constants/styles";

// helper tuple type: at least two ColorValues
type GradientTuple = readonly [ColorValue, ColorValue, ...ColorValue[]];

export function SectionHeader({
  title,
  actionText,
  onPress,
}: {
  title: string;
  actionText?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.sm,
      }}
    >
      <Text style={[typography.subtitle]}>{title}</Text>
      {!!actionText && (
        <Text onPress={onPress} style={{ color: colors.secondary, fontWeight: "600" }}>
          {actionText}
        </Text>
      )}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: any }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Chip({
  icon,
  label,
  tone = "default",
}: {
  icon?: React.ComponentProps<typeof Icon>["name"];
  label: string;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const map: Record<
    NonNullable<typeof tone>,
    { bg: string; fg: string }
  > = {
    default: { bg: "#F3F4F6", fg: "#111827" },
    success: { bg: "#E8F8EE", fg: "#1B5E20" },
    danger: { bg: "#FDECEC", fg: "#B00020" },
    warning: { bg: "#FFF5E5", fg: "#8B5E00" },
  };
  const c = map[tone];
  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      {icon ? <Icon name={icon} size={14} color={c.fg} style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: c.fg, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function GradientStat({
  title,
  value,
  gradient,
}: {
  title: string;
  value: string;
  gradient: GradientTuple; // tuple type
}) {
  return (
    <LinearGradient colors={gradient} style={{ borderRadius: 16, padding: spacing.md }}>
      <Text style={{ color: "#fff", opacity: 0.9, fontSize: 12 }}>{title}</Text>
      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 4 }}>{value}</Text>
    </LinearGradient>
  );
}
