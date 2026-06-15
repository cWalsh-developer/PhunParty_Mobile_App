import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  hasImmediateFairPlayWindowViolation,
  useFairPlayMonitor,
} from "../assets/hooks/useFairPlayMonitor";
import { colors } from "../assets/theme/colors";
import { typography } from "../assets/theme/typography";

interface BeatTheClockGameProps {
  sessionCode: string;
  gamePhase?: GamePhase;
  fairPlayEnabled?: boolean;
  maxFairPlayStrikes?: number;
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

const getBeatClockEndsAt = (data: any): string | null =>
  data?.ends_at ??
  data?.endsAt ??
  data?.beat_clock?.ends_at ??
  data?.beatClock?.endsAt ??
  null;

const isBeatClockQuestion = (question: GameQuestion) =>
  {
    const compact = String(question?.game_type || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    const questionId = String(question?.question_id || "").toUpperCase();
    return (
      compact.includes("beattheclock") ||
      compact.includes("beatclock") ||
      questionId.startsWith("BTC")
    );
  };

const BeatTheClockGame: React.FC<BeatTheClockGameProps> = ({
  sessionCode,
  gamePhase,
  fairPlayEnabled = false,
  maxFairPlayStrikes = 3,
  fairPlayStatus,
  onFairPlayFocusLost,
  onFairPlayFocusReturned,
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
  const currentQuestionIdRef = useRef<string | null>(null);
  const [fairPlayLockedQuestionId, setFairPlayLockedQuestionId] = useState<
    string | null
  >(null);
  const lastFairPlayViolationRef = useRef<{
    key: string;
    reportedAt: number;
  } | null>(null);
  const nextQuestionRecoveryRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const options = useMemo(
    () => currentQuestion?.display_options ?? currentQuestion?.options ?? [],
    [currentQuestion],
  );

  const isTextInput = currentQuestion?.ui_mode === "text_input";
  const currentQuestionId = currentQuestion?.question_id ?? null;
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
  const isKicked = Boolean(fairPlayStatus?.is_kicked ?? fairPlayStatus?.isKicked);
  const isFrozen = Boolean(
    fairPlayStatus?.is_frozen ?? fairPlayStatus?.isFrozen,
  );
  const isFrozenForRenderedQuestion =
    fairPlayEnabled &&
    isFrozen &&
    !!currentQuestionId &&
    (!fairPlayFrozenQuestionId ||
      fairPlayFrozenQuestionId === currentQuestionId);
  const isBackendFairPlayLocked =
    fairPlayEnabled &&
    (isKicked ||
      isFrozenForRenderedQuestion ||
      (!!currentQuestionId && fairPlayLockedQuestionId === currentQuestionId));
  const isLocked = fairPlayEnabled && isBackendFairPlayLocked;
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

  const renderFairPlayStatus = () => {
    if (!fairPlayEnabled) {
      return null;
    }

    const isWarning = isImmediateViolationPending || isInGracePeriod;
    const strikeSummary = `${Number.isFinite(fairPlayStrikeCount) ? fairPlayStrikeCount : 0}/${Number.isFinite(fairPlayMaxStrikes) && fairPlayMaxStrikes > 0 ? fairPlayMaxStrikes : maxFairPlayStrikes}`;
    const message = isKicked
      ? fairPlayStatus?.message || "Fair Play removed you from this session."
      : isLocked
        ? fairPlayStatus?.message ||
          `Fair Play strike ${strikeSummary}. You are frozen for this question.`
        : isWarning
          ? "Return to the game immediately to avoid a Fair Play strike."
          : `Fair Play Mode active - ${strikeSummary} strikes`;

    return (
      <View
        style={[
          styles.lockedBanner,
          isWarning && !isLocked ? styles.warningBanner : null,
        ]}
      >
        <MaterialIcons
          name={isLocked ? "lock" : "verified-user"}
          size={18}
          color={isLocked ? colors.red[500] : colors.tea[500]}
        />
        <Text style={styles.lockedText}>{message}</Text>
      </View>
    );
  };

  const handleFairPlayViolation = useCallback(
    (questionId: string, reason: FocusViolationReason) => {
      const now = Date.now();
      const key = `${questionId}:${reason}`;
      const lastViolation = lastFairPlayViolationRef.current;

      if (
        lastViolation?.key === key &&
        now - lastViolation.reportedAt < 10000
      ) {
        return;
      }

      lastFairPlayViolationRef.current = { key, reportedAt: now };
      onFairPlayFocusLost?.(questionId, reason);
    },
    [onFairPlayFocusLost],
  );

  const handleFairPlayReturned = useCallback(
    (questionId: string) => {
      onFairPlayFocusReturned?.(questionId);
    },
    [onFairPlayFocusReturned],
  );

  const { isImmediateViolationPending, isInGracePeriod } = useFairPlayMonitor({
    enabled: fairPlayEnabled,
    questionId: currentQuestionId,
    phase: gamePhase ?? "question",
    onFocusLost: handleFairPlayViolation,
    onFocusReturned: handleFairPlayReturned,
  });

  useEffect(() => {
    const initialQuestionRecoveryTimers = [250, 1000, 2000].map((delay) =>
      setTimeout(() => {
        gameWebSocket.requestCurrentQuestion();
      }, delay),
    );

    gameWebSocket.onQuestionReceived = (question: GameQuestion) => {
      if (!isBeatClockQuestion(question)) return;

      initialQuestionRecoveryTimers.forEach((timer) => clearTimeout(timer));
      currentQuestionIdRef.current = question.question_id;
      if (nextQuestionRecoveryRef.current) {
        clearTimeout(nextQuestionRecoveryRef.current);
        nextQuestionRecoveryRef.current = null;
      }
      setCurrentQuestion(question);
      setSelectedAnswer("");
      setHasSubmitted(false);
      setLastResult(null);
      setScore(Number(question.score ?? 0));
      setAnsweredCount(Number(question.answered_count ?? 0));
      setCorrectCount(Number(question.correct_count ?? 0));
      setEndsAt((current) => getBeatClockEndsAt(question) ?? current);
    };

    gameWebSocket.onBeatClockAnswerResult = (data: any) => {
      if (data?.ignored) {
        setLastResult(null);
        setHasSubmitted(false);
      } else {
        setLastResult(Boolean(data?.is_correct));
        const answeredQuestionId = data?.question_id ?? data?.questionId;
        if (nextQuestionRecoveryRef.current) {
          clearTimeout(nextQuestionRecoveryRef.current);
        }
        nextQuestionRecoveryRef.current = setTimeout(() => {
          if (
            answeredQuestionId &&
            currentQuestionIdRef.current === answeredQuestionId
          ) {
            gameWebSocket.requestCurrentQuestion();
          }
        }, 750);
      }
      setScore(Number(data?.score ?? 0));
      setAnsweredCount(Number(data?.answered_count ?? 0));
      setCorrectCount(Number(data?.correct_count ?? 0));
      const nextEndsAt = getBeatClockEndsAt(data);
      if (nextEndsAt) {
        setEndsAt(nextEndsAt);
      }
    };

    gameWebSocket.onBeatClockStateUpdate = (data: any) => {
      const nextEndsAt = getBeatClockEndsAt(data);
      if (nextEndsAt) {
        setEndsAt(nextEndsAt);
      }
    };

    gameWebSocket.setReadyForQuestions(true);

    return () => {
      if (nextQuestionRecoveryRef.current) {
        clearTimeout(nextQuestionRecoveryRef.current);
        nextQuestionRecoveryRef.current = null;
      }
      initialQuestionRecoveryTimers.forEach((timer) => clearTimeout(timer));
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

  useEffect(() => {
    if (isFrozenForRenderedQuestion && currentQuestionId) {
      const lockTimeout = setTimeout(
        () => setFairPlayLockedQuestionId(currentQuestionId),
        0,
      );
      return () => clearTimeout(lockTimeout);
    }
  }, [currentQuestionId, isFrozenForRenderedQuestion]);

  useEffect(() => {
    if (
      fairPlayLockedQuestionId &&
      currentQuestionId &&
      fairPlayLockedQuestionId !== currentQuestionId
    ) {
      setFairPlayLockedQuestionId(null);
    }
  }, [currentQuestionId, fairPlayLockedQuestionId]);

  useEffect(() => {
    if (!isLocked || isKicked || !currentQuestionId) {
      return;
    }

    const recoveryTimers = [500, 1500, 3000].map((delay) =>
      setTimeout(() => {
        gameWebSocket.requestCurrentQuestion();
      }, delay),
    );

    return () => {
      recoveryTimers.forEach((timer) => clearTimeout(timer));
    };
  }, [currentQuestionId, isKicked, isLocked]);

  const submitAnswer = async () => {
    const answer = selectedAnswer.trim();
    if (!currentQuestion || !answer || hasSubmitted || isLocked) return;

    if (fairPlayEnabled) {
      const immediateViolation = await hasImmediateFairPlayWindowViolation({
        includeWindowFocusLoss: true,
      });
      if (immediateViolation) {
        handleFairPlayViolation(currentQuestion.question_id, immediateViolation);
        return;
      }
    }

    const sent = gameWebSocket.submitAnswer(answer, currentQuestion.question_id);
    if (!sent) {
      onError("Failed to submit answer. Please check your connection.");
      return;
    }

    setHasSubmitted(true);
  };

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

      {renderFairPlayStatus()}

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
  warningBanner: {
    borderColor: colors.tea[500],
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
