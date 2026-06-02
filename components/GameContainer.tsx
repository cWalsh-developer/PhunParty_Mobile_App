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
import * as APIGame from "../assets/api/API";
import {
  ConnectionState,
  CountdownState,
  FairPlaySettings,
  FairPlayStatus,
  FocusViolationReason,
  GamePhase,
  GameState,
  gameWebSocket,
  PlayerInfo,
} from "../assets/api/gameWebSocketService";
import { AppButton } from "../assets/components/AppButton";
import { AppCard } from "../assets/components/AppCard";
import { colors } from "../assets/theme/colors";
import { typography } from "../assets/theme/typography";
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
  const [gamePhase, setGamePhase] = useState<GamePhase>("lobby");
  const [fairPlaySettings, setFairPlaySettings] = useState<FairPlaySettings>({
    enabled: false,
    maxStrikes: 3,
  });
  const [fairPlayStatus, setFairPlayStatus] = useState<FairPlayStatus | null>(
    null,
  );
  const [countdownQuestionStartAt, setCountdownQuestionStartAt] = useState<
    string | null
  >(null);
  const [countdownRemainingMs, setCountdownRemainingMs] = useState(0);
  const [pulseAnimation] = useState(new Animated.Value(1));

  // Use ref to track game started state synchronously (avoids race condition)
  const gameStartedRef = useRef(false);

  // CRITICAL: Track connection attempts to prevent duplicates
  const hasAttemptedConnection = useRef(false);
  const isCurrentlyConnecting = useRef(false);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);
  const countdownIntervalRef = useRef<any>(null);

  const inferGameType = (data: any): string | null => {
    const source = data?.current_question ?? data?.question ?? data;
    const explicitType =
      source?.game_type ||
      source?.gameType ||
      source?.genre ||
      data?.game_type ||
      data?.gameType ||
      data?.genre;

    const normalizedType =
      typeof explicitType === "string" ? explicitType.toLowerCase() : null;

    if (source?.ui_mode === "buzzer" || normalizedType === "buzzer") {
      return "buzzer";
    }

    if (normalizedType) {
      return normalizedType;
    }

    return null;
  };

  const parseOptionalNumber = (...values: any[]): number | undefined => {
    const value = values.find(
      (candidate) => candidate !== undefined && candidate !== null,
    );

    if (value === undefined) {
      return undefined;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  };

  const normalizeFairPlaySettings = (
    payload: any,
  ): FairPlaySettings | null => {
    const source =
      payload?.fair_play_settings ??
      payload?.fairPlaySettings ??
      payload?.fair_play ??
      payload?.fairPlay ??
      payload;

    const enabled =
      source?.enabled ??
      source?.fair_play_enabled ??
      source?.fairPlayEnabled ??
      source?.cheat_detection_enabled ??
      source?.cheatDetectionEnabled;

    if (typeof enabled !== "boolean") {
      return null;
    }

    const maxStrikesRaw =
      source?.maxStrikes ??
      source?.max_fair_play_strikes ??
      source?.maxFairPlayStrikes ??
      source?.max_strikes ??
      source?.max_cheat_strikes ??
      source?.maxCheatStrikes;
    const maxStrikes = Number(maxStrikesRaw);

    return {
      enabled,
      maxStrikes: Number.isFinite(maxStrikes) && maxStrikes > 0 ? maxStrikes : 3,
    };
  };

  const normalizeFairPlayStatus = (payload: any): FairPlayStatus | null => {
    if (!payload) {
      return null;
    }

    const hasWrappedStatus = Boolean(
      payload?.fair_play_status ??
        payload?.fairPlayStatus ??
        payload?.player_fair_play_status ??
        payload?.playerFairPlayStatus,
    );
    const source =
      payload?.fair_play_status ??
      payload?.fairPlayStatus ??
      payload?.player_fair_play_status ??
      payload?.playerFairPlayStatus ??
      payload;
    const hasStatusFields = [
      "player_id",
      "playerId",
      "participant_id",
      "strike_count",
      "strikeCount",
      "fair_play_strikes",
      "fairPlayStrikes",
      "strikes",
      "is_frozen",
      "isFrozen",
      "frozen_for_question",
      "frozen_question_id",
      "frozenQuestionId",
      "is_kicked",
      "isKicked",
      "answer_status",
    ].some((key) => source?.[key] !== undefined);

    if (!hasWrappedStatus && !hasStatusFields) {
      return null;
    }

    const eventPlayerId =
      source?.player_id ?? source?.playerId ?? source?.participant_id;

    if (eventPlayerId && eventPlayerId !== playerInfo.player_id) {
      return null;
    }

    const strikeCount = parseOptionalNumber(
      source?.strike_count,
      source?.strikeCount,
      source?.fair_play_strikes,
      source?.fairPlayStrikes,
      source?.strikes,
    );
    const maxStrikes = parseOptionalNumber(
      source?.max_strikes,
      source?.maxStrikes,
      source?.max_fair_play_strikes,
      source?.maxFairPlayStrikes,
      source?.max_cheat_strikes,
      source?.maxCheatStrikes,
    );
    const frozenValue =
      source?.is_frozen ?? source?.isFrozen ?? source?.frozen_for_question;
    const kickedValue = source?.is_kicked ?? source?.isKicked;
    const status: FairPlayStatus = {
      ...source,
      player_id: eventPlayerId ?? playerInfo.player_id,
      frozen_question_id:
        source?.frozen_question_id ??
        source?.frozenQuestionId ??
        source?.question_id,
      message: source?.message,
      reason: source?.reason,
      event_type: payload?.event_type ?? source?.event_type,
    };

    if (strikeCount !== undefined) {
      status.strike_count = strikeCount;
    }

    if (maxStrikes !== undefined) {
      status.max_strikes = maxStrikes;
    }

    if (frozenValue !== undefined) {
      status.is_frozen = Boolean(frozenValue);
    }

    if (kickedValue !== undefined) {
      status.is_kicked = Boolean(kickedValue);
    }

    return status;
  };

  const applyFairPlaySettings = (payload: any) => {
    const settings = normalizeFairPlaySettings(payload);

    if (settings) {
      setFairPlaySettings(settings);
    }
  };

  const applyFairPlayStatus = (payload: any) => {
    const status = normalizeFairPlayStatus(payload);

    if (status) {
      setFairPlayStatus((previous) => ({
        ...(previous ?? {}),
        ...status,
        strike_count:
          status.strike_count ??
          status.strikeCount ??
          previous?.strike_count ??
          previous?.strikeCount,
        max_strikes:
          status.max_strikes ??
          status.maxStrikes ??
          previous?.max_strikes ??
          previous?.maxStrikes ??
          fairPlaySettings.maxStrikes,
      }));
    }
  };

  const reportFairPlayViolation = (
    questionId: string,
    reason: FocusViolationReason,
  ) => {
    gameWebSocket.reportFocusViolation(questionId, reason);
  };

  useEffect(() => {
    const initializeGame = async () => {
      // CRITICAL: Only connect once per component mount
      if (hasAttemptedConnection.current || isCurrentlyConnecting.current) {
        console.warn(
          "[GameContainer] Connection already attempted/in progress, skipping",
        );
        return;
      }

      isCurrentlyConnecting.current = true;
      hasAttemptedConnection.current = true;

      try {
        cleanupRef.current = await connectToGame();
      } finally {
        isCurrentlyConnecting.current = false;
      }
    };

    initializeGame();

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress,
    );

    // Start pulsing animation for lobby
    startPulsingAnimation();

    return () => {
      console.log("[GameContainer] Unmounting - cleaning up connections");
      backHandler.remove();

      // CRITICAL: Always cleanup on unmount
      gameWebSocket.disconnect();

      if (cleanupRef.current) {
        cleanupRef.current();
      }

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      // Reset refs for potential remount
      hasAttemptedConnection.current = false;
      isCurrentlyConnecting.current = false;
      gameStartedRef.current = false;
    };
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (!countdownQuestionStartAt) {
      setCountdownRemainingMs(0);
      return;
    }

    const updateCountdown = () => {
      setCountdownRemainingMs(
        gameWebSocket.getDelayUntilServerTime(countdownQuestionStartAt),
      );
    };

    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 100);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [countdownQuestionStartAt]);

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

      const API = (await APIGame).default;
      const statusResponse = await API.gameSession.getStatus(sessionCode);

      if (statusResponse.isSuccess) {
        if (!statusResponse.result) {
          throw new Error("No session data received");
        }

        const status = statusResponse.result;
        applyFairPlaySettings(status);
        applyFairPlayStatus(status);

        // Determine game type from the session info but don't start the game yet
        const gameType = inferGameType(status);

        if (gameType) {
          setCurrentGameType(gameType);
        }

        // Update game state - detect if game has already started
        const gameState: GameState = {
          session_code: sessionCode,
          game_type: inferGameType(status) || "trivia",
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

        setIsGameStarted(false);
      } else {
        throw new Error(
          statusResponse.message || "Failed to get session status",
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
      applyFairPlaySettings(state);
      applyFairPlayStatus(state);
      const nextGameType = inferGameType(state);

      if (nextGameType && nextGameType !== currentGameType) {
        console.log(
          `Game type changed from ${currentGameType} to ${nextGameType}`,
        );
        setCurrentGameType(nextGameType);
      }
    };

    gameWebSocket.onPhaseChange = (phase: GamePhase, data?: any) => {
      setGamePhase(phase);

      if (phase === "lobby" || phase === "waiting") {
        setIsGameStarted(false);
        setCountdownQuestionStartAt(null);
        return;
      }

      setIsGameStarted(true);

      if (phase !== "countdown") {
        setCountdownQuestionStartAt(null);
      }

      const nextGameType = inferGameType(data);
      if (nextGameType) {
        setCurrentGameType(nextGameType);
      }
    };

    gameWebSocket.onCountdownStarted = (state: CountdownState) => {
      setCountdownQuestionStartAt(state.questionStartAt || null);
    };

    gameWebSocket.onFairPlaySettingsUpdate = (settings: any) => {
      applyFairPlaySettings(settings);
    };

    gameWebSocket.onFairPlayStatusUpdate = (status: any) => {
      applyFairPlayStatus(status);
    };

    gameWebSocket.onKickedFromSession = (status: any) => {
      const kickedStatus =
        normalizeFairPlayStatus({
          ...status,
          is_kicked: true,
          message:
            status?.message ||
            "You have been removed from this session by Fair Play Mode.",
        }) ?? {
          player_id: playerInfo.player_id,
          is_kicked: true,
          strike_count: 0,
          max_strikes: fairPlaySettings.maxStrikes,
          message: "You have been removed from this session by Fair Play Mode.",
        };

      setFairPlayStatus(kickedStatus);
      setConnectionError(null);
    };

    gameWebSocket.onError = (error: string) => {
      setConnectionError(error);
      setIsConnecting(false);
    };
    const fetchQuestionFromAPI = async () => {
      console.log("🔄 Fetching current question from API...");
      try {
        const API = (await APIGame).default;
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
    void fetchQuestionFromAPI;

    gameWebSocket.onGameStarted = (data: any) => {
      console.log(
        "🚀 GAME STARTED EVENT RECEIVED - Intro beginning, waiting for synchronized question reveal",
      );
      console.log("📦 Game started data:", JSON.stringify(data, null, 2));

      // Transition from lobby to game screen
      if (data && data.isstarted === true) {
        applyFairPlaySettings(data);
        applyFairPlayStatus(data);
        console.log("🎮 Game started - Intro beginning");
        console.log("📍 Setting isGameStarted = true");

        gameStartedRef.current = true; // Mark game as started
        setIsGameStarted(true);

        // DO NOT extract or display question here
        // The question will arrive via question_started with start_at timing
        console.log(
          "⏳ Waiting for synchronized question reveal (question_started + start_at)...",
        );
      }

      const nextGameType = inferGameType(data);
      if (nextGameType && nextGameType !== currentGameType) {
        setCurrentGameType(nextGameType);
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
      ],
    );
  };

  const handleLeaveGame = () => {
    console.log("📺 Resetting WebSocket: UI no longer ready for questions");
    gameWebSocket.leaveGame();
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
      const API = (await APIGame).default;
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
          [{ text: "OK" }],
        );

        // The WebSocket sync_state remains the source of truth for phase.
      } else {
        Alert.alert(
          "Error",
          statusResponse.message || "Failed to check status",
        );
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to check game status");
    }
  };

  const fairPlayStrikeCount = Number(
    fairPlayStatus?.strike_count ?? fairPlayStatus?.strikeCount ?? 0,
  );
  const fairPlayMaxStrikes = Number(
    fairPlayStatus?.max_strikes ??
      fairPlayStatus?.maxStrikes ??
      fairPlaySettings.maxStrikes,
  );
  const isKickedByFairPlay = Boolean(
    fairPlayStatus?.is_kicked ?? fairPlayStatus?.isKicked,
  );

  const renderFairPlayNotice = () => {
    if (!fairPlaySettings.enabled) {
      return null;
    }

    return (
      <View style={styles.fairPlayNotice}>
        <MaterialIcons name="verified-user" size={18} color={colors.tea[400]} />
        <Text style={styles.fairPlayNoticeText}>
          Fair Play Mode active
          {fairPlayMaxStrikes > 0
            ? ` - ${fairPlayStrikeCount}/${fairPlayMaxStrikes} strikes`
            : ""}
        </Text>
      </View>
    );
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
            {renderFairPlayNotice()}

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

    if (
      gamePhase === "waiting_for_host_intro" ||
      gamePhase === "intro_audio" ||
      gamePhase === "countdown_pending"
    ) {
      const waitingText =
        gamePhase === "countdown_pending"
          ? "Intro skipped. Get ready..."
          : "The host is explaining the rules...";

      return (
        <View style={styles.centerContainer}>
          <AppCard style={styles.loadingCard}>
            <MaterialIcons name="campaign" size={64} color={colors.tea[500]} />
            <Text style={styles.loadingTitle}>{waitingText}</Text>
            <Text style={styles.sessionInfo}>Session: {sessionCode}</Text>
            {renderFairPlayNotice()}
            <View style={styles.statusIndicator}>
              <Animated.View
                style={[styles.pulsingDot, { opacity: pulseAnimation }]}
              />
              <Text style={styles.statusText}>Waiting for host</Text>
            </View>
          </AppCard>
        </View>
      );
    }

    if (gamePhase === "countdown") {
      const seconds = Math.ceil(countdownRemainingMs / 1000);

      return (
        <View style={styles.centerContainer}>
          <AppCard style={styles.loadingCard}>
            <MaterialIcons name="timer" size={64} color={colors.tea[500]} />
            <Text style={styles.countdownNumber}>{Math.max(0, seconds)}</Text>
            <Text style={styles.loadingTitle}>Get ready...</Text>
            <Text style={styles.sessionInfo}>Session: {sessionCode}</Text>
            {renderFairPlayNotice()}
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
            gamePhase={gamePhase}
            fairPlayEnabled={fairPlaySettings.enabled}
            maxFairPlayStrikes={fairPlaySettings.maxStrikes}
            fairPlayStatus={fairPlayStatus}
            onFairPlayViolation={reportFairPlayViolation}
            onGameEnd={handleGameEnd}
            onError={handleGameError}
          />
        );

      case "buzzer":
        return (
          <BuzzerGame
            sessionCode={sessionCode}
            gamePhase={gamePhase}
            fairPlayEnabled={fairPlaySettings.enabled}
            maxFairPlayStrikes={fairPlaySettings.maxStrikes}
            fairPlayStatus={fairPlayStatus}
            onFairPlayViolation={reportFairPlayViolation}
            onGameEnd={handleGameEnd}
            onError={handleGameError}
          />
        );

      default:
        return (
          <TriviaGame
            sessionCode={sessionCode}
            gamePhase={gamePhase}
            fairPlayEnabled={fairPlaySettings.enabled}
            maxFairPlayStrikes={fairPlaySettings.maxStrikes}
            fairPlayStatus={fairPlayStatus}
            onFairPlayViolation={reportFairPlayViolation}
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

  if (isKickedByFairPlay) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centerContainer}>
          <AppCard style={styles.errorCard}>
            <MaterialIcons name="gpp-bad" size={48} color={colors.red[500]} />
            <Text style={styles.errorTitle}>Removed From Session</Text>
            <Text style={styles.errorText}>
              {fairPlayStatus?.message ||
                "Fair Play Mode removed you from this session."}
            </Text>
            {fairPlaySettings.enabled && (
              <Text style={styles.playerInfo}>
                Strikes: {fairPlayStrikeCount}/{fairPlayMaxStrikes}
              </Text>
            )}
            <View style={styles.actionButtons}>
              <AppButton
                title="Leave Game"
                onPress={handleLeaveGame}
                variant="primary"
                style={styles.actionButton}
              />
            </View>
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
  countdownNumber: {
    ...typography.h1,
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
  fairPlayNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.ink[800],
    borderColor: colors.tea[500],
    borderWidth: 1,
  },
  fairPlayNoticeText: {
    ...typography.body,
    color: colors.stone[300],
    fontWeight: "600",
    textAlign: "center",
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
