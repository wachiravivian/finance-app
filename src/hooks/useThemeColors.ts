// src/hooks/useThemeColors.ts
import { useTheme } from './useTheme';

export const useThemeColors = () => {
  const { isDark } = useTheme();

  if (isDark) {
    return {
      background: '#121212',
      cardBackground: '#1e1e1e',
      text: '#fff',
      // ... other dark colors
    };
  } else {
    return {
      background: '#f5f5f5',
      cardBackground: 'white',
      text: '#333',
      // ... other light colors
    };
  }
};