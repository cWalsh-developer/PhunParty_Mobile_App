import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import {
  GameQuestion,
  gameWebSocket,
} from "../../assets/api/gameWebSocketService";
import { AppButton } from "../../assets/components/AppButton";
import { AppCard } from "../../assets/components/AppCard";
import { colors } from "../../assets/theme/colors";
import { typography } from "../../assets/theme/typography";

interface BuzzerGameProps {
  sessionCode: string;
  onGameEnd: () => void;
  onError: (error: string) => void;
}

interface BuzzerState {
  isActive: boolean;
  winner: string | null;
  canBuzz: boolean;
  playersBuzzed: string[];
}

export const BuzzerGame: React.FC<BuzzerGameProps> = ({
  sessionCode,
  onGameEnd,
  onError,
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestion | null>(
    null
  );
  const [buzzerState, setBuzzerState] = useState<BuzzerState>({
    isActive: false,
    winner: null,
    canBuzz: true,
    playersBuzzed: [],
  });
  const [isGameActive, setIsGameActive] = useState(true);

  const [scaleAnimation] = useState(new Animated.Value(1));
  const [glowAnimation] = useState(new Animated.Value(0));
  const [winnerAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    setupWebSocketListeners();
    fetchCurrentQuestion();
    return () => {
      // Cleanup handled by parent component
    };
  }, []);

  const setupWebSocketListeners = () => {
    gameWebSocket.onQuestionReceived = (question: GameQuestion) => {
      console.log("New buzzer question received:", question);
      setCurrentQuestion(question);
      resetBuzzerState();
      startGlowAnimation();
    };

    gameWebSocket.onBuzzerUpdate = (data: any) => {
      console.log("Buzzer update received:", data);

      if (data.type === "buzzer_winner") {
        handleBuzzerWinner(data.winner_name);
        Vibration.vibrate(500); // Haptic feedback
      } else if (data.type === "buzzer_reset") {
        resetBuzzerState();
        startGlowAnimation();
      } else if (data.type === "question_ended") {
        setBuzzerState((prev) => ({
          ...prev,
          isActive: false,
          canBuzz: false,
        }));
        stopGlowAnimation();
        setTimeout(() => {
          resetBuzzerState();
          fetchCurrentQuestion(); // Fetch next question after current one ends
        }, 3000);
      } else if (data.type === "next_question" && data.question) {
        console.log("Next buzzer question:", data.question);
        setCurrentQuestion(data.question);
        resetBuzzerState();
        startGlowAnimation();
      }
    };

    gameWebSocket.onGameEnded = (data: any) => {
      console.log("Game ended:", data);
      setIsGameActive(false);
      Alert.alert("Game Over!", data.message || "Thanks for playing!", [
        { text: "OK", onPress: onGameEnd },
      ]);
    };

    // Handle when the game starts - fetch the first question
    gameWebSocket.onGameStarted = (data: any) => {
      console.log("Game started in BuzzerGame:", data);
      fetchCurrentQuestion(); // Now fetch the first question
    };

    gameWebSocket.onError = (error: string) => {
      console.error("Game error:", error);
      onError(error);
    };
  };

  const fetchCurrentQuestion = async () => {
    try {
      console.log("Fetching current question for buzzer game:", sessionCode);
      const API = (await import("../../assets/api/API")).default;
      const response = await API.gameSession.getCurrentQuestion(sessionCode);

      if (response.isSuccess && response.result) {
        console.log("Current buzzer question fetched:", response.result);

        const questionData = response.result;
        const question: GameQuestion = {
          question_id: questionData.question_id,
          question: questionData.question,
          game_type: "buzzer",
          ui_mode: "buzzer",
        };

        setCurrentQuestion(question);
        resetBuzzerState();
        startGlowAnimation();
      } else {
        console.log("No current question available for buzzer game");
      }
    } catch (error) {
      console.error("Error fetching current buzzer question:", error);
    }
  };

  const resetBuzzerState = () => {
    setBuzzerState({
      isActive: true,
      winner: null,
      canBuzz: true,
      playersBuzzed: [],
    });
    winnerAnimation.setValue(0);
  };

  const startGlowAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  };

  const stopGlowAnimation = () => {
    glowAnimation.stopAnimation();
    glowAnimation.setValue(0);
  };

  const handleBuzzerPress = () => {
    if (!buzzerState.canBuzz || !buzzerState.isActive || !isGameActive) return;

    // Immediate visual feedback
    setBuzzerState((prev) => ({ ...prev, canBuzz: false }));
    animateBuzzerPress();

    // Send to server
    const success = gameWebSocket.pressBuzzer();
    if (!success) {
      setBuzzerState((prev) => ({ ...prev, canBuzz: true }));
      onError("Failed to register buzzer press. Please check your connection.");
    }
  };

  const animateBuzzerPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBuzzerWinner = (winnerName: string) => {
    setBuzzerState((prev) => ({
      ...prev,
      winner: winnerName,
      canBuzz: false,
      isActive: false,
    }));

    stopGlowAnimation();

    // Winner celebration animation
    Animated.sequence([
      Animated.timing(winnerAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(winnerAnimation, {
            toValue: 0.8,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(winnerAnimation, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();
  };

  const getBuzzerButtonStyle = () => {
    let buttonStyle = { ...styles.buzzerButton };

    if (buzzerState.winner) {
      buttonStyle = { ...buttonStyle, ...styles.buzzerButtonWinner };
    } else if (!buzzerState.canBuzz) {
      buttonStyle = { ...buttonStyle, ...styles.buzzerButtonPressed };
    } else if (buzzerState.isActive) {
      buttonStyle = { ...buttonStyle, ...styles.buzzerButtonActive };
    } else {
      buttonStyle = { ...buttonStyle, ...styles.buzzerButtonInactive };
    }

    return buttonStyle;
  };

  const getBuzzerGlowStyle = () => {
    if (!buzzerState.isActive || buzzerState.winner) return {};

    return {
      shadowColor: colors.tea[500],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: glowAnimation,
      shadowRadius: glowAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 20],
      }),
      elevation: glowAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 20],
      }),
    };
  };

  if (!currentQuestion) {
    return (
      <View style={styles.container}>
        <AppCard style={styles.waitingCard}>
          <MaterialIcons
            name="sports-esports"
            size={48}
            color={colors.tea[500]}
          />
          <Text style={styles.waitingText}>Get ready to buzz in!</Text>
          <Text style={styles.sessionCode}>Session: {sessionCode}</Text>

          <View style={styles.actionButtons}>
            <AppButton
              title="Refresh Question"
              onPress={fetchCurrentQuestion}
              variant="secondary"
              style={styles.actionButton}
            />
          </View>
        </AppCard>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.gameContent}>
        <AppCard style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
        </AppCard>

        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Question ID: {currentQuestion.question_id}
          </Text>
          <Text style={styles.debugText}>
            Buzzer Active: {buzzerState.isActive ? "Yes" : "No"} | Can Buzz:{" "}
            {buzzerState.canBuzz ? "Yes" : "No"}
          </Text>
        </View>

        {buzzerState.winner && (
          <Animated.View
            style={[
              styles.winnerCard,
              {
                opacity: winnerAnimation,
                transform: [{ scale: winnerAnimation }],
              },
            ]}
          >
            <AppCard style={styles.winnerCardContent}>
              <MaterialIcons
                name="emoji-events"
                size={48}
                color={colors.peach[500]}
              />
              <Text style={styles.winnerText}>
                {buzzerState.winner} buzzed first!
              </Text>
            </AppCard>
          </Animated.View>
        )}

        <View style={styles.buzzerContainer}>
          <Animated.View
            style={[
              getBuzzerGlowStyle(),
              { transform: [{ scale: scaleAnimation }] },
            ]}
          >
            <TouchableOpacity
              style={getBuzzerButtonStyle()}
              onPress={handleBuzzerPress}
              disabled={!buzzerState.canBuzz || !buzzerState.isActive}
              activeOpacity={0.8}
            >
              <View style={styles.buzzerButtonContent}>
                <MaterialIcons
                  name={buzzerState.winner ? "check-circle" : "touch-app"}
                  size={64}
                  color={colors.white}
                />
                <Text style={styles.buzzerButtonText}>
                  {buzzerState.winner
                    ? "Winner!"
                    : !buzzerState.canBuzz && !buzzerState.winner
                    ? "Buzzed!"
                    : buzzerState.isActive
                    ? "BUZZ!"
                    : "Wait..."}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.instructionText}>
            {buzzerState.isActive && buzzerState.canBuzz
              ? "Tap to buzz in first!"
              : buzzerState.winner
              ? `${buzzerState.winner} got it!`
              : !buzzerState.canBuzz
              ? "You buzzed! Waiting for results..."
              : "Get ready..."}
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <MaterialIcons name="timer" size={20} color={colors.stone[400]} />
          <Text style={styles.statusText}>
            {buzzerState.isActive
              ? "Buzzer is LIVE!"
              : "Waiting for next question..."}
          </Text>
        </View>
      </View>
    </View>
  );
};

