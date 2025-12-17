import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  ConnectionState,
  gameWebSocket,
} from "../../assets/api/gameWebSocketService";
import { colors } from "../../assets/theme/colors";

/**
 * Development-only component to monitor WebSocket connection health
 * Shows connection state, attempt count, and diagnostic info
 *
 * Usage: Add to GameContainer during development
 * <ConnectionMonitor enabled={__DEV__} />
 */
interface ConnectionMonitorProps {
  enabled?: boolean;
  position?: "top" | "bottom";
}

export const ConnectionMonitor: React.FC<ConnectionMonitorProps> = ({
  enabled = false,
  position = "bottom",
}) => {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [diagnostics, setDiagnostics] = useState<any>(null);

  useEffect(() => {
    if (!enabled) return;

    // Subscribe to connection state changes
    const originalHandler = gameWebSocket.onConnectionStateChange;

    gameWebSocket.onConnectionStateChange = (state) => {
      setConnectionState(state);
      originalHandler?.(state);
    };

    // Update diagnostics every 2 seconds
    const interval = setInterval(() => {
      const diag = gameWebSocket.getConnectionDiagnostics();
      setDiagnostics(diag);
    }, 2000);

    return () => {
      clearInterval(interval);
      gameWebSocket.onConnectionStateChange = originalHandler;
    };
  }, [enabled]);

  if (!enabled || !diagnostics) return null;

  const getStateColor = (state: ConnectionState) => {
    switch (state) {
      case "connected":
        return colors.tea[500];
      case "connecting":
      case "reconnecting":
        return colors.peach[500];
      case "disconnected":
        return colors.red[500];
      default:
        return colors.ink[700];
    }
  };

  const getStateIcon = (state: ConnectionState) => {
    switch (state) {
      case "connected":
        return "✅";
      case "connecting":
        return "🔄";
      case "reconnecting":
        return "⚠️";
      case "disconnected":
        return "❌";
      default:
        return "❓";
    }
  };

  return (
    <View
      style={[
        styles.container,
        position === "top" ? styles.top : styles.bottom,
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>
          {getStateIcon(connectionState)} Connection Monitor
        </Text>
      </View>
      <View style={styles.content}>
        <Text
          style={[styles.stateText, { color: getStateColor(connectionState) }]}
        >
          State: {connectionState.toUpperCase()}
        </Text>
        <Text style={styles.detailText}>
          Session: {diagnostics.sessionCode || "None"}
        </Text>
        <Text style={styles.detailText}>
          Attempts: {diagnostics.connectionAttemptCount}/
          {diagnostics.isConnecting ? " (connecting)" : ""}
        </Text>
        <Text style={styles.detailText}>
          Reconnects: {diagnostics.reconnectAttempts}
        </Text>
        {diagnostics.heartbeatHealth && (
          <Text
            style={[
              styles.detailText,
              {
                color: diagnostics.heartbeatHealth.isHealthy
                  ? colors.tea[500]
                  : colors.red[500],
              },
            ]}
          >
            💓{" "}
            {Math.round(diagnostics.heartbeatHealth.timeSinceLastPong / 1000)}s
            {diagnostics.heartbeatHealth.isHealthy ? " ✓" : " ⚠️"}
          </Text>
        )}
        {diagnostics.wsId && (
          <Text style={styles.detailText}>
            WS ID: {diagnostics.wsId.substring(0, 8)}...
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 10,
    right: 10,
    backgroundColor: "rgba(10, 10, 10, 0.95)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ink[700],
    padding: 10,
    zIndex: 9999,
  },
  top: {
    top: 50,
  },
  bottom: {
    bottom: 20,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[700],
    paddingBottom: 5,
    marginBottom: 5,
  },
  title: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.white,
  },
  content: {
    gap: 3,
  },
  stateText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  detailText: {
    fontSize: 10,
    color: colors.stone[300],
  },
});
