import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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
  FairPlayStatus,
  FocusViolationReason,
  GamePhase,
  GameQuestion,
  gameWebSocket,
} from "../assets/api/gameWebSocketService";
import { AppCard } from "../assets/components/AppCard";
import {
  hasImmediateFairPlayWindowViolation,
  useFairPlayMonitor,
} from "../assets/hooks/useFairPlayMonitor";
import { colors } from "../assets/theme/colors";
import { typography } from "../assets/theme/typography";

interface BuzzerGameProps {
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
  questionId: string | null;
  transitioning: boolean;
  acceptingBuzzes: boolean;
}

export const BuzzerGame: React.FC<BuzzerGameProps> = ({
  sessionCode,
  gamePhase = "question",
  fairPlayEnabled = false,
  maxFairPlayStrikes = 3,
  fairPlayStatus,
  onFairPlayFocusLost,
  onFairPlayFocusReturned,
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
    questionId: null,
    transitioning: false,
    acceptingBuzzes: false,
  });
  const [answerOptions, setAnswerOptions] = useState<string[]>([]);
  const [answerText, setAnswerText] = useState("");
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [submittedQuestionId, setSubmittedQuestionId] = useState<string | null>(
    null,
  );
  const [isGameActive, setIsGameActive] = useState(true);
  const [glowIntensity, setGlowIntensity] = useState(0);
  const [fairPlayLockedQuestionId, setFairPlayLockedQuestionId] = useState<
    string | null
  >(null);

  const [scaleAnimation] = useState(() => new Animated.Value(1));
  const [winnerAnimation] = useState(() => new Animated.Value(0));
  const glowIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const winnerAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const fairPlayStatusRef = useRef<FairPlayStatus | null | undefined>(
    fairPlayStatus,
  );
  const fairPlayEnabledRef = useRef(fairPlayEnabled);
  const gameEndedTimeoutRef = useRef<any>(null);
  const currentQuestionId = currentQuestion?.question_id ?? null;
  const currentQuestionIdRef = useRef<string | null>(null);
  const submittedQuestionIdRef = useRef<string | null>(null);
  const lastFairPlayViolationRef = useRef<{
    key: string;
    reportedAt: number;
  } | null>(null);
  const fairPlayStrikeCount = Number(
    fairPlayStatus?.strike_count ?? fairPlayStatus?.strikeCount ?? 0,
  );
  const fairPlayMaxStrikes = Number(
    fairPlayStatus?.max_strikes ??
      fairPlayStatus?.maxStrikes ??
      maxFairPlayStrikes,
  );
  const fairPlayGracePeriodMs = Number(
    fairPlayStatus?.grace_period_ms ?? fairPlayStatus?.gracePeriodMs ?? 1500,
  );
  const fairPlayGraceSeconds = Math.max(
    1,
    Math.ceil(
      (Number.isFinite(fairPlayGracePeriodMs) ? fairPlayGracePeriodMs : 1500) /
        1000,
    ),
  );
  const fairPlayFrozenQuestionId =
    fairPlayStatus?.frozen_question_id ?? fairPlayStatus?.frozenQuestionId;
  const isFrozenByFairPlay = Boolean(
    fairPlayStatus?.is_frozen ?? fairPlayStatus?.isFrozen,
  );
  const isKickedByFairPlay = Boolean(
    fairPlayStatus?.is_kicked ?? fairPlayStatus?.isKicked,
  );
  const isFrozenForRenderedQuestion =
    fairPlayEnabled &&
    isFrozenByFairPlay &&
    !!currentQuestionId &&
    (!fairPlayFrozenQuestionId ||
      fairPlayFrozenQuestionId === currentQuestionId);
  const isBackendFairPlayLocked =
    fairPlayEnabled &&
    (isKickedByFairPlay ||
      isFrozenForRenderedQuestion ||
      (!!currentQuestionId && fairPlayLockedQuestionId === currentQuestionId));

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
    phase: gamePhase,
    onFocusLost: handleFairPlayViolation,
    onFocusReturned: handleFairPlayReturned,
  });

  const isFairPlayLocked =
    fairPlayEnabled &&
    (isBackendFairPlayLocked || isImmediateViolationPending);

  useEffect(() => {
    fairPlayStatusRef.current = fairPlayStatus;
    fairPlayEnabledRef.current = fairPlayEnabled;
  }, [fairPlayEnabled, fairPlayStatus]);

  useEffect(() => {
    submittedQuestionIdRef.current = submittedQuestionId;
  }, [submittedQuestionId]);

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
      const unlockTimeout = setTimeout(
        () => setFairPlayLockedQuestionId(null),
        0,
      );
      return () => clearTimeout(unlockTimeout);
    }
  }, [currentQuestionId, fairPlayLockedQuestionId]);

  useEffect(() => {
    if (!isFairPlayLocked) {
      return;
    }

    const freezeTimeout = setTimeout(() => {
      setHasSubmittedAnswer(false);
      setSubmittedQuestionId(null);
      if (glowIntervalRef.current) {
        clearInterval(glowIntervalRef.current);
        glowIntervalRef.current = null;
      }
      setGlowIntensity(0);
      setBuzzerState((prev) => ({
        ...prev,
        buttonState: "frozen",
        isActive: false,
        canBuzz: false,
        canAnswer: false,
        statusText: "Fair Play freeze. Wait for the next question.",
      }));
    }, 0);

    return () => clearTimeout(freezeTimeout);
  }, [isFairPlayLocked, currentQuestionId]);

  useEffect(() => {
    currentQuestionIdRef.current = currentQuestionId;
  }, [currentQuestionId]);

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

  const clearSubmittedAnswerState = () => {
    submittedQuestionIdRef.current = null;
    setHasSubmittedAnswer(false);
    setSubmittedQuestionId(null);
  };

  const resetBuzzerState = (
    questionId: string | null = currentQuestionId ?? null,
  ) => {
    const isSubmittedQuestion =
      !!questionId && submittedQuestionIdRef.current === questionId;

    setAnswerOptions([]);
    if (!isSubmittedQuestion) {
      setAnswerText("");
      clearSubmittedAnswerState();
    }

    setBuzzerState({
      isActive: true,
      winner: null,
      canBuzz: true,
      canAnswer: false,
      playersBuzzed: [],
      buttonState: "active",
      statusText: "Tap to buzz in first!",
      questionId,
      transitioning: false,
      acceptingBuzzes: true,
    });

    if (!isSubmittedQuestion) {
      stopWinnerAnimation();
    }
  };

  const applyBackendButtonState = (data: any) => {
    const buttonState = (data.button_state ||
      data.buttonState ||
      "waiting") as BuzzerState["buttonState"];
    const isCurrentPlayer = !!(data.is_current_player || data.isCurrentPlayer);
    const updateQuestionId = data.question_id ?? data.questionId ?? null;
    const isTransitioning = !!(data.transitioning ?? data.isTransitioning);
    const acceptingBuzzes = !!(
      data.accepting_buzzes ??
      data.acceptingBuzzes ??
      buttonState === "active"
    );

    if (buttonState === "answer_mode" && isCurrentPlayer) {
      applyQuestionAnswerData(data);
      clearSubmittedAnswerState();
    }

    if (buttonState === "frozen") {
      clearSubmittedAnswerState();
    }

    const activeQuestionId = currentQuestionIdRef.current;
    const effectiveQuestionId = updateQuestionId || activeQuestionId;

    const questionMatches =
      updateQuestionId && activeQuestionId
        ? updateQuestionId === activeQuestionId
        : Boolean(effectiveQuestionId);

    const canBuzz =
      buttonState === "active" &&
      acceptingBuzzes &&
      !isTransitioning &&
      questionMatches;

    setBuzzerState((prev) => ({
      ...prev,
      buttonState,
      questionId: effectiveQuestionId || prev.questionId,
      transitioning: isTransitioning,
      acceptingBuzzes,
      winner: data.winner_name || data.winner || prev.winner,
      isActive: canBuzz,
      canBuzz,
      canAnswer: buttonState === "answer_mode" && isCurrentPlayer,
      statusText: getStatusTextForButtonState(buttonState, data),
    }));

    if (canBuzz) {
      startGlowAnimation();
    } else {
      stopGlowAnimation();
    }
  };

  const applyAuthoritativeBuzzerState = (data: any) => {
    const updateQuestionId = data.question_id ?? data.questionId;
    const activeQuestionId = currentQuestionIdRef.current;

    if (
      updateQuestionId &&
      activeQuestionId &&
      updateQuestionId !== activeQuestionId
    ) {
      return;
    }

    const myPlayerId = gameWebSocket.playerInfo?.player_id;
    const currentWinner =
      data.current_buzzer_winner ?? data.currentBuzzerWinner ?? null;
    const frozenPlayers = Array.isArray(data.frozen_players)
      ? data.frozen_players
      : Array.isArray(data.frozenPlayers)
        ? data.frozenPlayers
        : [];
    const questionActive = data.question_active ?? data.questionActive ?? true;
    const isTransitioning = !!(data.transitioning ?? data.isTransitioning);
    const acceptingBuzzes = !!(
      data.accepting_buzzes ??
      data.acceptingBuzzes ??
      questionActive
    );
    const isFrozen = !!myPlayerId && frozenPlayers.includes(myPlayerId);
    const isWinner = !!myPlayerId && currentWinner === myPlayerId;

    let nextButtonState: BuzzerState["buttonState"] = "locked";
    let nextStatusText = "Buzzer locked.";

    if (isTransitioning || !acceptingBuzzes) {
      nextButtonState = "waiting";
      nextStatusText = data.message || "Waiting for the next question...";
    } else if (isFrozen) {
      nextButtonState = "frozen";
      nextStatusText = "You're frozen for this question.";
      clearSubmittedAnswerState();
    } else if (isWinner) {
      nextButtonState = "answer_mode";
      nextStatusText = "You buzzed first. Choose your answer.";
      clearSubmittedAnswerState();
    } else if (currentWinner) {
      nextButtonState = "waiting";
      nextStatusText = "Another player buzzed first.";
    } else if (questionActive) {
      nextButtonState = "active";
      nextStatusText = "Tap to buzz in first!";
    }

    const effectiveQuestionId = updateQuestionId || activeQuestionId;

    const questionMatches =
      updateQuestionId && activeQuestionId
        ? updateQuestionId === activeQuestionId
        : Boolean(effectiveQuestionId);

    const canBuzz =
      nextButtonState === "active" &&
      acceptingBuzzes &&
      !isTransitioning &&
      questionMatches;

    setBuzzerState((prev) => ({
      ...prev,
      buttonState: nextButtonState,
      questionId: effectiveQuestionId || prev.questionId,
      transitioning: isTransitioning,
      acceptingBuzzes,
      winner: currentWinner || null,
      isActive: canBuzz,
      canBuzz,
      canAnswer: nextButtonState === "answer_mode",
      statusText: nextStatusText,
    }));

    if (canBuzz) {
      startGlowAnimation();
      stopWinnerAnimation();
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
        return "Waiting for the next question...";
    }
  };

  const getAnswerMatchStatus = (data: any) => {
    const match = data.answer_match;
    const matchedAnswer = match?.matched_answer || match?.matchedAnswer;

    if (matchedAnswer) {
      return `Matched: ${matchedAnswer}`;
    }

    return data.correct_answer ? `Answer: ${data.correct_answer}` : null;
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

  const submitBuzzerAnswer = async (answer: string) => {
    if (
      !currentQuestion?.question_id ||
      !answer ||
      hasSubmittedAnswer ||
      isFairPlayLocked
    ) {
      return;
    }

    if (fairPlayEnabled) {
      const immediateViolation = await hasImmediateFairPlayWindowViolation();

      if (immediateViolation) {
        setFairPlayLockedQuestionId(currentQuestion.question_id);
        handleFairPlayViolation(currentQuestion.question_id, immediateViolation);
        return;
      }
    }

    const sent = gameWebSocket.submitAnswer(
      answer,
      currentQuestion.question_id,
    );

    if (!sent) {
      onError("Failed to submit answer. Please check your connection.");
      return;
    }

    setHasSubmittedAnswer(true);
    setSubmittedQuestionId(currentQuestion.question_id);
    setBuzzerState((prev) => ({
      ...prev,
      buttonState: "locked",
      isActive: false,
      canBuzz: false,
      canAnswer: false,
      statusText: "Answer submitted. Waiting for result...",
    }));
  };

  const handleBuzzerPress = async () => {
    const activeQuestionId =
      currentQuestionIdRef.current ?? currentQuestion?.question_id ?? null;

    const buzzerQuestionId = buzzerState.questionId ?? activeQuestionId;

    const canPressBuzzer =
      !!activeQuestionId &&
      buzzerQuestionId === activeQuestionId &&
      buzzerState.buttonState === "active" &&
      buzzerState.acceptingBuzzes &&
      !buzzerState.transitioning &&
      buzzerState.canBuzz &&
      buzzerState.isActive &&
      isGameActive &&
      !isFairPlayLocked;

    if (!canPressBuzzer) return;

    if (fairPlayEnabled) {
      const immediateViolation = await hasImmediateFairPlayWindowViolation();

      if (immediateViolation) {
        setFairPlayLockedQuestionId(activeQuestionId);
        handleFairPlayViolation(activeQuestionId, immediateViolation);
        return;
      }
    }

    // Immediate visual feedback
    setBuzzerState((prev) => ({ ...prev, canBuzz: false }));
    animateBuzzerPress();

    // Send to server
    const success = gameWebSocket.pressBuzzer(activeQuestionId);
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
    } else if (isFairPlayLocked || buzzerState.buttonState === "frozen") {
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
    if (!buzzerState.isActive || buzzerState.winner || isFairPlayLocked)
      return {};

    return {
      shadowColor: colors.tea[500],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: glowIntensity ? 0.85 : 0.25,
      shadowRadius: glowIntensity ? 20 : 6,
      elevation: glowIntensity ? 20 : 6,
    };
  };

  const renderFairPlayStatus = () => {
    if (!fairPlayEnabled) {
      return null;
    }

    const isConfirmedLocked = isBackendFairPlayLocked;
    const isLocalCheckPending =
      isImmediateViolationPending && !isConfirmedLocked;
    const isWarning =
      (isInGracePeriod || isLocalCheckPending) && !isConfirmedLocked;

    return (
      <View
        style={[
          styles.fairPlayBanner,
          isWarning && styles.fairPlayBannerGrace,
          isConfirmedLocked && styles.fairPlayBannerWarning,
        ]}
      >
        <MaterialIcons
          name={
            isConfirmedLocked
              ? "block"
              : isWarning
                ? "timer"
                : "verified-user"
          }
          size={20}
          color={
            isConfirmedLocked
              ? colors.red[500]
              : isWarning
                ? colors.peach[500]
                : colors.tea[400]
          }
        />
        <Text
          style={[
            styles.fairPlayText,
            isWarning && styles.fairPlayTextGrace,
            isConfirmedLocked && styles.fairPlayTextWarning,
          ]}
        >
          {isConfirmedLocked
            ? fairPlayStatus?.message ||
              `Fair Play strike ${fairPlayStrikeCount}/${fairPlayMaxStrikes}. You are frozen for this question.`
            : isWarning
              ? isLocalCheckPending
                ? "Fair Play check in progress. Return to the game to avoid a strike."
                : `Return to the game within ${fairPlayGraceSeconds} seconds to avoid a Fair Play strike.`
              : `Fair Play Mode active - ${fairPlayStrikeCount}/${fairPlayMaxStrikes} strikes`}
        </Text>
      </View>
    );
  };

  useEffect(() => {
    gameWebSocket.onQuestionReceived = (question: GameQuestion) => {
      const nextQuestionId = question.question_id ?? null;

      currentQuestionIdRef.current = nextQuestionId;

      setCurrentQuestion(question);
      resetBuzzerState(nextQuestionId);
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
      } else if (
        data.type === "buzzer_state_update" ||
        data.event_type === "buzzer_state_update"
      ) {
        applyAuthoritativeBuzzerState(data);
      } else if (
        data.type === "correct_answer" ||
        data.event_type === "correct_answer"
      ) {
        const matchStatus = getAnswerMatchStatus(data);
        setBuzzerState((prev) => ({
          ...prev,
          buttonState: "locked",
          isActive: false,
          canBuzz: false,
          canAnswer: false,
          statusText: matchStatus ? `Correct! ${matchStatus}` : "Correct!",
        }));
      } else if (
        data.type === "incorrect_answer" ||
        data.event_type === "incorrect_answer"
      ) {
        const matchStatus = getAnswerMatchStatus(data);
        clearSubmittedAnswerState();
        setBuzzerState((prev) => ({
          ...prev,
          buttonState: "frozen",
          isActive: false,
          canBuzz: false,
          canAnswer: false,
          statusText: matchStatus
            ? `Not quite. ${matchStatus}`
            : "Not quite. You're frozen for this question.",
        }));
      } else if (data.button_state || data.buttonState) {
        applyBackendButtonState(data);
      } else if (data.type === "buzzer_reset") {
        resetBuzzerState(currentQuestionIdRef.current);
        startGlowAnimation();
      } else if (data.type === "question_ended") {
        setBuzzerState((prev) => ({
          ...prev,
          isActive: false,
          canBuzz: false,
          canAnswer: false,
          buttonState: "waiting",
          transitioning: true,
          acceptingBuzzes: false,
          statusText: "Waiting for next question...",
        }));
        stopGlowAnimation();
      } else if (data.type === "next_question" && data.question) {
        setCurrentQuestion(data.question);
        resetBuzzerState(data.question.question_id ?? null);
        applyQuestionAnswerData(data.question);
        startGlowAnimation();
      }
    };

    gameWebSocket.onAnswerRejected = (data: any) => {
      if (data.reason === "fair_play_restriction") {
        setHasSubmittedAnswer(false);
        setSubmittedQuestionId(null);
        stopGlowAnimation();
        setBuzzerState((prev) => ({
          ...prev,
          buttonState: "frozen",
          isActive: false,
          canBuzz: false,
          canAnswer: false,
          statusText:
            data.message ||
            "You are frozen for this question because of Fair Play Mode.",
        }));
        return;
      }

      setHasSubmittedAnswer(false);
      setSubmittedQuestionId(null);
      onError(data.message || "Your action was rejected.");
    };

    gameWebSocket.onGameEnded = (_data: any) => {
      const handleEndedState = () => {
        const latestFairPlayStatus = fairPlayStatusRef.current;
        const wasKicked = Boolean(
          latestFairPlayStatus?.is_kicked ?? latestFairPlayStatus?.isKicked,
        );

        if (wasKicked) {
          return;
        }

        setIsGameActive(false);

        // Do not show Alert here.
        // GameContainer owns the dedicated end-game UI.
      };

      if (fairPlayEnabledRef.current) {
        if (gameEndedTimeoutRef.current) {
          clearTimeout(gameEndedTimeoutRef.current);
        }

        gameEndedTimeoutRef.current = setTimeout(handleEndedState, 800);
        return;
      }

      handleEndedState();
    };

    gameWebSocket.onGameStarted = (data: any) => {
      console.log("Game started; waiting for question_started.", data);
    };

    gameWebSocket.onError = (error: string) => {
      onError(error);
    };

    return () => {
      if (gameEndedTimeoutRef.current) {
        clearTimeout(gameEndedTimeoutRef.current);
        gameEndedTimeoutRef.current = null;
      }
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

  const isSubmittedAnswerWaiting =
    (hasSubmittedAnswer || submittedQuestionId === currentQuestionId) &&
    buzzerState.buttonState !== "frozen";
  const isQuestionTransitionWaiting =
    buzzerState.buttonState === "waiting" &&
    !buzzerState.acceptingBuzzes &&
    (buzzerState.transitioning ||
      /next question/i.test(buzzerState.statusText));
  const isWaitingForNextQuestion =
    (isSubmittedAnswerWaiting || isQuestionTransitionWaiting) &&
    !isFairPlayLocked;

  if (isWaitingForNextQuestion) {
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
      <View style={styles.gameContent}>
        <AppCard style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
        </AppCard>
        {renderFairPlayStatus()}

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
        !isFairPlayLocked &&
        (answerOptions.length > 0 ||
          currentQuestion?.ui_mode === "text_input") ? (
          <View style={styles.answerContainer}>
            {answerOptions.length > 0 ? (
              answerOptions.map((option, index) => (
                <TouchableOpacity
                  key={`${option}-${index}`}
                  style={[
                    styles.optionButton,
                    (hasSubmittedAnswer || isFairPlayLocked) &&
                      styles.optionButtonDisabled,
                  ]}
                  onPress={() => submitBuzzerAnswer(option)}
                  disabled={hasSubmittedAnswer || isFairPlayLocked}
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
                  editable={!hasSubmittedAnswer && !isFairPlayLocked}
                />
                <TouchableOpacity
                  style={[
                    styles.submitAnswerButton,
                    (!answerText.trim() ||
                      hasSubmittedAnswer ||
                      isFairPlayLocked) &&
                      styles.optionButtonDisabled,
                  ]}
                  onPress={() => submitBuzzerAnswer(answerText.trim())}
                  disabled={
                    !answerText.trim() || hasSubmittedAnswer || isFairPlayLocked
                  }
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
                disabled={
                  !buzzerState.canBuzz ||
                  !buzzerState.isActive ||
                  isFairPlayLocked
                }
                activeOpacity={0.8}
              >
                <View style={styles.buzzerButtonContent}>
                  <MaterialIcons
                    name={
                      isFairPlayLocked || buzzerState.buttonState === "frozen"
                        ? "block"
                        : buzzerState.winner
                          ? "check-circle"
                          : "touch-app"
                    }
                    size={64}
                    color={colors.white}
                  />
                  <Text style={styles.buzzerButtonText}>
                    {isFairPlayLocked || buzzerState.buttonState === "frozen"
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

            <Text style={styles.instructionText}>{buzzerState.statusText}</Text>
          </View>
        )}

        <View style={styles.statusContainer}>
          <MaterialIcons name="timer" size={20} color={colors.stone[400]} />
          <Text style={styles.statusText}>
            {isFairPlayLocked
              ? "Fair Play freeze. Wait for the next question."
              : buzzerState.isActive
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
  fairPlayBannerGrace: {
    borderColor: colors.peach[500],
    backgroundColor: colors.peach[500] + "14",
  },
  fairPlayText: {
    ...typography.body,
    color: colors.stone[300],
    flex: 1,
    fontWeight: "600",
  },
  fairPlayTextGrace: {
    color: colors.stone[100],
  },
  fairPlayTextWarning: {
    color: colors.stone[100],
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
