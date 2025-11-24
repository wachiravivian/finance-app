// contexts/ThemeContext.tsx
import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define your theme colors with all required properties
export const lightTheme = {
  background: '#f5f5f5',
  cardBackground: 'white',
  text: '#333',
  subtitle: '#666',
  border: '#f0f0f0',
  primary: '#007AFF',
  danger: '#FF3B30',
  income: '#4CAF50',
  expense: '#FF6B6B',
  headerBackground: 'white',
  summaryCard: ['#667eea', '#764ba2'],
  
  // Add missing properties
  muted: '#6c757d',
  warningText: '#856404',
  textSecondary: '#6c757d',
  textPrimary: '#333',
  card: '#ffffff',
  inputBackground: '#f8f9fa',
  listContent: '#f8f9fa',
};

export const darkTheme = {
  background: '#121212',
  cardBackground: '#1e1e1e',
  text: '#ffffff',
  subtitle: '#a0a0a0',
  border: '#2a2a2a',
  primary: '#0A84FF',
  danger: '#FF453A',
  income: '#30D158',
  expense: '#FF453A',
  headerBackground: '#1c1c1e',
  summaryCard: ['#4a4a4a', '#2d2d2d'],
  
  // Add missing properties
  muted: '#a0a0a0',
  warningText: '#ffb74d',
  textSecondary: '#a0a0a0',
  textPrimary: '#ffffff',
  card: '#1e1e1e',
  inputBackground: '#2d2d2d',
  listContent: '#1a1a1a',
};

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: typeof lightTheme;
}

export const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleTheme: () => {},
  colors: lightTheme,
});

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('user_theme_preference');
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      } else {
        // If no saved preference, use system setting
        setIsDark(systemColorScheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = useCallback(async () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    
    try {
      await AsyncStorage.setItem('user_theme_preference', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  }, [isDark]);

  const colors = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};