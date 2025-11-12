import { TextStyle } from "react-native";

// 🎨 Chumz-like palette: confident blue + fresh green, soft neutrals
export const colors = {
  // Brand
  primary: "#1A73E8",        // bold blue
  primaryDark: "#0F5FD1",
  secondary: "#2DD4BF",      // aqua green accent
  secondaryDark: "#14B8A6",

  // UI
  background: "#F4F7FB",     // app background
  surface: "#FFFFFF",        // cards
  border: "#E8EEF6",

  // Text
  text: "#0F172A",           // slate-900
  muted: "#64748B",          // slate-500

  // Status
  success: "#22C55E",
  warning: "#F59E0B",
  danger:  "#EF4444",

  // Chart helpers
  chart1: "#34D399",
  chart2: "#60A5FA",
  chart3: "#FBBF24",
  chart4: "#F472B6",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
};

export const typography = {
  title: {
    fontSize: 24,
    fontWeight: "800" as TextStyle["fontWeight"],
    color: colors.text,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "700" as TextStyle["fontWeight"],
    color: colors.text,
  },
  muted: {
    fontSize: 14,
    fontWeight: "500" as TextStyle["fontWeight"],
    color: colors.muted,
  },
};
