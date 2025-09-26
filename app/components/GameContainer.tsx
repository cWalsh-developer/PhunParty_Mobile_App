import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { Alert, BackHandler, StyleSheet, Text, View } from "react-native";
import {
  GameState,
  gameWebSocket,
  PlayerInfo,
} from "../../assets/api/gameWebSocketService";
import { AppButton } from "../../assets/components/AppButton";
import { AppCard } from "../../assets/components/AppCard";
import { colors } from "../../assets/theme/colors";
import { typography } from "../../assets/theme/typography";
import BuzzerGame from "./BuzzerGame";
import TriviaGame from "./TriviaGame";

interface GameContainerProps {
  sessionCode: string;
  playerInfo: PlayerInfo;
  onLeaveGame: () => void;
}

export const GameContainer: React.FC<GameContainerProps> = ({
  sessionCode,
  playerInfo,
  onLeaveGame,
}) => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentGameType, setCurrentGameType] = useState<string | null>(null);

  useEffect(() => {
    connectToGame();

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );

    return () => {
      backHandler.remove();
      gameWebSocket.disconnect();
    };
  }, []);

  const connectToGame = async () => {
    setIsConnecting(true);
    setConnectionError(null);

    // Setup WebSocket listeners
    gameWebSocket.onConnectionStatusChange = (connected: boolean) => {
      if (connected) {
        setIsConnecting(false);
        setConnectionError(null);
      } else if (!isConnecting) {
        // Only show error if we were previously connected
        setConnectionError("Lost connection to game session");
      }
    };

    gameWebSocket.onGameStateUpdate = (state: GameState) => {
      console.log("Game state updated:", state);
      setGameState(state);
      if (state.game_type !== currentGameType) {
        setCurrentGameType(state.game_type);
      }
    };

    gameWebSocket.onError = (error: string) => {
      console.error("WebSocket error:", error);
      setConnectionError(error);
      setIsConnecting(false);
    };

    // Attempt connection
    const success = await gameWebSocket.connect(sessionCode, playerInfo);

    if (!success) {
      setConnectionError("Failed to connect to game session");
      setIsConnecting(false);
    }
  };

  const handleBackPress = () => {
    showLeaveGameConfirmation();
    return true; // Prevent default back action
  };

  const showLeaveGameConfirmation = () => {
    Alert.alert(
      "Leave Game?",
      "Are you sure you want to leave this game session?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: handleLeaveGame },
      ]
    );
  };

  const handleLeaveGame = () => {
    gameWebSocket.disconnect();
    onLeaveGame();
  };

  const handleGameEnd = () => {
    // Game ended naturally, show summary or return to lobby
    handleLeaveGame();
  };

  const handleGameError = (error: string) => {
    Alert.alert("Game Error", error, [
      { text: "Retry", onPress: connectToGame },
      { text: "Leave Game", style: "destructive", onPress: handleLeaveGame },
    ]);
  };

  const renderGameContent = () => {
    if (!currentGameType || !gameState) {
      return (
        <View style={styles.centerContainer}>
          <AppCard style={styles.statusCard}>
            <MaterialIcons name="gamepad" size={48} color={colors.tea[500]} />
            <Text style={styles.statusTitle}>Connected to Game</Text>
            <Text style={styles.statusText}>Waiting for game to start...</Text>
            <Text style={styles.sessionInfo}>Session: {sessionCode}</Text>
            <Text style={styles.playerInfo}>
              Player: {playerInfo.player_name}
            </Text>
          </AppCard>
        </View>
      );
    }

    switch (currentGameType.toLowerCase()) {
      case "trivia":
        return (
          <TriviaGame
            sessionCode={sessionCode}
            onGameEnd={handleGameEnd}
            onError={handleGameError}
          />
        );

      case "buzzer":
        return (
          <BuzzerGame
            sessionCode={sessionCode}
            onGameEnd={handleGameEnd}
            onError={handleGameError}
          />
        );

      default:
        return (
          <View style={styles.centerContainer}>
            <AppCard style={styles.statusCard}>
              <MaterialIcons
                name="help-outline"
                size={48}
                color={colors.stone[400]}
              />
              <Text style={styles.statusTitle}>Unknown Game Type</Text>
              <Text style={styles.statusText}>
                Game type "{currentGameType}" is not supported
              </Text>
              <AppButton
                title="Leave Game"
                onPress={handleLeaveGame}
                variant="secondary"
                style={styles.actionButton}
              />
            </AppCard>
          </View>
        );
    }
  };

  if (isConnecting) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centerContainer}>
          <AppCard style={styles.statusCard}>
            <MaterialIcons
              name="wifi-tethering"
              size={48}
              color={colors.tea[500]}
            />
            <Text style={styles.statusTitle}>Connecting to Game</Text>
            <Text style={styles.statusText}>
              Please wait while we connect you to the session...
            </Text>
            <Text style={styles.sessionInfo}>Session: {sessionCode}</Text>
          </AppCard>
        </View>
      </View>
    );
  }

  if (connectionError) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centerContainer}>
          <AppCard style={styles.errorCard}>
            <MaterialIcons
              name="error-outline"
              size={48}
              color={colors.red[500]}
            />
            <Text style={styles.errorTitle}>Connection Error</Text>
            <Text style={styles.errorText}>{connectionError}</Text>
            <View style={styles.actionButtons}>
              <AppButton
                title="Retry Connection"
                onPress={connectToGame}
                variant="primary"
                style={styles.actionButton}
              />
              <AppButton
                title="Leave Game"
                onPress={handleLeaveGame}
                variant="secondary"
                style={styles.actionButton}
              />
            </View>
          </AppCard>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header with session info and leave button */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>PhunParty</Text>
          <Text style={styles.headerSubtitle}>
            {currentGameType
              ? `${
                  currentGameType.charAt(0).toUpperCase() +
                  currentGameType.slice(1)
                } Game`
              : "Game Session"}
          </Text>
        </View>
        <AppButton
          title="Leave"
          onPress={showLeaveGameConfirmation}
          variant="secondary"
          style={styles.leaveButton}
        />
      </View>

      {/* Game content */}
      <View style={styles.gameArea}>{renderGameContent()}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink[900],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[800],
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.stone[100],
    fontWeight: "bold",
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.stone[400],
    marginTop: 2,
  },
  leaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gameArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  statusCard: {
    alignItems: "center",
    padding: 32,
    maxWidth: 350,
  },
  errorCard: {
    alignItems: "center",
    padding: 32,
    maxWidth: 350,
    borderColor: colors.red[500],
    borderWidth: 1,
  },
  statusTitle: {
    ...typography.h3,
    color: colors.stone[100],
    marginTop: 16,
    textAlign: "center",
  },
  errorTitle: {
    ...typography.h3,
    color: colors.red[500],
    marginTop: 16,
    textAlign: "center",
  },
  statusText: {
    ...typography.body,
    color: colors.stone[300],
    marginTop: 12,
    textAlign: "center",
    lineHeight: 22,
  },
  errorText: {
    ...typography.body,
    color: colors.stone[300],
    marginTop: 12,
    textAlign: "center",
    lineHeight: 22,
  },
  sessionInfo: {
    ...typography.body,
    color: colors.tea[500],
    marginTop: 16,
    fontWeight: "bold",
  },
  playerInfo: {
    ...typography.body,
    color: colors.stone[400],
    marginTop: 4,
  },
  actionButtons: {
    marginTop: 24,
    width: "100%",
  },
  actionButton: {
    marginTop: 12,
  },
});

export default GameContainer;
