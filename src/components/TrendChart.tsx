import React from "react";
import { View, Text } from "react-native";
import {
  VictoryChart,
  VictoryLine,
  VictoryTheme,
  VictoryAxis,
  VictoryLegend,
} from "victory";

type TrendDatum = { month: string; income: number; expenses: number; net: number };

export default function TrendChart({ data }: { data: TrendDatum[] }) {
  if (!data || data.length === 0) return null;

  return (
    <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 10, marginBottom: 12 }}>
      <Text style={{ fontWeight: "800", fontSize: 16, marginBottom: 8, color: "#0f172a" }}>
        Income vs Expenses Trend
      </Text>

      <VictoryChart theme={VictoryTheme.material}>
        <VictoryLegend
          x={50}
          y={0}
          orientation="horizontal"
          gutter={20}
          data={[
            { name: "Income", symbol: { fill: "#16a34a" } },
            { name: "Expenses", symbol: { fill: "#dc2626" } },
            { name: "Net", symbol: { fill: "#2563eb" } },
          ]}
        />
        <VictoryAxis
          tickFormat={(t: string) =>
            new Date(t).toLocaleDateString("en", { month: "short" })
          }
        />
        <VictoryAxis dependentAxis />
        <VictoryLine data={data} x="month" y="income" style={{ data: { stroke: "#16a34a" } }} />
        <VictoryLine data={data} x="month" y="expenses" style={{ data: { stroke: "#dc2626" } }} />
        <VictoryLine data={data} x="month" y="net" style={{ data: { stroke: "#2563eb" } }} />
      </VictoryChart>
    </View>
  );
}
