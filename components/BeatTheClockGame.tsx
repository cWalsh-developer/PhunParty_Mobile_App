import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  FairPlayStatus,
  FocusViolationReason,
  GamePhase,
  GameQuestion,
  gameWebSocket,
} from "../assets/api/gameWebSocketService";
import { partyColors, partyFonts } from "@/assets/theme/party";
import { PartyButton } from "@/components/party/party-button";
import {
  hasImmediateFairPlayWindowViolation,
  useFairPlayMonitor,
} from "../assets/hooks/useFairPlayMonitor";

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
  const { width, fontScale } = useWindowDimensions();
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
      <Text accessibilityRole="header" style={styles.headerTitle}>Beat the clock</Text>
      <Text style={styles.sessionText}>Room {sessionCode}</Text>
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
        accessibilityLiveRegion="polite"
        style={[
          styles.lockedBanner,
          isLocked && styles.fairPlayLocked,
          isWarning && !isLocked ? styles.warningBanner : null,
        ]}
      >
        <MaterialIcons
          name={isLocked ? "lock" : "verified-user"}
          size={18}
          color={isLocked ? partyColors.danger : partyColors.ink}
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

  const renderScreen = (content: React.ReactNode) => (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {content}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (!currentQuestion) {
    return renderScreen(
      <>
        {renderHeader()}
        <View style={styles.waitingCard} accessibilityLiveRegion="polite">
          <View style={styles.waitingIcon}>
            <MaterialIcons name="timer" size={38} color={partyColors.ink} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>Ready for a race?</Text>
          <Text style={styles.subtitle}>
            Your first question is on its way. Keep this screen open.
          </Text>
        </View>
      </>,
    );
  }

  const useSingleColumn =
    width < 360 || fontScale >= 1.25 || options.some((option) => option.length > 54);
  const timeIsUp = Boolean(endsAt) && timeRemaining <= 0 && hasSubmitted;
  const selectedAnswerIndex = options.indexOf(selectedAnswer);

  return renderScreen(
    <View style={styles.gameContent}>
      {renderHeader()}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <MaterialIcons name="stars" size={24} color={partyColors.ink} />
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Score</Text>
            <Text style={styles.statText}>{score}</Text>
          </View>
        </View>
        <View style={[styles.statPill, styles.accuracyPill]}>
          <MaterialIcons name="check-circle-outline" size={24} color={partyColors.ink} />
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Correct / answered</Text>
            <Text style={styles.statText}>{correctCount} / {answeredCount}</Text>
          </View>
        </View>
      </View>

      <View style={styles.questionCard}>
        <View style={styles.questionHeader}>
          <View style={styles.questionMode}>
            <MaterialIcons name="bolt" size={19} color={partyColors.lime} />
            <Text style={styles.questionModeText}>Keep it moving</Text>
          </View>
          <View
            style={[styles.timerPill, timeIsUp && styles.timerExpired]}
            accessible
            accessibilityLabel={endsAt ? `${timeRemaining} seconds remaining` : "Syncing the timer"}
          >
            <MaterialIcons name="timer" size={19} color={partyColors.ink} />
            <Text style={styles.timerText}>
              {endsAt ? formatTime(timeRemaining) : "Syncing"}
            </Text>
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.questionText}>
          {currentQuestion.question}
        </Text>
      </View>

      {renderFairPlayStatus()}

      {lastResult !== null && (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.resultBanner, lastResult ? styles.correctBanner : styles.incorrectBanner]}
        >
          <MaterialIcons
            name={lastResult ? "check-circle" : "cancel"}
            size={22}
            color={lastResult ? partyColors.ink : partyColors.danger}
          />
          <Text style={styles.resultText}>{lastResult ? "Correct!" : "Not quite."}</Text>
        </View>
      )}

      <Text style={styles.answerHint}>
        {isLocked
          ? "Your answers are locked for this question."
          : timeIsUp
            ? "Time's up. Look at the big screen for the results."
            : hasSubmitted
              ? "Answer submitted. Your next question is on its way."
              : isTextInput
                ? "Type your answer, then lock it in."
                : "Pick your answer, then lock it in."}
      </Text>

      {isTextInput ? (
        <View style={styles.textAnswerContainer}>
          <Text style={styles.inputLabel}>Your answer</Text>
          <TextInput
            accessibilityLabel="Your answer"
            accessibilityHint="Type your answer, then choose Lock it in."
            style={[styles.textInput, (hasSubmitted || isLocked) && styles.disabledOption]}
            value={selectedAnswer}
            onChangeText={setSelectedAnswer}
            placeholder="Type your answer"
            placeholderTextColor={partyColors.muted}
            editable={!hasSubmitted && !isLocked}
            autoCapitalize="none"
            autoCorrect
            returnKeyType="done"
            onSubmitEditing={submitAnswer}
          />
        </View>
      ) : (
        <View
          style={styles.optionsContainer}
          accessibilityRole="radiogroup"
          accessibilityLabel="Answer choices"
        >
          {options.map((option, index) => {
            const isSelected = selectedAnswer === option;
            return (
              <TouchableOpacity
                key={`${currentQuestion.question_id}-${index}-${option}`}
                accessibilityRole="radio"
                aria-checked={isSelected}
                aria-disabled={hasSubmitted || isLocked}
                accessibilityLabel={`${String.fromCharCode(65 + index)}. ${option}`}
                accessibilityHint="Select this answer, then choose Lock it in."
                accessibilityState={{ checked: isSelected, disabled: hasSubmitted || isLocked }}
                style={[
                  styles.optionButton,
                  useSingleColumn && styles.optionFullWidth,
                  isSelected && styles.selectedOption,
                  (hasSubmitted || isLocked) && styles.disabledOption,
                ]}
                onPress={() => setSelectedAnswer(option)}
                disabled={hasSubmitted || isLocked}
                activeOpacity={0.85}
              >
                <View style={styles.optionTopRow}>
                  <Text style={styles.optionLetter}>{String.fromCharCode(65 + index)}</Text>
                  <MaterialIcons
                    name={isSelected ? "check-circle-outline" : "radio-button-unchecked"}
                    size={19}
                    color={partyColors.ink}
                  />
                </View>
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.submitContainer}>
        <View style={styles.selectionStatus} accessibilityLiveRegion="polite">
          <MaterialIcons
            name={timeIsUp ? "timer-off" : hasSubmitted ? "lock" : "check-circle-outline"}
            size={21}
            color={partyColors.ink}
          />
          <Text style={styles.selectionText}>
            {timeIsUp
              ? "Round finished."
              : hasSubmitted
                ? "Answer submitted."
                : selectedAnswer.trim()
                  ? selectedAnswerIndex >= 0 && !isTextInput
                    ? `You picked ${String.fromCharCode(65 + selectedAnswerIndex)}. Lock it in to submit.`
                    : "Answer ready. Lock it in to submit."
                  : "Your next point starts here."}
          </Text>
        </View>
        <PartyButton
          title={timeIsUp ? "Time's up" : hasSubmitted ? "Answer submitted" : "Lock it in!"}
          onPress={submitAnswer}
          disabled={!canSubmit}
          icon={<MaterialIcons name={hasSubmitted ? "check" : "lock-outline"} size={21} color={partyColors.ink} />}
        />
      </View>
    </View>,
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: partyColors.cream },
  scrollContent: {
    flexGrow: 1, width: "100%", maxWidth: 760, alignSelf: "center",
    padding: 16, paddingBottom: 32,
  },
  gameContent: { gap: 16 },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerTitle: { fontFamily: partyFonts.display, color: partyColors.ink, fontSize: 21, lineHeight: 28 },
  sessionText: { fontSize: 13, fontWeight: "700", color: partyColors.muted },
  waitingCard: {
    alignItems: "center", gap: 16, marginVertical: 24, padding: 24,
    backgroundColor: partyColors.lavender, borderColor: partyColors.border,
    borderWidth: 2, borderBottomWidth: 5, borderRadius: 24,
  },
  waitingIcon: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 2,
    borderColor: partyColors.border, backgroundColor: partyColors.lime,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontFamily: partyFonts.display, fontSize: 25, lineHeight: 33, color: partyColors.ink, textAlign: "center" },
  subtitle: { fontSize: 16, lineHeight: 24, color: partyColors.ink, textAlign: "center" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statPill: {
    flex: 1, minWidth: 130, flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, backgroundColor: partyColors.lime, borderColor: partyColors.border,
    borderWidth: 2, borderBottomWidth: 4, borderRadius: 14,
  },
  accuracyPill: { backgroundColor: partyColors.lavender },
  statContent: { flex: 1, gap: 4 },
  statLabel: { fontSize: 12, lineHeight: 17, fontWeight: "700", color: partyColors.ink },
  statText: { fontSize: 21, lineHeight: 27, fontWeight: "800", fontVariant: ["tabular-nums"], color: partyColors.ink },
  questionCard: { backgroundColor: partyColors.purple, borderRadius: 22, padding: 20, gap: 22 },
  questionHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  questionMode: { flexDirection: "row", alignItems: "center", gap: 6 },
  questionModeText: { fontSize: 13, fontWeight: "800", color: partyColors.lime },
  timerPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 24, backgroundColor: partyColors.lime, paddingHorizontal: 11, paddingVertical: 7 },
  timerExpired: { backgroundColor: partyColors.pink },
  timerText: { color: partyColors.ink, fontSize: 17, fontWeight: "800", fontVariant: ["tabular-nums"] },
  questionText: { fontFamily: partyFonts.display, fontSize: 27, lineHeight: 35, color: partyColors.white },
  resultBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderColor: partyColors.border, borderWidth: 1 },
  correctBanner: { backgroundColor: partyColors.success },
  incorrectBanner: { backgroundColor: partyColors.dangerSoft },
  resultText: { flex: 1, fontSize: 16, lineHeight: 23, fontWeight: "800", color: partyColors.ink },
  lockedBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: partyColors.border, backgroundColor: partyColors.lavender },
  fairPlayLocked: { backgroundColor: partyColors.dangerSoft, borderColor: partyColors.danger },
  warningBanner: { backgroundColor: partyColors.lime },
  lockedText: { flex: 1, fontSize: 14, lineHeight: 21, fontWeight: "600", color: partyColors.ink },
  answerHint: { fontSize: 14, lineHeight: 21, color: partyColors.muted },
  textAnswerContainer: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: "700", color: partyColors.ink },
  textInput: {
    backgroundColor: partyColors.white, borderColor: partyColors.border,
    borderWidth: 2, borderBottomWidth: 4, borderRadius: 12, color: partyColors.ink,
    fontSize: 18, minHeight: 60, padding: 16,
  },
  optionsContainer: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: 12 },
  optionButton: {
    flexBasis: "46%", flexGrow: 1, minWidth: 0, minHeight: 104, gap: 12,
    backgroundColor: partyColors.white, borderColor: partyColors.border,
    borderWidth: 2, borderBottomWidth: 5, borderRadius: 12, padding: 12,
  },
  optionFullWidth: { flexBasis: "100%" },
  selectedOption: { backgroundColor: partyColors.lime },
  disabledOption: { opacity: 0.65 },
  optionTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  optionLetter: { fontSize: 13, fontWeight: "800", color: partyColors.ink },
  optionText: { fontSize: 17, lineHeight: 24, fontWeight: "800", color: partyColors.ink },
  submitContainer: { gap: 12 },
  selectionStatus: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectionText: { flex: 1, fontSize: 14, lineHeight: 21, fontWeight: "600", color: partyColors.ink },
});

export default BeatTheClockGame;
