import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as APIGame from "../assets/api/API";
import {
  FairPlayStatus,
  FocusViolationReason,
  GamePhase,
  GameQuestion,
  gameWebSocket,
} from "../assets/api/gameWebSocketService";
import { AppButton } from "../assets/components/AppButton";
import { AppCard } from "../assets/components/AppCard";
import { useFairPlayMonitor } from "../assets/hooks/useFairPlayMonitor";
import { colors } from "../assets/theme/colors";
import { typography } from "../assets/theme/typography";

interface TriviaGameProps {
  sessionCode: string;
  gamePhase?: GamePhase;
  fairPlayEnabled?: boolean;
  maxFairPlayStrikes?: number;
  fairPlayStatus?: FairPlayStatus | null;
  onFairPlayViolation?: (
    questionId: string,
    reason: FocusViolationReason,
  ) => void;
  onGameEnd: () => void;
  onError: (message: string) => void;
  onAnswerSubmitted?: () => void;
}

interface Answer {
  option: string;
  isCorrect?: boolean;
  isSelected: boolean;
}

interface GameState {
  currentQuestion: GameQuestion | null;
  answers: Answer[];
}

export const TriviaGame: React.FC<TriviaGameProps> = ({
  sessionCode,
  gamePhase = "question",
  fairPlayEnabled = false,
  maxFairPlayStrikes = 3,
  fairPlayStatus,
  onFairPlayViolation,
  onGameEnd,
  onError,
  onAnswerSubmitted,
}) => {
  // Use single atomic state for question + answers to prevent race conditions
  const [gameState, setGameState] = useState<GameState>({
    currentQuestion: null,
    answers: [],
  });

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isGameActive, setIsGameActive] = useState(true);

  const [pulseAnimation] = useState(new Animated.Value(1));
  const [fadeAnimation] = useState(new Animated.Value(0));
  const revealTimeoutRef = useRef<any>(null);
  const currentQuestionRef = useRef<GameQuestion | null>(null);

  // Derived values for backward compatibility
  const currentQuestion = gameState.currentQuestion;
  const answers = gameState.answers;

  // Track question ID to detect actual question changes (not just state updates)
  const currentQuestionId = gameState.currentQuestion?.question_id;
  const fairPlayStrikeCount = Number(
    fairPlayStatus?.strike_count ?? fairPlayStatus?.strikeCount ?? 0,
  );
  const fairPlayMaxStrikes = Number(
    fairPlayStatus?.max_strikes ??
      fairPlayStatus?.maxStrikes ??
      maxFairPlayStrikes,
  );
  const fairPlayFrozenQuestionId =
    fairPlayStatus?.frozen_question_id ?? fairPlayStatus?.frozenQuestionId;
  const isFrozenByFairPlay = Boolean(
    fairPlayStatus?.is_frozen ?? fairPlayStatus?.isFrozen,
  );
  const isKickedByFairPlay = Boolean(
    fairPlayStatus?.is_kicked ?? fairPlayStatus?.isKicked,
  );
  const isFairPlayLocked =
    isKickedByFairPlay ||
    (isFrozenByFairPlay &&
      (!fairPlayFrozenQuestionId ||
        fairPlayFrozenQuestionId === currentQuestionId));

  const handleFairPlayViolation = useCallback(
    (questionId: string, reason: FocusViolationReason) => {
      onFairPlayViolation?.(questionId, reason);
    },
    [onFairPlayViolation],
  );

  useFairPlayMonitor({
    enabled: fairPlayEnabled,
    questionId: currentQuestionId,
    phase: gamePhase,
    onViolation: handleFairPlayViolation,
  });

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  useEffect(() => {
    if (!isFairPlayLocked) {
      return;
    }

    setHasSubmitted(false);
    setShowResults(false);
  }, [isFairPlayLocked, currentQuestionId]);

  useEffect(() => {
    setupWebSocketListeners();

    // Don't auto-fetch - wait for question_started event from backend
    // This ensures we respect the intro timing

    // Periodic debug logging (every 10 seconds for troubleshooting)
    const debugInterval = setInterval(() => {
      if (!currentQuestion) {
        console.log("[DEBUG] Still waiting for question:", {
          wsState: gameWebSocket.getConnectionState(),
          isGameActive,
        });
      }
    }, 10000);

    return () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
      clearInterval(debugInterval);
      // Cleanup handled by parent component
    };
  }, []);

  useEffect(() => {
    console.log("📌 TriviaGame question ID changed:", {
      hasQuestion: !!gameState.currentQuestion,
      question_id: currentQuestionId,
      question_text: gameState.currentQuestion?.question?.substring(0, 50),
      has_display_options: !!gameState.currentQuestion?.display_options,
      options_count: gameState.currentQuestion?.display_options?.length,
      answers_count: gameState.answers.length,
      state_synced: gameState.currentQuestion
        ? gameState.answers.length > 0
        : true,
    });

    if (gameState.currentQuestion && currentQuestionId) {
      resetForNewQuestion();
      animateQuestionEntry();
    }
  }, [currentQuestionId]); // Only reset when question ID changes

  const setupWebSocketListeners = () => {
    gameWebSocket.onQuestionReceived = (question: GameQuestion) => {
      const receiveTime = Date.now();
      console.log(
        "🎯 TriviaGame - Question received at",
        new Date(receiveTime).toISOString(),
        {
          hasQuestionId: !!question.question_id,
          hasQuestion: !!question.question,
          ui_mode: question.ui_mode,
          hasOptions: !!question.options,
          hasDisplayOptions: !!question.display_options,
          hasStartAt: !!question.start_at,
          questionText: question.question?.substring(0, 50) + "...",
          display_options: question.display_options,
          correct_index: question.correct_index,
          start_at: question.start_at,
        },
      );

      // Log what questionOptions will be
      const questionsOptions = question.display_options;
      console.log("🔍 questionOptions extracted:", {
        questionsOptions,
        isArray: Array.isArray(questionsOptions),
        length: questionsOptions?.length,
        type: typeof questionsOptions,
      });

      // If this is an empty event (WebSocket notification without data)
      if (!question.question_id || !question.question) {
        console.log(
          "⚡ Empty WebSocket event - fetching current question immediately",
        );
        return;
      }

      // Valid question received via WebSocket
      console.log(
        `✅ Processing backend ui_mode: ${question.ui_mode || "multiple_choice"}`,
      );

      // Use display_options (randomized) - no fallback to old options format
      const questionOptions = question.display_options;
      console.log("🐛 DEBUG - WebSocket question options:", {
        display_options: question.display_options,
        options_count: questionOptions?.length,
      });

      if (questionOptions && questionOptions.length > 0) {
        const answerOptions = questionOptions.map((option) => ({
          option,
          isSelected: false,
        }));

        // Check if question has synchronized start time
        const startAt = question.start_at;

        if (startAt) {
          // Parse server timestamp and apply clock offset
          const now = Date.now();
          const delay = gameWebSocket.getDelayUntilServerTime(startAt);

          console.log(`⏰ Question has start_at - delay: ${delay}ms`);
          console.log(`   Server start_at: ${startAt}`);
          console.log(`   Clock offset: ${gameWebSocket.getClockOffset()}ms`);
          console.log(`   Current time: ${new Date(now).toISOString()}`);
          console.log(`   Time until display: ${delay}ms`);

          // If delay is very small (< 100ms) or negative, display immediately
          if (delay < 100) {
            console.log("⚡ Delay too small - displaying immediately instead");
            setGameState({
              currentQuestion: question,
              answers: answerOptions,
            });
            console.log(
              `✅ Atomic state update complete - ${answerOptions.length} MCQ options set`,
            );
          } else {
            // Schedule display at synchronized time
            console.log(`⏱️ Scheduling display in ${delay}ms`);
            if (revealTimeoutRef.current) {
              clearTimeout(revealTimeoutRef.current);
            }

            revealTimeoutRef.current = setTimeout(() => {
              revealTimeoutRef.current = null;
              console.log("✅ Synchronized reveal - displaying question NOW");
              console.log("🔧 Setting question and answers atomically:", {
                question_id: question.question_id,
                question_text: question.question?.substring(0, 50),
                answers_count: answerOptions.length,
              });

              setGameState({
                currentQuestion: question,
                answers: answerOptions,
              });

              console.log(
                `✅ Atomic state update complete - ${answerOptions.length} MCQ options set`,
              );
            }, delay);
          }
        } else {
          // No start_at - display immediately (fallback for late joiners or legacy)
          console.log(
            "⚡ No start_at - displaying immediately (fallback mode)",
          );
          console.log("🔧 Setting question and answers atomically:", {
            question_id: question.question_id,
            question_text: question.question?.substring(0, 50),
            answers_count: answerOptions.length,
          });

          setGameState({
            currentQuestion: question,
            answers: answerOptions,
          });

          console.log(
            `✅ Atomic state update complete - ${answerOptions.length} MCQ options set`,
          );
        }
      } else {
        console.log(
          "⚠️ No valid options received from WebSocket - clearing state",
        );
        setGameState({
          currentQuestion: question,
          answers: [],
        });
      }
    };

    gameWebSocket.onGameStarted = (data: any) => {
      console.log("Game started; waiting for question_started.", data);
    };

    gameWebSocket.onAnswerSubmitted = (data: any) => {
      console.log("✅ Answer submission result:", {
        is_correct: data.is_correct,
        correct_answer: data.correct_answer,
        answer_match: data.answer_match,
        has_is_correct: data.is_correct !== undefined,
        event_type: data.event_type,
        player_id: data.player_id,
        my_player_id: gameWebSocket.playerInfo?.player_id,
        is_my_answer: data.player_id === gameWebSocket.playerInfo?.player_id,
        full_data: data,
      });

      // CRITICAL: Only update results if this is MY answer submission
      // Other players' submissions shouldn't affect my screen
      const isMyAnswer =
        data.player_id === gameWebSocket.playerInfo?.player_id ||
        data.is_current_player === true ||
        data.event_type === "answer_submitted";

      if (
        isMyAnswer &&
        data.is_correct !== undefined
      ) {
        if (isTextInputResult(data)) {
          console.log(
            "📊 Text input answer result received - keeping mobile in waiting state",
          );
          setShowResults(false);
          return;
        }

        console.log("📊 This is MY answer result - updating display");
        updateAnswerResults(data);
      } else if (!isMyAnswer) {
        console.log("👥 Another player's answer - ignoring (not my result)");
      } else {
        console.log("⚠️ Answer event without is_correct flag - ignoring");
      }
    };

    gameWebSocket.onAnswerRejected = (data: any) => {
      if (data.reason === "fair_play_restriction") {
        setHasSubmitted(false);
        setShowResults(false);
        return;
      }

      setHasSubmitted(false);
      onError(data.message || "Your answer was rejected.");
    };

    gameWebSocket.onBuzzerUpdate = (data: any) => {
      if (
        data.type === "correct_answer" &&
        data.correct_option &&
        !isTextInputResult(data)
      ) {
        showCorrectAnswer(data.correct_option);
      } else if (data.type === "question_ended") {
        if (isTextInputResult(data)) {
          setShowResults(false);
          return;
        }

        setShowResults(true);
        setTimeout(() => {
          resetForNewQuestion();
        }, 3000);
      }
    };

    gameWebSocket.onGameEnded = (data: any) => {
      setIsGameActive(false);
      Alert.alert("Game Over!", data.message || "Thanks for playing!", [
        { text: "OK", onPress: onGameEnd },
      ]);
    };

    gameWebSocket.onError = (error: string) => {
      onError(error);
    };
  };

  const fetchCurrentQuestionNow = async () => {
    try {
      const API = (await APIGame).default;

      const response = await API.gameSession.getCurrentQuestion(sessionCode);

      if (response.isSuccess && response.result) {
        const questionData = response.result;

        console.log("🐛 DEBUG - Question data received from API:", {
          question_id: questionData.question_id,
          question: questionData.question,
          ui_mode: questionData.ui_mode,
          display_options: questionData.display_options,
          correct_index: questionData.correct_index,
          answer: questionData.answer,
          raw_response: questionData,
        });

        const question: GameQuestion = {
          question_id: questionData.question_id,
          question: questionData.question || "Loading question...",
          game_type: "trivia",
          ui_mode: questionData.ui_mode || "multiple_choice", // Use backend ui_mode
          display_options: questionData.display_options,
          accepted_answers: questionData.accepted_answers,
          correct_index: questionData.correct_index,
          correct_answer: questionData.correct_answer,
          answer: questionData.answer,
          difficulty: questionData.difficulty,
        };

        console.log(
          `✅ API returned ${question.ui_mode} question with ${
            question.display_options?.length || 0
          } options`,
        );

        const answerOptions = (question.display_options || []).map(
          (option) => ({
            option,
            isSelected: false,
          }),
        );

        console.log("🐛 DEBUG - Answer options created:", {
          source: question.display_options ? "display_options" : "empty",
          options_count: answerOptions.length,
          options: answerOptions.map((a) => a.option),
        });

        // ATOMIC UPDATE: Set both question AND answers together
        console.log("🔧 API fetch: Setting question and answers atomically");
        setGameState({
          currentQuestion: question,
          answers: answerOptions,
        });
        console.log("✅ API fetch: Atomic state update complete");
      } else {
      }
    } catch (error) {}
  };

  const fetchInitialQuestion = async () => {
    try {
      const API = (await APIGame).default;

      // First check if game is already active
      const statusResponse = await API.gameSession.getStatus(sessionCode);
      if (statusResponse.isSuccess) {
        const status = statusResponse.result;
        console.log("📊 Game status:", {
          is_active: status.is_active,
          has_question: !!status.current_question,
          ui_mode: status.current_question?.ui_mode,
          current_question_data: status.current_question,
        });

        // If game is active and has a question, use it
        if (status.is_active && status.current_question) {
          const question: GameQuestion = {
            question_id:
              status.current_question.question_id || Date.now().toString(),
            question: status.current_question.question || "Loading question...",
            game_type: "trivia",
            ui_mode: status.current_question.ui_mode || "multiple_choice", // Use backend ui_mode
            display_options: status.current_question.display_options,
            accepted_answers: status.current_question.accepted_answers,
            correct_index: status.current_question.correct_index,
            correct_answer: status.current_question.correct_answer,
            answer: status.current_question.answer,
            difficulty: status.current_question.difficulty,
          };

          console.log(
            `✅ Status API returned ${question.ui_mode} question with ${
              question.display_options?.length || 0
            } options`,
          );

          const answerOptions = (question.display_options || []).map(
            (option) => ({
              option,
              isSelected: false,
            }),
          );

          // ATOMIC UPDATE: Set both question AND answers together
          console.log("🔧 Status API: Setting question and answers atomically");
          setGameState({
            currentQuestion: question,
            answers: answerOptions,
          });
          console.log("✅ Status API: Atomic state update complete");

          return;
        }
      }

      // Try to start the game if not active
      try {
        await API.put(`/game-logic/start-game/${sessionCode}`);
      } catch (startError) {}

      // Get current question after starting
      await fetchCurrentQuestionNow();
    } catch (error) {}
  };
  void fetchInitialQuestion;

  const resetForNewQuestion = () => {
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
    setSelectedAnswer(null);
    setHasSubmitted(false);
    setShowResults(false);
    setTimeLeft(0);
    fadeAnimation.setValue(0);
  };

  const animateQuestionEntry = () => {
    Animated.sequence([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateSelection = () => {
    Animated.sequence([
      Animated.timing(pulseAnimation, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const selectAnswer = (option: string) => {
    if (hasSubmitted || !isGameActive || isFairPlayLocked) return;

    animateSelection();
    setSelectedAnswer(option);

    const updatedAnswers = answers.map((answer) => ({
      ...answer,
      isSelected: answer.option === option,
    }));

    // Update answers in gameState
    setGameState((prev) => ({
      ...prev,
      answers: updatedAnswers,
    }));
  };

  const isTextInputResult = (data?: any) => {
    return (
      data?.ui_mode === "text_input" ||
      data?.uiMode === "text_input" ||
      currentQuestionRef.current?.ui_mode === "text_input"
    );
  };

  const submitAnswer = async () => {
    const answerToSubmit = selectedAnswer?.trim();
    if (!answerToSubmit || !currentQuestion || hasSubmitted || isFairPlayLocked)
      return;

    setHasSubmitted(true);
    console.log("🎯 Submitting answer:", {
      answer: answerToSubmit,
      question_id: currentQuestion.question_id,
      session_code: sessionCode,
    });

    // Try WebSocket first
    const wsSuccess = gameWebSocket.submitAnswer(
      answerToSubmit,
      currentQuestion.question_id,
    );

    if (!wsSuccess) {
      try {
        // Fallback to API submission
        const apiResult = await gameWebSocket.submitAnswerViaAPI(
          currentQuestion.question_id,
          answerToSubmit,
        );

        if (!apiResult?.isSuccess) {
          setHasSubmitted(false);
          onError("Failed to submit answer. Please check your connection.");
          return;
        }
      } catch (error) {
        setHasSubmitted(false);
        onError("Failed to submit answer. Please check your connection.");
        return;
      }
    }

    // Notify parent that answer was submitted - show waiting screen
    onAnswerSubmitted?.();
  };

  const updateAnswerResults = (data: any) => {
    if (isTextInputResult(data)) {
      setShowResults(false);
      return;
    }

    const updatedAnswers = answers.map((answer, index) => {
      // Use correct_index from backend if available, otherwise fall back to answer comparison
      const isCorrect =
        currentQuestion?.correct_index !== undefined
          ? index === currentQuestion.correct_index
          : answer.option === data.correct_answer;

      return {
        ...answer,
        isCorrect,
      };
    });

    setGameState((prev) => ({
      ...prev,
      answers: updatedAnswers,
    }));
    setShowResults(true);
  };

  const showCorrectAnswer = (correctOption: string) => {
    if (isTextInputResult()) {
      setShowResults(false);
      return;
    }

    const updatedAnswers = answers.map((answer, index) => {
      // Use correct_index from backend if available, otherwise fall back to option comparison
      const isCorrect =
        currentQuestion?.correct_index !== undefined
          ? index === currentQuestion.correct_index
          : answer.option === correctOption;

      return {
        ...answer,
        isCorrect,
      };
    });

    setGameState((prev) => ({
      ...prev,
      answers: updatedAnswers,
    }));
    setShowResults(true);
  };

  const getAnswerButtonStyle = (answer: Answer) => {
    let buttonStyle = { ...styles.answerButton };

    if (showResults) {
      if (answer.isCorrect) {
        buttonStyle = { ...buttonStyle, ...styles.correctAnswer };
      } else if (answer.isSelected && !answer.isCorrect) {
        buttonStyle = { ...buttonStyle, ...styles.incorrectAnswer };
      } else {
        buttonStyle = { ...buttonStyle, ...styles.neutralAnswer };
      }
    } else if (answer.isSelected) {
      buttonStyle = { ...buttonStyle, ...styles.selectedAnswer };
    }

    return buttonStyle;
  };

  const getAnswerTextStyle = (answer: Answer) => {
    let textStyle = { ...styles.answerText };

    if (showResults) {
      if (answer.isCorrect) {
        textStyle = { ...textStyle, ...styles.correctAnswerText };
      } else if (answer.isSelected && !answer.isCorrect) {
        textStyle = { ...textStyle, ...styles.incorrectAnswerText };
      }
    } else if (answer.isSelected) {
      textStyle = { ...textStyle, ...styles.selectedAnswerText };
    }

    return textStyle;
  };

  const renderFairPlayStatus = () => {
    if (!fairPlayEnabled) {
      return null;
    }

    const isLocked = isFairPlayLocked;

    return (
      <View
        style={[
          styles.fairPlayBanner,
          isLocked && styles.fairPlayBannerWarning,
        ]}
      >
        <MaterialIcons
          name={isLocked ? "block" : "verified-user"}
          size={20}
          color={isLocked ? colors.red[500] : colors.tea[400]}
        />
        <Text
          style={[
            styles.fairPlayText,
            isLocked && styles.fairPlayTextWarning,
          ]}
        >
          {isLocked
            ? fairPlayStatus?.message ||
              `Fair Play strike ${fairPlayStrikeCount}/${fairPlayMaxStrikes}. You are frozen for this question.`
            : `Fair Play Mode active - ${fairPlayStrikeCount}/${fairPlayMaxStrikes} strikes`}
        </Text>
      </View>
    );
  };

  if (!currentQuestion) {
    return (
      <View style={styles.container}>
        <AppCard style={styles.waitingCard}>
          <MaterialIcons
            name="hourglass-empty"
            size={48}
            color={colors.tea[500]}
          />
          <Text style={styles.waitingText}>Waiting for next question...</Text>
          <Text style={styles.sessionCode}>Session: {sessionCode}</Text>
        </AppCard>
      </View>
    );
  }

  const isTextInputQuestion = currentQuestion.ui_mode === "text_input";
  const typedAnswer = selectedAnswer ?? "";

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.gameContent, { opacity: fadeAnimation }]}>
        <AppCard style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
          {timeLeft > 0 && (
            <View style={styles.timerContainer}>
              <MaterialIcons name="timer" size={20} color={colors.stone[400]} />
              <Text style={styles.timerText}>{timeLeft}s</Text>
            </View>
          )}
        </AppCard>
        {renderFairPlayStatus()}

        {isTextInputQuestion ? (
          <View style={styles.textAnswerContainer}>
            <TextInput
              style={styles.textAnswerInput}
              value={typedAnswer}
              onChangeText={setSelectedAnswer}
              placeholder="Type your answer"
              placeholderTextColor={colors.stone[400]}
              editable={!hasSubmitted && !isFairPlayLocked}
              autoCapitalize="none"
              autoCorrect
              returnKeyType="done"
              onSubmitEditing={submitAnswer}
            />

          </View>
        ) : (
          <View style={styles.answersContainer}>
            {answers.map((answer, index) => (
              <Animated.View
                key={index}
                style={{ transform: [{ scale: pulseAnimation }] }}
              >
                <TouchableOpacity
                  style={[
                    getAnswerButtonStyle(answer),
                    isFairPlayLocked && styles.answerButtonDisabled,
                  ]}
                  onPress={() => selectAnswer(answer.option)}
                  disabled={hasSubmitted || showResults || isFairPlayLocked}
                  activeOpacity={0.8}
                >
                  <Text style={getAnswerTextStyle(answer)}>
                    {String.fromCharCode(65 + index)}. {answer.option}
                  </Text>
                  {showResults && answer.isCorrect && (
                    <MaterialIcons
                      name="check-circle"
                      size={24}
                      color={colors.tea[500]}
                    />
                  )}
                  {showResults && answer.isSelected && !answer.isCorrect && (
                    <MaterialIcons
                      name="cancel"
                      size={24}
                      color={colors.red[500]}
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}

        {selectedAnswer?.trim() &&
          !hasSubmitted &&
          !showResults &&
          !isFairPlayLocked && (
          <View style={styles.submitContainer}>
            <AppButton
              title="Submit Answer"
              onPress={submitAnswer}
              variant="primary"
              style={styles.submitButton}
            />
          </View>
        )}

        {hasSubmitted && !showResults && (
          <View style={styles.statusContainer}>
            <MaterialIcons name="send" size={24} color={colors.tea[500]} />
            <Text style={styles.statusText}>
              Answer submitted! Waiting for results...
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const { width } = Dimensions.get("window");

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
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  timerText: {
    ...typography.body,
    color: colors.stone[400],
    marginLeft: 8,
    fontWeight: "bold",
  },
  answersContainer: {
    flex: 1,
  },
  textAnswerContainer: {
    flex: 1,
    gap: 16,
  },
  textAnswerInput: {
    ...typography.body,
    backgroundColor: colors.ink[800],
    borderColor: colors.ink[700],
    borderWidth: 2,
    borderRadius: 12,
    color: colors.stone[100],
    fontSize: 18,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textResultCard: {
    backgroundColor: colors.ink[800],
    borderColor: colors.ink[700],
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  textResultContent: {
    flex: 1,
  },
  textResultTitle: {
    ...typography.h3,
    marginBottom: 4,
  },
  textResultDetail: {
    ...typography.body,
    color: colors.stone[300],
    marginTop: 4,
  },
  answerButton: {
    backgroundColor: colors.ink[800],
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink[700],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 60,
  },
  answerButtonDisabled: {
    opacity: 0.55,
  },
  selectedAnswer: {
    backgroundColor: colors.tea[500] + "20",
    borderColor: colors.tea[500],
  },
  correctAnswer: {
    backgroundColor: colors.tea[500] + "20",
    borderColor: colors.tea[500],
  },
  incorrectAnswer: {
    backgroundColor: colors.red[500] + "20",
    borderColor: colors.red[500],
  },
  neutralAnswer: {
    opacity: 0.6,
  },
  answerText: {
    ...typography.body,
    color: colors.stone[100],
    flex: 1,
    fontSize: 16,
  },
  selectedAnswerText: {
    color: colors.tea[500],
    fontWeight: "bold",
  },
  correctAnswerText: {
    color: colors.tea[500],
    fontWeight: "bold",
  },
  incorrectAnswerText: {
    color: colors.red[500],
    fontWeight: "bold",
  },
  fairPlayBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.ink[800],
    borderColor: colors.tea[500],
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  fairPlayBannerWarning: {
    borderColor: colors.red[500],
    backgroundColor: colors.red[500] + "14",
  },
  fairPlayText: {
    ...typography.body,
    color: colors.stone[300],
    flex: 1,
    fontWeight: "600",
  },
  fairPlayTextWarning: {
    color: colors.stone[100],
  },
  submitContainer: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  submitButton: {
    paddingVertical: 16,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  statusText: {
    ...typography.body,
    color: colors.stone[400],
    marginLeft: 12,
    textAlign: "center",
  },
});

export default TriviaGame;
