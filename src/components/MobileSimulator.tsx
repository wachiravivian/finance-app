// src/components/MobileSimulator.tsx
import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface MobileSimulatorProps {
  children: React.ReactNode;
  enabled?: boolean;
}

export default function MobileSimulator({ children, enabled = true }: MobileSimulatorProps) {
  if (!enabled || width < 768) {
    // On actual mobile devices or when disabled, render normally
    return <>{children}</>;
  }

  // Mobile simulation for desktop
  return (
    <View style={styles.desktopContainer}>
      <View style={styles.phoneFrame}>
        <View style={styles.phoneNotch}>
          <View style={styles.speaker} />
          <View style={styles.camera} />
        </View>
        <View style={styles.phoneScreen}>
          {children}
        </View>
        <View style={styles.homeIndicator} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    paddingVertical: 20,
  },
  phoneFrame: {
    width: 375, // iPhone width
    height: 812, // iPhone height
    backgroundColor: '#000',
    borderRadius: 40,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    marginVertical: 20,
  },
  phoneNotch: {
    width: '100%',
    height: 40,
    backgroundColor: '#000',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingBottom: 8,
  },
  speaker: {
    width: 60,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginRight: 5,
  },
  camera: {
    width: 8,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 30,
    overflow: 'hidden',
  },
  homeIndicator: {
    width: 134,
    height: 5,
    backgroundColor: '#000',
    borderRadius: 3,
    alignSelf: 'center',
    marginVertical: 10,
  },
});