const { width, height } = Dimensions.get("window");
const buzzerSize = Math.min(width * 0.6, 250);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink[900],
    padding: 16,
  },
  waitingCard: {
    alignItems: "center",
    padding: 32,
    marginTop: 100,
  },
  waitingText: {
    ...typography.h3,
    color: colors.stone[100],
    marginTop: 16,
    textAlign: "center",
  },
  sessionCode: {
    ...typography.body,
    color: colors.stone[400],
    marginTop: 8,
  },
  gameContent: {
    flex: 1,
  },
  questionCard: {
    padding: 24,
    marginBottom: 24,
  },
  questionText: {
    ...typography.h2,
    color: colors.stone[100],
    textAlign: "center",
    lineHeight: 28,
  },
  winnerCard: {
    marginBottom: 20,
  },
  winnerCardContent: {
    alignItems: "center",
    padding: 20,
    backgroundColor: colors.peach[500] + "20",
    borderColor: colors.peach[500],
    borderWidth: 2,
  },
  winnerText: {
    ...typography.h3,
    color: colors.peach[500],
    marginTop: 12,
    textAlign: "center",
    fontWeight: "bold",
  },
  buzzerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  buzzerButton: {
    width: buzzerSize,
    height: buzzerSize,
    borderRadius: buzzerSize / 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 4,
    borderColor: colors.ink[700],
  },
  buzzerButtonActive: {
    backgroundColor: colors.tea[500],
    borderColor: colors.tea[300],
  },
  buzzerButtonPressed: {
    backgroundColor: colors.stone[400],
    borderColor: colors.stone[300],
  },
  buzzerButtonWinner: {
    backgroundColor: colors.peach[500],
    borderColor: colors.peach[300],
  },
  buzzerButtonInactive: {
    backgroundColor: colors.ink[800],
    borderColor: colors.ink[700],
  },
  buzzerButtonContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  buzzerButtonText: {
    ...typography.h2,
    color: colors.white,
    fontWeight: "bold",
    marginTop: 8,
    textAlign: "center",
  },
  instructionText: {
    ...typography.body,
    color: colors.stone[300],
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    marginTop: 20,
  },
  statusText: {
    ...typography.body,
    color: colors.stone[400],
    marginLeft: 12,
    textAlign: "center",
    fontSize: 16,
  },
  actionButtons: {
    marginTop: 24,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  debugInfo: {
    backgroundColor: colors.ink[800],
    padding: 12,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ink[700],
  },
  debugText: {
    ...typography.caption,
    color: colors.stone[400],
    fontSize: 12,
    textAlign: "center",
  },
});

export default BuzzerGame;
