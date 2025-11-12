import React from 'react';
import { View, Text } from 'react-native';
import { ProgressChart } from 'react-native-chart-kit';
import { colors, spacing } from '../constants/styles';
import { Dimensions } from 'react-native';

const width = Math.min(220, Dimensions.get('window').width / 2);

export default function CategoryDonut({
  label,
  spent,
  budget,
}: {
  label: string;
  spent: number;
  budget: number;
}) {
  const pct = budget > 0 ? Math.min(1, Math.max(0, spent / budget)) : 0;

  return (
    <View style={{ alignItems: 'center' }}>
      <ProgressChart
        data={{ labels: [label], data: [pct] }}
        width={width}
        height={180}
        strokeWidth={10}
        radius={40}
        chartConfig={{
          backgroundGradientFrom: '#fff',
          backgroundGradientTo: '#fff',
          color: (o = 1) => `rgba(59,130,246,${o})`, // primary-ish
          labelColor: (o = 1) => `rgba(17,24,39,${o})`,
        }}
        hideLegend
      />
      <Text style={{ fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: colors.muted, marginTop: 2 }}>
        {Math.round(pct * 100)}% — KES {spent.toLocaleString()} / {budget.toLocaleString()}
      </Text>
    </View>
  );
}
