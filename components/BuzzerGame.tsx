import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import * as APIGame from "../assets/api/API";
import {
  GameQuestion,
  gameWebSocket,
} from "../assets/api/gameWebSocketService";
import { AppCard } from "../assets/components/AppCard";
import { colors } from "../assets/theme/colors";
import { typography } from "../assets/theme/typography";

interface BuzzerGameProps {
  sessionCode: string;
  onGameEnd: () => void;
  onError: (error: string) => void;
}

interface BuzzerState {
  isActive: boolean;
  winner: string | null;
  canBuzz: boolean;
  canAnswer: boolean;
  playersBuzzed: string[];
  buttonState: "active" | "answer_mode" | "frozen" | "waiting" | "locked";
  statusText: string;
}

export const BuzzerGame: React.FC<BuzzerGameProps> = ({
  sessionCode,
  onGameEnd,
  onError,
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestion | null>(
    null,
  );
  const [buzzerState, setBuzzerState] = useState<BuzzerState>({
    isActive: false,
    winner: null,
    canBuzz: true,
    canAnswer: false,
    playersBuzzed: [],
    buttonState: "waiting",
    statusText: "Waiting for the question...",
  });
  const [answerOptions, setAnswerOptions] = useState<string[]>([]);
  const [answerText, setAnswerText] = useState("");
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [isGameActive, setIsGameActive] = useState(true);
  const [glowIntensity, setGlowIntensity] = useState(0);

  const [scaleAnimation] = useState(() => new Animated.Value(1));
  const [winnerAnimation] = useState(() => new Animated.Value(0));
  const glowIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const winnerAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const fetchCurrentQuestion = async () => {
    try {
      const API = (await APIGame).default;

      const response = await API.gameSession.getCurrentQuestion(sessionCode);

      if (response.isSuccess && response.result) {
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
      }
    } catch (error) {}
  };
  void fetchCurrentQuestion;

  const resetBuzzerState = () => {
    setAnswerOptions([]);
    setAnswerText("");
    setHasSubmittedAnswer(false);
    setBuzzerState({
      isActive: true,
      winner: null,
      canBuzz: true,
      canAnswer: false,
      playersBuzzed: [],
      buttonState: "active",
      statusText: "Tap to buzz in first!",
    });
    stopWinnerAnimation();
  };

  const applyBackendButtonState = (data: any) => {
    const buttonState = (data.button_state ||
      data.buttonState ||
      "waiting") as BuzzerState["buttonState"];
    const isCurrentPlayer = !!(data.is_current_player || data.isCurrentPlayer);

    if (buttonState === "answer_mode" && isCurrentPlayer) {
      applyQuestionAnswerData(data);
      setHasSubmittedAnswer(false);
    }

    setBuzzerState((prev) => ({
      ...prev,
      buttonState,
      winner: data.winner_name || data.winner || prev.winner,
      isActive: buttonState === "active",
      canBuzz: buttonState === "active",
      canAnswer: buttonState === "answer_mode" && isCurrentPlayer,
      statusText: getStatusTextForButtonState(buttonState, data),
    }));

    if (buttonState === "active") {
      startGlowAnimation();
    } else {
      stopGlowAnimation();
    }
  };

  const getStatusTextForButtonState = (
    buttonState: BuzzerState["buttonState"],
    data?: any,
  ) => {
    switch (buttonState) {
      case "active":
        return "Tap to buzz in first!";
      case "answer_mode":
        return data?.is_current_player || data?.isCurrentPlayer
          ? "You buzzed first. Choose your answer."
          : "Another player buzzed first.";
      case "frozen":
        return "You're frozen for this question.";
      case "locked":
        return "Buzzer locked.";
      case "waiting":
      default:
        return "Waiting for the backend...";
    }
  };

  const applyQuestionAnswerData = (data: any) => {
    const options = data.display_options || data.options || [];

    if (data.question_id || data.question) {
      setCurrentQuestion((prev) => ({
        ...(prev ?? {
          game_type: "buzzer",
          ui_mode: data.ui_mode || "buzzer",
          question_id: data.question_id,
          question: data.question,
        }),
        ...data,
        game_type: data.game_type || "buzzer",
        ui_mode: data.ui_mode || prev?.ui_mode || "buzzer",
      }));
    }

    setAnswerOptions(Array.isArray(options) ? options : []);
  };

  const startGlowAnimation = () => {
    if (glowIntervalRef.current) {
      clearInterval(glowIntervalRef.current);
    }

    setGlowIntensity(1);
    glowIntervalRef.current = setInterval(() => {
      setGlowIntensity((current) => (current > 0 ? 0 : 1));
    }, 1000);
  };

  const stopGlowAnimation = () => {
    if (glowIntervalRef.current) {
      clearInterval(glowIntervalRef.current);
      glowIntervalRef.current = null;
    }
    setGlowIntensity(0);
  };

  const stopWinnerAnimation = () => {
    winnerAnimationRef.current?.stop();
    winnerAnimationRef.current = null;
    winnerAnimation.stopAnimation();
    winnerAnimation.setValue(0);
  };

  const startWinnerAnimation = () => {
    stopWinnerAnimation();

    const introAnimation = Animated.timing(winnerAnimation, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    });

    winnerAnimationRef.current = introAnimation;
    introAnimation.start(({ finished }) => {
      if (!finished) {
        return;
      }

      const pulseAnimation = Animated.loop(
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
        ]),
      );

      winnerAnimationRef.current = pulseAnimation;
      pulseAnimation.start();
    });
  };

  const submitBuzzerAnswer = (answer: string) => {
    if (!currentQuestion?.question_id || !answer || hasSubmittedAnswer) {
      return;
    }

    const sent = gameWebSocket.submitAnswer(answer, currentQuestion.question_id);

    if (!sent) {
      onError("Failed to submit answer. Please check your connection.");
      return;
    }

    setHasSubmittedAnswer(true);
    setBuzzerState((prev) => ({
      ...prev,
      buttonState: "locked",
      isActive: false,
      canBuzz: false,
      canAnswer: false,
      statusText: "Answer submitted. Waiting for result...",
    }));
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
      canAnswer: false,
      isActive: false,
      buttonState: "locked",
      statusText: `${winnerName} buzzed first!`,
    }));

    stopGlowAnimation();
    startWinnerAnimation();
  };

  const getBuzzerButtonStyle = () => {
    let buttonStyle = { ...styles.buzzerButton };

    if (buzzerState.winner) {
      buttonStyle = { ...buttonStyle, ...styles.buzzerButtonWinner };
    } else if (buzzerState.buttonState === "frozen") {
      buttonStyle = { ...buttonStyle, ...styles.buzzerButtonFrozen };
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
      shadowOpacity: glowIntensity ? 0.85 : 0.25,
      shadowRadius: glowIntensity ? 20 : 6,
      elevation: glowIntensity ? 20 : 6,
    };
  };

  useEffect(() => {
    gameWebSocket.onQuestionReceived = (question: GameQuestion) => {
      setCurrentQuestion(question);
      resetBuzzerState();
      applyQuestionAnswerData(question);
      if (question.button_state || question.buttonState) {
        applyBackendButtonState(question);
      } else {
        startGlowAnimation();
      }
    };

    gameWebSocket.onBuzzerUpdate = (data: any) => {
      if (data.type === "buzzer_winner") {
        handleBuzzerWinner(data.winner_name);
        Vibration.vibrate(500); // Haptic feedback
      } else if (data.button_state || data.buttonState) {
        applyBackendButtonState(data);
      } else if (data.type === "buzzer_reset") {
        resetBuzzerState();
        startGlowAnimation();
      } else if (data.type === "question_ended") {
        setBuzzerState((prev) => ({
          ...prev,
          isActive: false,
          canBuzz: false,
          canAnswer: false,
          buttonState: "locked",
          statusText: "Waiting for next question...",
        }));
        stopGlowAnimation();
        setTimeout(() => {
          resetBuzzerState();
        }, 3000);
      } else if (data.type === "next_question" && data.question) {
        setCurrentQuestion(data.question);
        resetBuzzerState();
        applyQuestionAnswerData(data.question);
        startGlowAnimation();
      }
    };

    gameWebSocket.onGameEnded = (data: any) => {
      setIsGameActive(false);
      Alert.alert("Game Over!", data.message || "Thanks for playing!", [
        { text: "OK", onPress: onGameEnd },
      ]);
    };

    gameWebSocket.onGameStarted = (data: any) => {
      console.log("Game started; waiting for question_started.", data);
    };

    gameWebSocket.onError = (error: string) => {
      onError(error);
    };

    return () => {
      stopGlowAnimation();
      stopWinnerAnimation();
      scaleAnimation.stopAnimation();
    };
  }, []);

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

        {buzzerState.canAnswer &&
        (answerOptions.length > 0 || currentQuestion?.ui_mode === "text_input") ? (
          <View style={styles.answerContainer}>
            {answerOptions.length > 0 ? (
              answerOptions.map((option, index) => (
                <TouchableOpacity
                  key={`${option}-${index}`}
                  style={[
                    styles.optionButton,
                    hasSubmittedAnswer && styles.optionButtonDisabled,
                  ]}
                  onPress={() => submitBuzzerAnswer(option)}
                  disabled={hasSubmittedAnswer}
                  activeOpacity={0.8}
                >
                  <Text style={styles.optionText}>
                    {String.fromCharCode(65 + index)}. {option}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <>
                <TextInput
                  style={styles.answerInput}
                  value={answerText}
                  onChangeText={setAnswerText}
                  placeholder="Type your answer"
                  placeholderTextColor={colors.stone[400]}
                  editable={!hasSubmittedAnswer}
                />
                <TouchableOpacity
                  style={[
                    styles.submitAnswerButton,
                    (!answerText.trim() || hasSubmittedAnswer) &&
                      styles.optionButtonDisabled,
                  ]}
                  onPress={() => submitBuzzerAnswer(answerText.trim())}
                  disabled={!answerText.trim() || hasSubmittedAnswer}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitAnswerText}>Submit Answer</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
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
                  name={
                    buzzerState.buttonState === "frozen"
                      ? "block"
                      : buzzerState.winner
                        ? "check-circle"
                        : "touch-app"
                  }
                  size={64}
                  color={colors.white}
                />
                <Text style={styles.buzzerButtonText}>
                  {buzzerState.buttonState === "frozen"
                    ? "Frozen"
                    : buzzerState.winner
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
            {buzzerState.statusText}
          </Text>
        </View>
        )}

        <View style={styles.statusContainer}>
          <MaterialIcons name="timer" size={20} color={colors.stone[400]} />
          <Text style={styles.statusText}>
            {buzzerState.isActive
              ? "Buzzer is LIVE!"
              : buzzerState.statusText}
          </Text>
        </View>
      </View>
    </View>
  );
};

const { width } = Dimensions.get("window");
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
  buzzerButtonFrozen: {
    backgroundColor: colors.red[500],
    borderColor: colors.red[600],
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
  answerContainer: {
    flex: 1,
    justifyContent: "center",
    gap: 12,
  },
  optionButton: {
    backgroundColor: colors.ink[800],
    borderColor: colors.tea[500],
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    minHeight: 56,
    justifyContent: "center",
  },
  optionButtonDisabled: {
    opacity: 0.55,
  },
  optionText: {
    ...typography.body,
    color: colors.stone[100],
    fontSize: 16,
    fontWeight: "600",
  },
  answerInput: {
    ...typography.body,
    backgroundColor: colors.ink[800],
    borderColor: colors.ink[700],
    borderWidth: 2,
    borderRadius: 12,
    color: colors.stone[100],
    padding: 16,
    minHeight: 56,
  },
  submitAnswerButton: {
    backgroundColor: colors.tea[500],
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  submitAnswerText: {
    ...typography.body,
    color: colors.ink[900],
    fontWeight: "bold",
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
});

export default BuzzerGame;
