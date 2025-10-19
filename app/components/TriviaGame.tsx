import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
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

interface TriviaGameProps {
  sessionCode: string;
  onGameEnd: () => void;
  onError: (error: string) => void;
}

interface Answer {
  option: string;
  isCorrect?: boolean;
  isSelected: boolean;
}

export const TriviaGame: React.FC<TriviaGameProps> = ({
  sessionCode,
  onGameEnd,
  onError,
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestion | null>(
    null
  );
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isGameActive, setIsGameActive] = useState(true);

  const [pulseAnimation] = useState(new Animated.Value(1));
  const [fadeAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    setupWebSocketListeners();

    // DON'T auto-fetch initial question - wait for host to start game via WebSocket


    return () => {
      // Cleanup handled by parent component
    };
  }, []);

  useEffect(() => {
    if (currentQuestion) {
      resetForNewQuestion();
      animateQuestionEntry();
    }
  }, [currentQuestion]);

  const setupWebSocketListeners = () => {


    gameWebSocket.onQuestionReceived = (question: GameQuestion) => {
      console.log("🎯 TriviaGame - Question received:", {
        hasQuestionId: !!question.question_id,
        hasQuestion: !!question.question,
        hasOptions: !!question.options,
        hasDisplayOptions: !!question.display_options,
        questionText: question.question?.substring(0, 50) + "...",
        display_options: question.display_options,
        correct_index: question.correct_index,
        raw_question: question,
      });

      // If this is an empty event (WebSocket notification without data)
      if (!question.question_id || !question.question) {
        console.log(
          "⚡ Empty WebSocket event - fetching current question immediately"
        );
        fetchCurrentQuestionNow();
        return;
      }

      // Valid question received via WebSocket

      setCurrentQuestion(question);

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
        setAnswers(answerOptions);
      } else {
        console.log(
          "⚠️ No valid options received from WebSocket - clearing answers"
        );
        setAnswers([]);
      }
    };

    // Handle when the game starts - fetch initial question
    gameWebSocket.onGameStarted = (data: any) => {

      // Small delay to ensure backend is ready
      setTimeout(() => {
        fetchInitialQuestion();
      }, 500);
    };

    gameWebSocket.onAnswerSubmitted = (data: any) => {
      console.log("✅ Answer submission result:", {
        is_correct: data.is_correct,
        correct_answer: data.correct_answer,
        has_is_correct: data.is_correct !== undefined,
        full_data: data,
      });
      if (data.is_correct !== undefined) {
        updateAnswerResults(data);
      } else {

      }
    };

    gameWebSocket.onBuzzerUpdate = (data: any) => {


      if (data.type === "correct_answer" && data.correct_option) {
        showCorrectAnswer(data.correct_option);
      } else if (data.type === "question_ended") {
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
      const API = (await import("../../assets/api/API")).default;

      const response = await API.gameSession.getCurrentQuestion(sessionCode);

      if (response.isSuccess && response.result) {
        const questionData = response.result;

        console.log("🐛 DEBUG - Question data received:", {
          question_id: questionData.question_id,
          question: questionData.question,
          display_options: questionData.display_options,
          correct_index: questionData.correct_index,
          answer: questionData.answer,
          raw_response: questionData,
        });

        const question: GameQuestion = {
          question_id: questionData.question_id,
          question: questionData.question || "Loading question...",
          game_type: "trivia",
          ui_mode: "multiple_choice",
          display_options: questionData.display_options,
          correct_index: questionData.correct_index,
          answer: questionData.answer,
        };

        setCurrentQuestion(question);

        const answerOptions = (question.display_options || []).map(
          (option) => ({
            option,
            isSelected: false,
          })
        );

        console.log("🐛 DEBUG - Answer options created:", {
          source: question.display_options ? "display_options" : "empty",
          options_count: answerOptions.length,
          options: answerOptions.map((a) => a.option),
        });

        setAnswers(answerOptions);


      } else {

      }
    } catch (error) {

    }
  };

  const fetchInitialQuestion = async () => {
    try {

      const API = (await import("../../assets/api/API")).default;

      // First check if game is already active
      const statusResponse = await API.gameSession.getStatus(sessionCode);
      if (statusResponse.isSuccess) {
        const status = statusResponse.result;
        console.log("📊 Game status:", {
          is_active: status.is_active,
          has_question: !!status.current_question,
          current_question_data: status.current_question,
        });

        // If game is active and has a question, use it
        if (status.is_active && status.current_question) {
          const question: GameQuestion = {
            question_id:
              status.current_question.question_id || Date.now().toString(),
            question: status.current_question.question || "Loading question...",
            game_type: "trivia",
            ui_mode: "multiple_choice",
            display_options: status.current_question.display_options,
            correct_index: status.current_question.correct_index,
            answer: status.current_question.answer,
          };

          setCurrentQuestion(question);

          const answerOptions = (question.display_options || []).map(
            (option) => ({
              option,
              isSelected: false,
            })
          );
          setAnswers(answerOptions);


          return;
        }
      }

      // Try to start the game if not active
      try {
        await API.put(`/game-logic/start-game/${sessionCode}`);

      } catch (startError) {

      }

      // Get current question after starting
      await fetchCurrentQuestionNow();
    } catch (error) {

    }
  };

  const resetForNewQuestion = () => {
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
    if (hasSubmitted || !isGameActive) return;

    animateSelection();
    setSelectedAnswer(option);

    const updatedAnswers = answers.map((answer) => ({
      ...answer,
      isSelected: answer.option === option,
    }));
    setAnswers(updatedAnswers);
  };

  const submitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion || hasSubmitted) return;

    setHasSubmitted(true);
    console.log("🎯 Submitting answer:", {
      answer: selectedAnswer,
      question_id: currentQuestion.question_id,
      session_code: sessionCode,
    });

    // Try WebSocket first
    const wsSuccess = gameWebSocket.submitAnswer(
      selectedAnswer,
      currentQuestion.question_id
    );

    if (!wsSuccess) {


      try {
        // Fallback to API submission
        const apiResult = await gameWebSocket.submitAnswerViaAPI(
          currentQuestion.question_id,
          selectedAnswer
        );

        if (!apiResult?.isSuccess) {
          setHasSubmitted(false);
          onError("Failed to submit answer. Please check your connection.");
          return;
        }


      } catch (error) {

        setHasSubmitted(false);
        onError("Failed to submit answer. Please check your connection.");
      }
    } else {

    }
  };

  const updateAnswerResults = (data: any) => {
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
    setAnswers(updatedAnswers);
    setShowResults(true);
  };

  const showCorrectAnswer = (correctOption: string) => {
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
    setAnswers(updatedAnswers);
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

        <View style={styles.answersContainer}>
          {answers.map((answer, index) => (
            <Animated.View
              key={index}
              style={{ transform: [{ scale: pulseAnimation }] }}
            >
              <TouchableOpacity
                style={getAnswerButtonStyle(answer)}
                onPress={() => selectAnswer(answer.option)}
                disabled={hasSubmitted || showResults}
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

        {selectedAnswer && !hasSubmitted && !showResults && (
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
