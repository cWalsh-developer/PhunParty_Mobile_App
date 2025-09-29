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
  const [isGameStarted, setIsGameStarted] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initializeGame = async () => {
      cleanup = await connectToGame();
    };

    initializeGame();

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );

    return () => {
      backHandler.remove();
      gameWebSocket.disconnect();
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const connectToGame = async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      // First, get the session status to determine game type and state
      console.log("Getting session status for game type detection...");
      const API = (await import("../../assets/api/API")).default;
      const statusResponse = await API.gameSession.getStatus(sessionCode);

      if (statusResponse.isSuccess) {
        const status = statusResponse.result;
        console.log("Session status:", status);

        // Determine game type from the session info but don't start the game yet
        if (status.current_question?.genre) {
          const gameType = status.current_question.genre.toLowerCase();
          console.log("Detected game type:", gameType);
          setCurrentGameType(gameType);
        }

        // Update game state - detect if game has already started
        const gameState: GameState = {
          session_code: sessionCode,
          game_type: status.current_question?.genre?.toLowerCase() || "trivia",
          is_active: status.is_active,
          current_question: status.current_question,
        };
        setGameState(gameState);

        // Game is started if it's active AND has a current question (regardless of waiting for answers)
        const hasStarted = status.is_active && !!status.current_question;
        console.log("🎮 Game start detection:", {
          is_active: status.is_active,
          has_question: !!status.current_question,
          game_started: hasStarted,
          started_at: status.started_at,
        });

        setIsGameStarted(hasStarted);
      }
    } catch (error) {
      console.error("Error getting session status:", error);
    }

    // Setup WebSocket listeners
    gameWebSocket.onConnectionStatusChange = (connected: boolean) => {
      console.log("🔗 WebSocket connection status changed:", connected);
      if (connected) {
        setIsConnecting(false);
        setConnectionError(null);

        // Request initial state when connected
        setTimeout(() => {
          console.log("📡 Requesting session stats after connection");
          gameWebSocket.requestSessionStats();
        }, 1000);
      } else if (!isConnecting) {
        // Only show error if we were previously connected
        setConnectionError("Lost connection to game session");
      }
    };

    gameWebSocket.onGameStateUpdate = (state: GameState) => {
      console.log("Game state updated:", state);
      setGameState(state);
      if (state.game_type !== currentGameType) {
        console.log(
          `Game type changed from ${currentGameType} to ${state.game_type}`
        );
        setCurrentGameType(state.game_type);
      }
    };

    gameWebSocket.onError = (error: string) => {
      console.error("WebSocket error:", error);
      setConnectionError(error);
      setIsConnecting(false);
    };

    // Add missing event handlers for game flow
    gameWebSocket.onQuestionReceived = (question: any) => {
      console.log("Question received in GameContainer:", question);
      // The individual game components (TriviaGame, BuzzerGame) will handle this
      // but we can update game state here if needed
    };

    gameWebSocket.onGameStarted = (data: any) => {
      console.log("🎮 GAME STARTED EVENT RECEIVED:", data);
      console.log("Current isGameStarted state:", isGameStarted);
      // Game has actually started - show the game interface
      setIsGameStarted(true);
      console.log("Set isGameStarted to true");

      if (data.game_type && data.game_type !== currentGameType) {
        console.log(
          `Updating game type from ${currentGameType} to ${data.game_type}`
        );
        setCurrentGameType(data.game_type);
      }

      // Update game state to active
      if (gameState) {
        setGameState({
          ...gameState,
          is_active: true,
        });
        console.log("Updated game state to active");
      }
    };

    gameWebSocket.onPlayerJoined = (playerInfo: any) => {
      console.log("Player joined:", playerInfo);
    };

    gameWebSocket.onPlayerLeft = (playerInfo: any) => {
      console.log("Player left:", playerInfo);
    };

    gameWebSocket.onGameEnded = (data: any) => {
      console.log("Game ended:", data);
      // Handle game end if needed
    };

    // Attempt connection
    const success = await gameWebSocket.connect(sessionCode, playerInfo);

    if (!success) {
      setConnectionError("Failed to connect to game session");
      setIsConnecting(false);
    }

    return () => {}; // Return empty cleanup function
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

  const checkGameStatus = async () => {
    try {
      console.log("🔍 Manual game status check triggered");
      const API = (await import("../../assets/api/API")).default;
      const statusResponse = await API.gameSession.getStatus(sessionCode);

      if (statusResponse.isSuccess) {
        const status = statusResponse.result;
        console.log("📊 Manual status check result:", status);

        Alert.alert(
          "Game Status",
          `Active: ${status.is_active}\nWaiting for Answers: ${
            status.is_waiting_for_players
          }\nPlayers: ${
            status.players?.total || 0
          }\nHas Question: ${!!status.current_question}`,
          [{ text: "OK" }]
        );

        // Game has started if it's active and has a current question
        if (!isGameStarted && status.is_active && status.current_question) {
          console.log("🎮 Game started detected via manual check!");
          setIsGameStarted(true);
        }
      } else {
        Alert.alert(
          "Error",
          statusResponse.message || "Failed to check status"
        );
      }
    } catch (error: any) {
      console.error("Manual status check error:", error);
      Alert.alert("Error", error.message || "Failed to check game status");
    }
  };

  const renderGameContent = () => {
    console.log("Rendering game content:", {
      currentGameType,
      gameState,
      isGameStarted,
      isWaitingForPlayers: gameState?.current_question === undefined,
    });

    // Show lobby/waiting screen if game hasn't started yet
    if (!isGameStarted || !currentGameType || !gameState) {
      // Fallback: If we have a valid session but no game started event,
      // assume it's a trivia game and show it directly
      if (sessionCode && !isConnecting && !connectionError) {
        console.log(
          "🔍 Session exists but no game started - showing trivia game as fallback"
        );
        return (
          <TriviaGame
            sessionCode={sessionCode}
            onGameEnd={handleGameEnd}
            onError={handleGameError}
          />
        );
      }

      return (
        <View style={styles.centerContainer}>
          <AppCard style={styles.statusCard}>
            <MaterialIcons name="gamepad" size={48} color={colors.tea[500]} />
            <Text style={styles.statusTitle}>Game Lobby</Text>
            <Text style={styles.statusText}>
              {currentGameType
                ? `${
                    currentGameType.charAt(0).toUpperCase() +
                    currentGameType.slice(1)
                  } Game - Waiting to start...`
                : "Waiting for game to start..."}
            </Text>
            <Text style={styles.sessionInfo}>Session: {sessionCode}</Text>
            <Text style={styles.playerInfo}>
              Player: {playerInfo.player_name}
            </Text>
            {currentGameType && (
              <Text style={styles.gameTypeInfo}>
                Game Type:{" "}
                {currentGameType.charAt(0).toUpperCase() +
                  currentGameType.slice(1)}
              </Text>
            )}
            <View style={styles.actionButtons}>
              <AppButton
                title="Check Game Status"
                onPress={checkGameStatus}
                variant="secondary"
                style={styles.actionButton}
              />
            </View>
          </AppCard>
        </View>
      );
    }

    // Game has started - render the actual game component
    const gameType = currentGameType.toLowerCase();
    console.log("Game started - rendering game type:", gameType);

    switch (gameType) {
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
  gameTypeInfo: {
    ...typography.body,
    color: colors.tea[400],
    marginTop: 8,
    fontStyle: "italic",
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
