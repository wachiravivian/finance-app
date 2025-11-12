import React from "react";
import { View, Text, Button } from "react-native";

type State = { hasError: boolean; message?: string };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, message: String(error?.message ?? error) };
  }

  componentDidCatch(error: any, info: any) {
    console.warn("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ textAlign: "center", color: "#6B7280", marginBottom: 16 }}>
            {this.state.message}
          </Text>
          <Button title="Reload app" onPress={() => this.setState({ hasError: false, message: undefined })} />
        </View>
      );
    }
    return this.props.children;
  }
}
