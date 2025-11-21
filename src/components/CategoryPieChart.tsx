import React from "react";
import { View, Text } from "react-native";
import { VictoryPie } from "victory";

type CategoryDatum = { category: string; amount: number };

export default function CategoryPieChart({ data }: { data: CategoryDatum[] }) {
  if (!data || data.length === 0) return null;

  return (
    <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 10, marginBottom: 12 }}>
      <Text style={{ fontWeight: "800", fontSize: 16, marginBottom: 8, color: "#0f172a" }}>
        Top Expense Categories
      </Text>
      <VictoryPie
        colorScale={["#FF8042", "#FFBB28", "#0088FE", "#00C49F", "#AA336A"]}
        data={data.map((d) => ({ x: d.category, y: d.amount }))}
        labels={({ datum }: { datum: any }) =>
          `${datum.x}\nKES ${datum.y.toLocaleString()}`
        }
        style={{
          labels: { fontSize: 11, fill: "#0f172a" },
        }}
      />
    </View>
  );
}
