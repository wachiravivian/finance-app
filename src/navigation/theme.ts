import { DefaultTheme, Theme } from "@react-navigation/native";
import { colors } from "../constants/styles";

export const AppNavTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.primary,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.secondary,
  },
};
