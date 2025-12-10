import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ConnectionState,
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
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentGameType, setCurrentGameType] = useState<string | null>(null);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isWaitingForQuestion, setIsWaitingForQuestion] = useState(false);
  const [pulseAnimation] = useState(new Animated.Value(1));

  // Use ref to track game started state synchronously (avoids race condition)
  const gameStartedRef = useRef(false);

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

    // Start pulsing animation for lobby
    startPulsingAnimation();

    return () => {
      backHandler.remove();
      gameWebSocket.disconnect();
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const startPulsingAnimation = () => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };
    pulse();
  };

  const connectToGame = async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Validate session code
      if (!sessionCode) {
        throw new Error("No session code provided");
      }

      // First, get the session status to determine game type and state

      const API = (await import("../../assets/api/API")).default;
      const statusResponse = await API.gameSession.getStatus(sessionCode);

      if (statusResponse.isSuccess) {
        if (!statusResponse.result) {
          throw new Error("No session data received");
        }

        const status = statusResponse.result;

        // Determine game type from the session info but don't start the game yet
        if (status.current_question?.genre) {
          const gameType = status.current_question.genre.toLowerCase();

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

        // IMPORTANT: Only set game as started if it's both active AND has questions
        // AND not waiting for players (meaning host has actually clicked start)
        const hasActuallyStarted =
          status.is_active &&
          !!status.current_question &&
          !status.is_waiting_for_players;
        console.log("🎮 Game start detection:", {
          is_active: status.is_active,
          has_question: !!status.current_question,
          is_waiting_for_players: status.is_waiting_for_players,
          game_started: hasActuallyStarted,
          started_at: status.started_at,
        });

        setIsGameStarted(hasActuallyStarted);
      } else {
        throw new Error(
          statusResponse.message || "Failed to get session status"
        );
      }
    } catch (error: any) {
      console.error("Error details:", {
        message: error.message,
        sessionCode,
      });
      setConnectionError(error.message || "Failed to connect to game session");
    }

    // Setup WebSocket listeners - New connection state handler
    gameWebSocket.onConnectionStateChange = (state: ConnectionState) => {
      console.log("🔌 Connection state changed:", state);
      setConnectionState(state);

      if (state === "connected") {
        setIsConnecting(false);
        setConnectionError(null);

        // Request initial state when connected
        setTimeout(() => {
          console.log("📊 Requesting session stats after connection");
          gameWebSocket.requestSessionStats();
        }, 1000);
      } else if (state === "reconnecting") {
        console.log("🔄 WebSocket reconnecting...");
      } else if (state === "disconnected" && !isConnecting) {
        // Only show error if we were previously connected
        setConnectionError("Lost connection to game session");
      }
    };

    // Maintain backward compatibility with old callback
    gameWebSocket.onConnectionStatusChange = (connected: boolean) => {
      console.log("🔌 Connection status (legacy):", connected);
      if (connected) {
        setIsConnecting(false);
        setConnectionError(null);
      } else if (!isConnecting) {
        setConnectionError("Lost connection to game session");
      }
    };

    gameWebSocket.onGameStateUpdate = (state: GameState) => {
      setGameState(state);
      if (state.game_type !== currentGameType) {
        console.log(
          `Game type changed from ${currentGameType} to ${state.game_type}`
        );
        setCurrentGameType(state.game_type);
      }
    };

    gameWebSocket.onError = (error: string) => {
      setConnectionError(error);
      setIsConnecting(false);
    };
    const fetchQuestionFromAPI = async () => {
      console.log("🔄 Fetching current question from API...");
      try {
        const API = (await import("../../assets/api/API")).default;
        const response = await API.gameSession.getCurrentQuestion(sessionCode);

        if (response.isSuccess && response.result) {
          console.log("✅ Question fetched successfully from API");
          setIsWaitingForQuestion(false);
          // The TriviaGame component will pick this up
        } else {
          console.error("❌ Failed to fetch question:", response.message);
          // Keep waiting - might arrive via WebSocket still
          setTimeout(fetchQuestionFromAPI, 1000); // Retry in 1 second
        }
      } catch (error) {
        console.error("❌ Error fetching question:", error);
        setTimeout(fetchQuestionFromAPI, 1000); // Retry in 1 second
      }
    };

    gameWebSocket.onGameStarted = (data: any) => {
      console.log(
        "🚀 GAME STARTED EVENT RECEIVED - Intro beginning, waiting for synchronized question reveal"
      );
      console.log("📦 Game started data:", JSON.stringify(data, null, 2));

      // Transition from lobby to game screen
      if (data && data.isstarted === true) {
        console.log("🎮 Game started - Intro beginning");
        console.log("📍 Setting isGameStarted = true");

        gameStartedRef.current = true; // Mark game as started
        setIsGameStarted(true);

        // Set ready for questions so they can be delivered when question_started arrives
        gameWebSocket.setReadyForQuestions(true);

        // DO NOT extract or display question here
        // The question will arrive via question_started with start_at timing
        console.log(
          "⏳ Waiting for synchronized question reveal (question_started + start_at)..."
        );
      }

      if (data.game_type && data.game_type !== currentGameType) {
        setCurrentGameType(data.game_type);
      }
      if (gameState && data.isstarted === true) {
        setGameState({
          ...gameState,
          is_active: true,
          // DO NOT set current_question here - let synchronized reveal handle it
        });
      }
    };

    gameWebSocket.onPlayerJoined = (playerInfo: any) => {
      console.log("👤 Player joined or roster updated:", playerInfo);
      // Handle both individual player_joined and roster_update messages
      // You can add state management here if you want to track connected players
    };

    gameWebSocket.onPlayerLeft = (playerInfo: any) => {
      console.log("👋 Player left:", playerInfo);
      // Handle player leaving
    };

    gameWebSocket.onGameEnded = (data: any) => {
      // Handle game end if needed
    }; // Attempt connection
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
    console.log("📺 Resetting WebSocket: UI no longer ready for questions");
    gameWebSocket.setReadyForQuestions(false); // Reset ready state
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
      const API = (await import("../../assets/api/API")).default;
      const statusResponse = await API.gameSession.getStatus(sessionCode);

      if (statusResponse.isSuccess) {
        const status = statusResponse.result;

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
          setIsGameStarted(true);
        }
      } else {
        Alert.alert(
          "Error",
          statusResponse.message || "Failed to check status"
        );
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to check game status");
    }
  };

  const renderGameContent = () => {
    console.log("Rendering game content:", {
      currentGameType,
      gameState,
      isGameStarted,
      isWaitingForQuestion,
      isConnecting,
      connectionError,
    });

    // Show lobby screen if game hasn't started yet
    if (!isGameStarted) {
      return (
        <View style={styles.centerContainer}>
          <AppCard style={styles.lobbyCard}>
            <MaterialIcons name="people" size={64} color={colors.tea[500]} />
            <Text style={styles.lobbyTitle}>Game Lobby</Text>
            <Text style={styles.lobbyText}>
              Waiting for host to start the game...
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

            {/* Lobby status indicator */}
            <View style={styles.statusIndicator}>
              <Animated.View
                style={[styles.pulsingDot, { opacity: pulseAnimation }]}
              />
              <Text style={styles.statusText}>Connected & Ready</Text>
            </View>

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

    // Game has started - show loading while waiting for first question
    // NOTE: We don't actually wait here - TriviaGame handles showing "waiting" state
    // Just render the game component which will show its own waiting UI if needed
    if (isWaitingForQuestion) {
      // This state is only used for explicit API polling scenarios
      // In normal flow, we go straight to rendering the game component
      return (
        <View style={styles.centerContainer}>
          <AppCard style={styles.loadingCard}>
            <MaterialIcons
              name="hourglass-empty"
              size={64}
              color={colors.tea[500]}
            />
            <Text style={styles.loadingTitle}>
              Waiting for next question...
            </Text>
            <Text style={styles.sessionInfo}>Session: {sessionCode}</Text>
            <View style={styles.statusIndicator}>
              <Animated.View
                style={[styles.pulsingDot, { opacity: pulseAnimation }]}
              />
              <Text style={styles.statusText}>Syncing</Text>
            </View>
          </AppCard>
        </View>
      );
    }

    // Game has started and question received - render the actual game component
    const gameType = currentGameType?.toLowerCase() || "trivia";

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
          <TriviaGame
            sessionCode={sessionCode}
            onGameEnd={handleGameEnd}
            onError={handleGameError}
          />
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

      {/* Connection status banner */}
      {connectionState === "reconnecting" && (
        <View style={styles.reconnectingBanner}>
          <MaterialIcons name="sync" size={16} color={colors.ink[900]} />
          <Text style={styles.reconnectingText}>🔄 Reconnecting...</Text>
        </View>
      )}

      {connectionState === "disconnected" && !isConnecting && (
        <View style={styles.disconnectedBanner}>
          <MaterialIcons name="wifi-off" size={16} color={colors.stone[100]} />
          <Text style={styles.disconnectedText}>
            ❌ Connection lost. Please refresh.
          </Text>
        </View>
      )}

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
  lobbyCard: {
    alignItems: "center",
    padding: 40,
    maxWidth: 380,
    borderColor: colors.tea[500],
    borderWidth: 1,
  },
  loadingCard: {
    alignItems: "center",
    padding: 40,
    maxWidth: 380,
    borderColor: colors.tea[500],
    borderWidth: 1,
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
  lobbyTitle: {
    ...typography.h2,
    color: colors.tea[400],
    marginTop: 16,
    textAlign: "center",
    fontWeight: "bold",
  },
  loadingTitle: {
    ...typography.h2,
    color: colors.tea[400],
    marginTop: 16,
    textAlign: "center",
    fontWeight: "bold",
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
  lobbyText: {
    ...typography.h3,
    color: colors.stone[300],
    marginTop: 12,
    textAlign: "center",
    lineHeight: 24,
  },
  loadingText: {
    ...typography.h3,
    color: colors.stone[300],
    marginTop: 12,
    textAlign: "center",
    lineHeight: 24,
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
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  pulsingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.tea[500],
    marginRight: 8,
  },
  actionButtons: {
    marginTop: 24,
    width: "100%",
  },
  actionButton: {
    marginTop: 12,
  },
  reconnectingBanner: {
    backgroundColor: colors.tea[500],
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reconnectingText: {
    ...typography.body,
    color: colors.ink[900],
    fontWeight: "600",
  },
  disconnectedBanner: {
    backgroundColor: colors.red[500],
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disconnectedText: {
    ...typography.body,
    color: colors.stone[100],
    fontWeight: "600",
  },
});

export default GameContainer;
