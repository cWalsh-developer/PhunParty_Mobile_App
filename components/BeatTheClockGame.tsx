import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  FairPlayStatus,
  FocusViolationReason,
  GamePhase,
  GameQuestion,
  gameWebSocket,
} from "../assets/api/gameWebSocketService";
import { AppButton } from "../assets/components/AppButton";
import { AppCard } from "../assets/components/AppCard";
import { colors } from "../assets/theme/colors";
import { typography } from "../assets/theme/typography";

interface BeatTheClockGameProps {
  sessionCode: string;
  gamePhase?: GamePhase;
  fairPlayEnabled?: boolean;
  fairPlayStatus?: FairPlayStatus | null;
  onFairPlayFocusLost?: (
    questionId: string,
    reason: FocusViolationReason,
  ) => void;
  onFairPlayFocusReturned?: (questionId: string) => void;
  onGameEnd: () => void;
  onError: (message: string) => void;
}

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const isBeatClockQuestion = (question: GameQuestion) =>
  question?.game_type === "beat_the_clock";

const BeatTheClockGame: React.FC<BeatTheClockGameProps> = ({
  sessionCode,
  fairPlayEnabled = false,
  fairPlayStatus,
  onError,
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestion | null>(
    null,
  );
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const options = useMemo(
    () => currentQuestion?.display_options ?? currentQuestion?.options ?? [],
    [currentQuestion],
  );

  const isTextInput = currentQuestion?.ui_mode === "text_input";
  const isKicked = Boolean(fairPlayStatus?.is_kicked ?? fairPlayStatus?.isKicked);
  const isFrozen = Boolean(
    fairPlayStatus?.is_frozen ?? fairPlayStatus?.isFrozen,
  );
  const isLocked = fairPlayEnabled && (isKicked || isFrozen);
  const canSubmit =
    !!currentQuestion &&
    selectedAnswer.trim().length > 0 &&
    !hasSubmitted &&
    !isLocked &&
    timeRemaining > 0;

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Beat the Clock</Text>
      {timeRemaining > 0 ? (
        <Text style={styles.headerTimer}>{formatTime(timeRemaining)}</Text>
      ) : null}
    </View>
  );

  useEffect(() => {
    gameWebSocket.setReadyForQuestions(true);

    gameWebSocket.onQuestionReceived = (question: GameQuestion) => {
      if (!isBeatClockQuestion(question)) return;

      setCurrentQuestion(question);
      setSelectedAnswer("");
      setHasSubmitted(false);
      setLastResult(null);
      setScore(Number(question.score ?? 0));
      setAnsweredCount(Number(question.answered_count ?? 0));
      setCorrectCount(Number(question.correct_count ?? 0));
      setEndsAt(question.ends_at ?? null);
    };

    gameWebSocket.onBeatClockAnswerResult = (data: any) => {
      setLastResult(Boolean(data?.is_correct));
      setScore(Number(data?.score ?? 0));
      setAnsweredCount(Number(data?.answered_count ?? 0));
      setCorrectCount(Number(data?.correct_count ?? 0));
      if (data?.ends_at) {
        setEndsAt(data.ends_at);
      }
    };

    gameWebSocket.onBeatClockStateUpdate = (data: any) => {
      if (data?.ends_at) {
        setEndsAt(data.ends_at);
      }
    };

    return () => {
      gameWebSocket.onQuestionReceived = null;
      gameWebSocket.onBeatClockAnswerResult = null;
      gameWebSocket.onBeatClockStateUpdate = null;
    };
  }, []);

  useEffect(() => {
    if (!endsAt) return;

    const updateTime = () => {
      const remainingMs = Date.parse(endsAt) - gameWebSocket.estimatedServerNowMs();
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      setTimeRemaining(remainingSeconds);
      if (remainingSeconds <= 0) {
        setHasSubmitted(true);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  const submitAnswer = () => {
    const answer = selectedAnswer.trim();
    if (!currentQuestion || !answer || hasSubmitted || isLocked) return;

    const sent = gameWebSocket.submitAnswer(answer, currentQuestion.question_id);
    if (!sent) {
      onError("Failed to submit answer. Please check your connection.");
      return;
    }

    setHasSubmitted(true);
  };

  if (timeRemaining <= 0 && currentQuestion) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <AppCard style={styles.waitingCard}>
          <MaterialIcons name="timer-off" size={48} color={colors.tea[500]} />
          <Text style={styles.title}>Time is up</Text>
          <Text style={styles.subtitle}>Finalising scores...</Text>
          <Text style={styles.scoreText}>Your score: {score}</Text>
        </AppCard>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <AppCard style={styles.waitingCard}>
          <MaterialIcons name="timer" size={48} color={colors.tea[500]} />
          <Text style={styles.title}>Get ready</Text>
          <Text style={styles.subtitle}>Waiting for your first question...</Text>
          <Text style={styles.sessionText}>Session: {sessionCode}</Text>
        </AppCard>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <MaterialIcons name="timer" size={18} color={colors.tea[500]} />
          <Text style={styles.statText}>{formatTime(timeRemaining)}</Text>
        </View>
        <View style={styles.statPill}>
          <MaterialIcons name="stars" size={18} color={colors.peach[500]} />
          <Text style={styles.statText}>{score} correct</Text>
        </View>
      </View>

      <AppCard style={styles.questionCard}>
        <Text style={styles.questionText}>{currentQuestion.question}</Text>
        <Text style={styles.progressText}>
          {correctCount}/{answeredCount} correct
        </Text>
      </AppCard>

      {lastResult !== null && (
        <View
          style={[
            styles.resultBanner,
            lastResult ? styles.correctBanner : styles.incorrectBanner,
          ]}
        >
          <MaterialIcons
            name={lastResult ? "check-circle" : "cancel"}
            size={20}
            color={lastResult ? colors.tea[500] : colors.red[500]}
          />
          <Text
            style={[
              styles.resultText,
              lastResult ? styles.correctText : styles.incorrectText,
            ]}
          >
            {lastResult ? "Correct" : "Not quite"}
          </Text>
        </View>
      )}

      {isLocked && (
        <View style={styles.lockedBanner}>
          <MaterialIcons name="lock" size={18} color={colors.red[500]} />
          <Text style={styles.lockedText}>
            Fair Play restriction active for this question.
          </Text>
        </View>
      )}

      {isTextInput ? (
        <TextInput
          style={styles.textInput}
          value={selectedAnswer}
          onChangeText={setSelectedAnswer}
          placeholder="Type your answer"
          placeholderTextColor={colors.stone[400]}
          editable={!hasSubmitted && !isLocked}
          autoCapitalize="none"
          autoCorrect
          returnKeyType="done"
          onSubmitEditing={submitAnswer}
        />
      ) : (
        <View style={styles.optionsContainer}>
          {options.map((option, index) => {
            const isSelected = selectedAnswer === option;
            return (
              <TouchableOpacity
                key={`${currentQuestion.question_id}-${index}-${option}`}
                style={[
                  styles.optionButton,
                  isSelected && styles.selectedOption,
                  (hasSubmitted || isLocked) && styles.disabledOption,
                ]}
                onPress={() => setSelectedAnswer(option)}
                disabled={hasSubmitted || isLocked}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.selectedOptionText,
                  ]}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.submitContainer}>
        <AppButton
          title={hasSubmitted ? "Submitted" : "Submit Answer"}
          onPress={submitAnswer}
          variant="primary"
          disabled={!canSubmit}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink[900],
    padding: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.white,
    fontWeight: "800",
  },
  headerTimer: {
    ...typography.body,
    color: colors.tea[500],
    fontWeight: "800",
  },
  waitingCard: {
    alignItems: "center",
    gap: 12,
    marginTop: 56,
    padding: 32,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.stone[300],
    textAlign: "center",
  },
  sessionText: {
    ...typography.caption,
    color: colors.stone[400],
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statPill: {
    alignItems: "center",
    backgroundColor: colors.ink[800],
    borderColor: colors.ink[700],
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 10,
  },
  statText: {
    ...typography.body,
    color: colors.white,
    fontWeight: "700",
  },
  questionCard: {
    marginBottom: 14,
    padding: 22,
  },
  questionText: {
    ...typography.h3,
    color: colors.white,
    lineHeight: 30,
    textAlign: "center",
  },
  progressText: {
    ...typography.caption,
    color: colors.stone[400],
    marginTop: 12,
    textAlign: "center",
  },
  resultBanner: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 12,
    padding: 10,
  },
  correctBanner: {
    backgroundColor: colors.ink[800],
    borderColor: colors.tea[500],
    borderWidth: 1,
  },
  incorrectBanner: {
    backgroundColor: colors.ink[800],
    borderColor: colors.red[500],
    borderWidth: 1,
  },
  resultText: {
    ...typography.body,
    fontWeight: "700",
  },
  correctText: {
    color: colors.tea[500],
  },
  incorrectText: {
    color: colors.red[500],
  },
  lockedBanner: {
    alignItems: "center",
    backgroundColor: colors.ink[800],
    borderColor: colors.red[500],
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    padding: 10,
  },
  lockedText: {
    ...typography.caption,
    color: colors.stone[100],
    flex: 1,
  },
  textInput: {
    ...typography.body,
    backgroundColor: colors.ink[800],
    borderColor: colors.ink[700],
    borderRadius: 8,
    borderWidth: 1,
    color: colors.white,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    backgroundColor: colors.ink[800],
    borderColor: colors.ink[700],
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  selectedOption: {
    backgroundColor: colors.tea[500],
    borderColor: colors.tea[400],
  },
  disabledOption: {
    opacity: 0.65,
  },
  optionText: {
    ...typography.body,
    color: colors.white,
    fontWeight: "600",
  },
  selectedOptionText: {
    color: colors.white,
  },
  submitContainer: {
    marginTop: 18,
  },
  scoreText: {
    ...typography.body,
    color: colors.white,
    fontWeight: "700",
  },
});

export default BeatTheClockGame;
