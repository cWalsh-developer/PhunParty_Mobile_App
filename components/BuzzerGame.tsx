import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
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
  transitionWaitingQuestionId?: string | null;
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
  transitionWaitingQuestionId: externalTransitionWaitingQuestionId,
  onFairPlayFocusLost,
  onFairPlayFocusReturned,
  onGameEnd,
  onError,
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestion | null>(
    null,
  );
  const initialBuzzerState: BuzzerState = {
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
  };

  const [buzzerState, setBuzzerStateState] =
    useState<BuzzerState>(initialBuzzerState);

  const buzzerStateRef = useRef<BuzzerState>(initialBuzzerState);
  const answerModeQuestionIdRef = useRef<string | null>(null);

  const setBuzzerState = useCallback(
    (update: React.SetStateAction<BuzzerState>) => {
      const previousState = buzzerStateRef.current;

      const nextState =
        typeof update === "function"
          ? (update as (previous: BuzzerState) => BuzzerState)(previousState)
          : update;

      // Important: update the ref immediately, before React re-renders.
      buzzerStateRef.current = nextState;
      setBuzzerStateState(nextState);
    },
    [],
  );
  const [answerOptions, setAnswerOptions] = useState<string[]>([]);
  const [answerText, setAnswerText] = useState("");
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [submittedQuestionId, setSubmittedQuestionId] = useState<string | null>(
    null,
  );
  const [waitingForNextQuestionId, setWaitingForNextQuestionId] = useState<
    string | null
  >(null);
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
  const waitingForNextQuestionIdRef = useRef<string | null>(null);
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

  const isFairPlayLocked = fairPlayEnabled && isBackendFairPlayLocked;

  useEffect(() => {
    fairPlayStatusRef.current = fairPlayStatus;
    fairPlayEnabledRef.current = fairPlayEnabled;
  }, [fairPlayEnabled, fairPlayStatus]);

  useEffect(() => {
    submittedQuestionIdRef.current = submittedQuestionId;
  }, [submittedQuestionId]);

  useEffect(() => {
    waitingForNextQuestionIdRef.current = waitingForNextQuestionId;
  }, [waitingForNextQuestionId]);

  useEffect(() => {
    if (
      externalTransitionWaitingQuestionId &&
      externalTransitionWaitingQuestionId === currentQuestionId
    ) {
      waitingForNextQuestionIdRef.current = externalTransitionWaitingQuestionId;
      setWaitingForNextQuestionId(externalTransitionWaitingQuestionId);
      setBuzzerState((prev) => ({
        ...prev,
        buttonState: "waiting",
        isActive: false,
        canBuzz: false,
        canAnswer: false,
        transitioning: true,
        acceptingBuzzes: false,
        statusText: "Waiting for next question...",
      }));
      stopGlowAnimation();
    }
  }, [currentQuestionId, externalTransitionWaitingQuestionId]);

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
    if (!fairPlayLockedQuestionId) {
      return;
    }

    const lockedQuestionChanged =
      !!currentQuestionId && fairPlayLockedQuestionId !== currentQuestionId;

    const backendStillLocksThisQuestion =
      isKickedByFairPlay || isFrozenForRenderedQuestion;

    if (lockedQuestionChanged || !backendStillLocksThisQuestion) {
      const unlockTimeout = setTimeout(() => {
        console.log("[BuzzerGame] Clearing local Fair Play lock", {
          fairPlayLockedQuestionId,
          currentQuestionId,
          lockedQuestionChanged,
          backendStillLocksThisQuestion,
        });

        setFairPlayLockedQuestionId(null);
      }, 0);

      return () => clearTimeout(unlockTimeout);
    }
  }, [
    currentQuestionId,
    fairPlayLockedQuestionId,
    isFrozenForRenderedQuestion,
    isKickedByFairPlay,
  ]);

  useEffect(() => {
    if (!isFairPlayLocked) {
      return;
    }

    const freezeTimeout = setTimeout(() => {
      clearSubmittedAnswerState();
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

      if (!response.isSuccess || !response.result) {
        return;
      }

      const questionData = response.result;
      const fetchedQuestionId = questionData.question_id ?? null;

      if (!fetchedQuestionId) {
        return;
      }

      const currentBuzzer = buzzerStateRef.current;
      const currentQuestionId = currentQuestionIdRef.current;
      const answerModeQuestionId = answerModeQuestionIdRef.current;
      const isSameQuestion = fetchedQuestionId === currentQuestionId;
      const isNewQuestion = fetchedQuestionId !== currentQuestionId;

      /*
      fetchCurrentQuestion is only a fallback/resync.
      It must not reset the buzzer if this device is already in a live state
      for the same question, especially answer_mode after winning the buzzer.
    */
      if (
        isSameQuestion &&
        answerModeQuestionId === fetchedQuestionId &&
        currentBuzzer.buttonState === "answer_mode"
      ) {
        console.log(
          "[BuzzerGame] Ignoring fetchCurrentQuestion while in answer_mode",
          {
            fetchedQuestionId,
            currentQuestionId,
            answerModeQuestionId,
            buttonState: currentBuzzer.buttonState,
          },
        );

        return;
      }

      if (isSameQuestion && currentBuzzer.buttonState !== "active") {
        console.log(
          "[BuzzerGame] Ignoring fetchCurrentQuestion reset for same active state",
          {
            fetchedQuestionId,
            currentQuestionId,
            buttonState: currentBuzzer.buttonState,
          },
        );

        return;
      }

      const question: GameQuestion = {
        question_id: fetchedQuestionId,
        question: questionData.question,
        game_type: "buzzer",
        ui_mode: "buzzer",
      };

      currentQuestionIdRef.current = fetchedQuestionId;
      setCurrentQuestion(question);

      resetBuzzerState(fetchedQuestionId, isNewQuestion);

      if (isNewQuestion || currentBuzzer.buttonState === "active") {
        startGlowAnimation();
      }
    } catch (error) {
      console.log("[BuzzerGame] fetchCurrentQuestion failed", error);
    }
  };
  void fetchCurrentQuestion;

  const clearSubmittedAnswerState = () => {
    submittedQuestionIdRef.current = null;
    waitingForNextQuestionIdRef.current = null;
    setHasSubmittedAnswer(false);
    setSubmittedQuestionId(null);
    setWaitingForNextQuestionId(null);
  };

  const setSubmittedAnswerState = (questionId: string) => {
    submittedQuestionIdRef.current = questionId;
    waitingForNextQuestionIdRef.current = questionId;
    setHasSubmittedAnswer(true);
    setSubmittedQuestionId(questionId);
    setWaitingForNextQuestionId(questionId);
  };

  const resetBuzzerState = (
    questionId: string | null = currentQuestionId ?? null,
    forceReset: boolean = false,
  ) => {
    const currentBuzzer = buzzerStateRef.current;
    const targetQuestionId = questionId ?? currentQuestionIdRef.current;
    const answerModeQuestionId = answerModeQuestionIdRef.current;

    if (
      !forceReset &&
      answerModeQuestionId &&
      targetQuestionId === answerModeQuestionId &&
      currentBuzzer.buttonState === "answer_mode"
    ) {
      console.log(
        "[BuzzerGame] Ignoring resetBuzzerState while in answer_mode",
        {
          targetQuestionId,
          answerModeQuestionId,
          currentButtonState: currentBuzzer.buttonState,
        },
      );

      return;
    }

    if (
      targetQuestionId &&
      targetQuestionId !== answerModeQuestionIdRef.current
    ) {
      answerModeQuestionIdRef.current = null;
    }
    const isSubmittedQuestion =
      !!questionId && submittedQuestionIdRef.current === questionId;
    const isWaitingQuestion =
      !!questionId && waitingForNextQuestionIdRef.current === questionId;

    setAnswerOptions([]);
    if (!isSubmittedQuestion && !isWaitingQuestion) {
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

    const updateQuestionId =
      data.question_id ??
      data.questionId ??
      data.question?.question_id ??
      data.question?.questionId ??
      null;

    const isTransitioning = !!(data.transitioning ?? data.isTransitioning);

    const acceptingBuzzes = !!(
      data.accepting_buzzes ??
      data.acceptingBuzzes ??
      buttonState === "active"
    );

    const winner =
      data.current_buzzer_winner ??
      data.currentBuzzerWinner ??
      data.winner ??
      data.winner_name ??
      null;

    const message =
      data.message || getStatusTextForButtonState(buttonState, data);

    if (updateQuestionId) {
      currentQuestionIdRef.current = updateQuestionId;
    }

    const effectiveQuestionId =
      updateQuestionId || currentQuestionIdRef.current;

    console.log("[BuzzerGame] applyBackendButtonState", {
      buttonState,
      isCurrentPlayer,
      updateQuestionId,
      effectiveQuestionId,
      acceptingBuzzes,
      isTransitioning,
      winner,
      message,
    });

    if (buttonState === "answer_mode" && isCurrentPlayer) {
      if (!effectiveQuestionId) {
        console.log(
          "[BuzzerGame] Refusing answer_mode without question_id",
          data,
        );
        return;
      }

      currentQuestionIdRef.current = effectiveQuestionId;
      answerModeQuestionIdRef.current = effectiveQuestionId;

      clearSubmittedAnswerState();
      applyQuestionAnswerData(data);

      const nextState: BuzzerState = {
        ...buzzerStateRef.current,
        buttonState: "answer_mode",
        questionId: effectiveQuestionId,
        transitioning: false,
        acceptingBuzzes: false,
        winner: winner || buzzerStateRef.current.winner,
        isActive: false,
        canBuzz: false,
        canAnswer: true,
        statusText: message || "You buzzed first. Answer now!",
      };

      console.log("[BuzzerGame] Applying answer_mode from backend", {
        effectiveQuestionId,
        nextState,
      });

      setBuzzerState(nextState);
      stopGlowAnimation();
      return;
    }

    if (buttonState === "active") {
      const currentBuzzer = buzzerStateRef.current;
      const answerModeQuestionId = answerModeQuestionIdRef.current;

      if (
        answerModeQuestionId &&
        effectiveQuestionId === answerModeQuestionId &&
        currentBuzzer.buttonState === "answer_mode"
      ) {
        console.log(
          "[BuzzerGame] Ignoring active backend state while in answer_mode",
          {
            effectiveQuestionId,
            answerModeQuestionId,
            currentButtonState: currentBuzzer.buttonState,
          },
        );

        return;
      }

      clearSubmittedAnswerState();

      const nextState: BuzzerState = {
        ...buzzerStateRef.current,
        buttonState: "active",
        questionId: effectiveQuestionId || buzzerStateRef.current.questionId,
        transitioning: false,
        acceptingBuzzes: true,
        winner: null,
        isActive: true,
        canBuzz: true,
        canAnswer: false,
        statusText: message || "Press to buzz in!",
      };

      setBuzzerState(nextState);
      startGlowAnimation();
      return;
    }

    if (buttonState === "waiting") {
      const currentBuzzer = buzzerStateRef.current;
      const answerModeQuestionId = answerModeQuestionIdRef.current;

      if (
        answerModeQuestionId &&
        effectiveQuestionId === answerModeQuestionId &&
        currentBuzzer.buttonState === "answer_mode"
      ) {
        console.log(
          "[BuzzerGame] Ignoring waiting backend state while in answer_mode",
          {
            effectiveQuestionId,
            answerModeQuestionId,
            currentButtonState: currentBuzzer.buttonState,
            message,
          },
        );

        return;
      }
      const nextState: BuzzerState = {
        ...buzzerStateRef.current,
        buttonState: "waiting",
        questionId: effectiveQuestionId || buzzerStateRef.current.questionId,
        transitioning: isTransitioning,
        acceptingBuzzes: false,
        winner: winner || null,
        isActive: false,
        canBuzz: false,
        canAnswer: false,
        statusText: message || "Waiting...",
      };

      setBuzzerState(nextState);
      stopGlowAnimation();
      return;
    }

    if (buttonState === "frozen") {
      clearSubmittedAnswerState();

      const nextState: BuzzerState = {
        ...buzzerStateRef.current,
        buttonState: "frozen",
        questionId: effectiveQuestionId || buzzerStateRef.current.questionId,
        transitioning: false,
        acceptingBuzzes: false,
        winner: winner || buzzerStateRef.current.winner,
        isActive: false,
        canBuzz: false,
        canAnswer: false,
        statusText: message || "You're frozen out this round!",
      };

      setBuzzerState(nextState);
      stopGlowAnimation();
      return;
    }

    if (buttonState === "locked") {
      const nextState: BuzzerState = {
        ...buzzerStateRef.current,
        buttonState: "locked",
        questionId: effectiveQuestionId || buzzerStateRef.current.questionId,
        transitioning: isTransitioning,
        acceptingBuzzes: false,
        winner: winner || buzzerStateRef.current.winner,
        isActive: false,
        canBuzz: false,
        canAnswer: false,
        statusText: message || "Buzzer locked.",
      };

      setBuzzerState(nextState);
      stopGlowAnimation();
      return;
    }
  };

  const applyAuthoritativeBuzzerState = (data: any) => {
    const updateQuestionId = data.question_id ?? data.questionId ?? null;
    const activeQuestionId = currentQuestionIdRef.current;

    if (
      updateQuestionId &&
      activeQuestionId &&
      updateQuestionId !== activeQuestionId
    ) {
      console.log("[BuzzerGame] Ignoring stale authoritative buzzer state", {
        updateQuestionId,
        activeQuestionId,
        data,
      });
      return;
    }

    const myPlayerId = gameWebSocket.playerInfo?.player_id;
    const myRosterPlayerId =
      gameWebSocket.getConnectionDiagnostics().rosterPlayerId;

    const currentWinner =
      data.current_buzzer_winner ?? data.currentBuzzerWinner ?? null;

    const currentWinnerRosterId =
      data.current_buzzer_winner_roster_id ??
      data.currentBuzzerWinnerRosterId ??
      null;

    const frozenPlayers = Array.isArray(data.frozen_players)
      ? data.frozen_players
      : Array.isArray(data.frozenPlayers)
        ? data.frozenPlayers
        : [];

    const frozenRosterPlayers = Array.isArray(data.frozen_roster_player_ids)
      ? data.frozen_roster_player_ids
      : Array.isArray(data.frozenRosterPlayerIds)
        ? data.frozenRosterPlayerIds
        : [];

    const questionActive = !!(data.question_active ?? data.questionActive);
    const isTransitioning = !!(data.transitioning ?? data.isTransitioning);

    const acceptingBuzzes = !!(data.accepting_buzzes ?? data.acceptingBuzzes);

    const isFrozen =
      (!!myPlayerId &&
        frozenPlayers.some(
          (id: unknown) => String(id).trim() === String(myPlayerId).trim(),
        )) ||
      (!!myRosterPlayerId &&
        frozenRosterPlayers.some(
          (id: unknown) =>
            String(id).trim() === String(myRosterPlayerId).trim(),
        ));

    const isWinner =
      (!!myPlayerId &&
        !!currentWinner &&
        String(currentWinner).trim() === String(myPlayerId).trim()) ||
      (!!myRosterPlayerId &&
        !!currentWinnerRosterId &&
        String(currentWinnerRosterId).trim() ===
          String(myRosterPlayerId).trim());

    const currentLocalState = buzzerStateRef.current;
    const effectiveQuestionId = updateQuestionId || activeQuestionId;

    /*
    Important:
    Generic buzzer_state_update messages do not carry answer options.
    If this player is already in answer_mode from a personal ui_update,
    do not let a generic waiting update wipe the answer screen.
  */
    if (
      currentLocalState.buttonState === "answer_mode" &&
      effectiveQuestionId === currentLocalState.questionId
    ) {
      console.log(
        "[BuzzerGame] Keeping local answer_mode over generic buzzer state",
        {
          effectiveQuestionId,
          currentWinner,
          isWinner,
          currentLocalQuestionId: currentLocalState.questionId,
        },
      );

      return;
    }

    let nextButtonState: BuzzerState["buttonState"] = "waiting";
    let nextStatusText = data.message || "Waiting for the next question...";

    if (isFrozen) {
      nextButtonState = "frozen";
      nextStatusText = "You're frozen for this question.";
      clearSubmittedAnswerState();
    } else if (isWinner) {
      // Do not switch to answer_mode here. The personal ui_update does that,
      // because it includes the actual answer payload/options.
      nextButtonState =
        currentLocalState.buttonState === "answer_mode"
          ? "answer_mode"
          : "waiting";
      nextStatusText =
        currentLocalState.buttonState === "answer_mode"
          ? currentLocalState.statusText
          : "Waiting for answer screen...";
    } else if (currentWinner) {
      nextButtonState = "waiting";
      nextStatusText = "Another player buzzed first.";
    } else if (isTransitioning || !questionActive) {
      nextButtonState = "waiting";
      nextStatusText = data.message || "Waiting for the next question...";
    } else if (acceptingBuzzes) {
      nextButtonState = "active";
      nextStatusText = "Tap to buzz in first!";
    }

    const canBuzz =
      nextButtonState === "active" &&
      acceptingBuzzes &&
      !isTransitioning &&
      !currentWinner;

    const nextState: BuzzerState = {
      ...currentLocalState,
      buttonState: nextButtonState,
      questionId: effectiveQuestionId || currentLocalState.questionId,
      transitioning: isTransitioning,
      acceptingBuzzes,
      winner: currentWinner || null,
      isActive: canBuzz,
      canBuzz,
      canAnswer: nextButtonState === "answer_mode",
      statusText: nextStatusText,
    };

    setBuzzerState(nextState);

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

  const isPayloadForCurrentPlayer = (data: any) => {
    const myPlayerId = gameWebSocket.playerInfo?.player_id;
    const myRosterPlayerId =
      gameWebSocket.getConnectionDiagnostics().rosterPlayerId;
    const payloadPlayerId =
      data?.player_id ??
      data?.playerId ??
      data?.participant_id ??
      data?.roster_player_id ??
      data?.rosterPlayerId;

    if (data?.is_current_player === true || data?.isCurrentPlayer === true) {
      return true;
    }

    return (
      (!!myPlayerId || !!myRosterPlayerId) &&
      !!payloadPlayerId &&
      (String(myPlayerId).trim() === String(payloadPlayerId).trim() ||
        String(myRosterPlayerId).trim() === String(payloadPlayerId).trim())
    );
  };

  const isCurrentPlayerFrozenInPayload = (data: any) => {
    const myPlayerId = gameWebSocket.playerInfo?.player_id;
    const myRosterPlayerId =
      gameWebSocket.getConnectionDiagnostics().rosterPlayerId;
    const frozenPlayers = Array.isArray(data?.frozen_players)
      ? data.frozen_players
      : Array.isArray(data?.frozenPlayers)
        ? data.frozenPlayers
        : [];
    const frozenRosterPlayers = Array.isArray(data?.frozen_roster_player_ids)
      ? data.frozen_roster_player_ids
      : Array.isArray(data?.frozenRosterPlayerIds)
        ? data.frozenRosterPlayerIds
        : [];

    return (
      (!!myPlayerId &&
        frozenPlayers.some(
          (playerId: unknown) =>
            String(playerId).trim() === String(myPlayerId).trim(),
        )) ||
      (!!myRosterPlayerId &&
        frozenRosterPlayers.some(
          (playerId: unknown) =>
            String(playerId).trim() === String(myRosterPlayerId).trim(),
        ))
    );
  };

  const applyQuestionAnswerData = (data: any) => {
    const questionId =
      data.question_id ??
      data.questionId ??
      data.question?.question_id ??
      data.question?.questionId ??
      null;

    const questionText =
      data.question_text ??
      data.questionText ??
      data.question?.question ??
      data.question ??
      "";

    const difficulty =
      data.difficulty ??
      data.question?.difficulty ??
      currentQuestion?.difficulty;

    const displayOptions =
      data.display_options ??
      data.displayOptions ??
      data.options ??
      data.question?.display_options ??
      data.question?.displayOptions ??
      data.question?.options ??
      [];

    const uiMode =
      data.ui_mode ??
      data.uiMode ??
      data.question?.ui_mode ??
      data.question?.uiMode ??
      (Array.isArray(displayOptions) && displayOptions.length > 0
        ? "multiple_choice"
        : "text_input");

    console.log("[BuzzerGame] applyQuestionAnswerData", {
      questionId,
      questionText,
      uiMode,
      displayOptions,
      rawData: data,
    });

    if (!questionId) {
      console.log(
        "[BuzzerGame] Cannot apply answer data without question_id",
        data,
      );
      return;
    }

    currentQuestionIdRef.current = questionId;

    const nextQuestion: GameQuestion = {
      ...(currentQuestion ?? {}),
      ...(typeof data.question === "object" ? data.question : {}),
      question_id: questionId,
      question: String(questionText || ""),
      game_type: "buzzer",
      ui_mode: uiMode,
      difficulty,
      display_options: Array.isArray(displayOptions) ? displayOptions : [],
      options: Array.isArray(displayOptions) ? displayOptions : [],
      button_state: "answer_mode",
      is_current_player: true,
    };

    // Critical: replace the rendered question when answer_mode arrives.
    // Do not rely on whatever currentQuestion happened to be before the buzz.
    setCurrentQuestion(nextQuestion);

    if (Array.isArray(displayOptions) && displayOptions.length > 0) {
      setAnswerOptions(displayOptions.map(String));
      setAnswerText("");
    } else {
      setAnswerOptions([]);
      setAnswerText("");
    }

    setFairPlayLockedQuestionId(null);
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
      const immediateViolation = await hasImmediateFairPlayWindowViolation({
        includeWindowFocusLoss: false,
      });

      if (immediateViolation) {
        handleFairPlayViolation(
          currentQuestion.question_id,
          immediateViolation,
        );
      }
    }

    const answerValue = String(answer).trim();

    const activeQuestionId = currentQuestionIdRef.current;
    const renderedQuestionId = currentQuestion?.question_id ?? null;
    const buzzerQuestionId = buzzerState.questionId ?? null;

    if (!answerValue) {
      onError("Please enter an answer.");
      return;
    }

    if (!activeQuestionId || !renderedQuestionId) {
      console.log(
        "[BuzzerGame] Blocked answer submit because no active question exists",
        {
          activeQuestionId,
          renderedQuestionId,
          buzzerQuestionId,
        },
      );

      onError("No active question to answer.");
      return;
    }

    if (
      renderedQuestionId !== activeQuestionId ||
      (buzzerQuestionId && buzzerQuestionId !== activeQuestionId)
    ) {
      console.log("[BuzzerGame] Blocked stale answer submit", {
        activeQuestionId,
        renderedQuestionId,
        buzzerQuestionId,
        answerValue,
      });

      setAnswerText("");
      setAnswerOptions([]);
      clearSubmittedAnswerState();

      setBuzzerState((prev) => ({
        ...prev,
        buttonState: "waiting",
        isActive: false,
        canBuzz: false,
        canAnswer: false,
        transitioning: true,
        acceptingBuzzes: false,
        statusText: "Syncing next question...",
      }));

      gameWebSocket.requestCurrentQuestion();
      return;
    }

    const sent = gameWebSocket.submitAnswer(answerValue, activeQuestionId);

    if (!sent) {
      onError("Failed to submit answer. Please check your connection.");
      return;
    }

    setSubmittedAnswerState(activeQuestionId);

    setBuzzerState((prev) => ({
      ...prev,
      buttonState: "locked",
      isActive: false,
      canBuzz: false,
      canAnswer: false,
      transitioning: true,
      acceptingBuzzes: false,
      statusText: "Answer submitted. Waiting for result...",
    }));
  };

  const handleBuzzerPress = () => {
    const questionId =
      currentQuestionIdRef.current ||
      currentQuestion?.question_id ||
      buzzerState.questionId ||
      null;

    console.log("[BuzzerGame] Buzzer press attempted", {
      questionId,
      currentQuestionRef: currentQuestionIdRef.current,
      currentQuestionId: currentQuestion?.question_id,
      buzzerQuestionId: buzzerState.questionId,
      buttonState: buzzerState.buttonState,
      canBuzz: buzzerState.canBuzz,
      acceptingBuzzes: buzzerState.acceptingBuzzes,
      transitioning: buzzerState.transitioning,
      isFairPlayLocked,
      isImmediateViolationPending,
      isInGracePeriod,
    });

    if (isFairPlayLocked) {
      console.log("[BuzzerGame] Buzzer blocked by backend Fair Play lock");
      return;
    }

    if (!questionId) {
      console.log("[BuzzerGame] Buzzer blocked because no question ID exists");
      gameWebSocket.requestCurrentQuestion();
      return;
    }

    if (answerModeQuestionIdRef.current === questionId) {
      console.log(
        "[BuzzerGame] Blocking stale buzzer press because this device is already the answer-mode player",
        {
          questionId,
          answerModeQuestionId: answerModeQuestionIdRef.current,
          currentButtonState: buzzerStateRef.current.buttonState,
        },
      );

      setBuzzerState((prev) => ({
        ...prev,
        buttonState: "answer_mode",
        questionId,
        isActive: false,
        canBuzz: false,
        canAnswer: true,
        transitioning: false,
        acceptingBuzzes: false,
        statusText: "You buzzed first. Choose your answer.",
      }));

      stopGlowAnimation();
      return;
    }

    const sent = gameWebSocket.pressBuzzer(questionId);

    console.log("[BuzzerGame] Buzzer press sent", {
      sent,
      questionId,
    });

    if (!sent) {
      onError("Failed to buzz in. Please check your connection.");
      return;
    }

    setBuzzerState((prev) => ({
      ...prev,
      buttonState: "waiting",
      isActive: false,
      canBuzz: false,
      canAnswer: false,
      transitioning: false,
      acceptingBuzzes: false,
      statusText: "Buzz sent...",
    }));

    stopGlowAnimation();
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
    const buttonState = buzzerState.buttonState;

    let buttonStyle = { ...styles.buzzerButton };

    if (isFairPlayLocked || buttonState === "frozen") {
      buttonStyle = { ...buttonStyle, ...styles.buzzerButtonFrozen };
    } else if (buttonState === "active") {
      buttonStyle = { ...buttonStyle, ...styles.buzzerButtonActive };
    } else if (buttonState === "answer_mode") {
      buttonStyle = { ...buttonStyle, ...styles.buzzerButtonPressed };
    } else if (buttonState === "waiting" || buttonState === "locked") {
      buttonStyle = { ...buttonStyle, ...styles.buzzerButtonPressed };
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
            isConfirmedLocked ? "block" : isWarning ? "timer" : "verified-user"
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
      const previousQuestionId = currentQuestionIdRef.current;
      const latestBuzzerState = buzzerStateRef.current;
      const incomingButtonState =
        question.button_state || question.buttonState || null;

      console.log("[BuzzerGame] Question received", {
        nextQuestionId,
        previousQuestionId,
        incomingButtonState,
        uiMode: question.ui_mode,
        latestButtonState: latestBuzzerState.buttonState,
        latestCanAnswer: latestBuzzerState.canAnswer,
      });

      if (!nextQuestionId) {
        console.log(
          "[BuzzerGame] Ignoring question without question_id",
          question,
        );
        return;
      }

      const isSameQuestion = nextQuestionId === previousQuestionId;
      const answerModeQuestionId = answerModeQuestionIdRef.current;

      if (
        isSameQuestion &&
        answerModeQuestionId === nextQuestionId &&
        latestBuzzerState.buttonState === "answer_mode"
      ) {
        console.log(
          "[BuzzerGame] Ignoring question update while in answer_mode",
          {
            nextQuestionId,
            answerModeQuestionId,
            latestButtonState: latestBuzzerState.buttonState,
            incomingButtonState,
          },
        );

        return;
      }

      /*
    Critical:
    question_started is sent as a critical/ACK message and can arrive again.
    If this is the same question and it is trying to reopen the buzzer as active,
    do not let it override answer_mode, waiting, locked, or frozen.
  */
      if (
        isSameQuestion &&
        incomingButtonState === "active" &&
        latestBuzzerState.buttonState !== "active"
      ) {
        console.log("[BuzzerGame] Ignoring duplicate active question_started", {
          nextQuestionId,
          latestButtonState: latestBuzzerState.buttonState,
          latestCanAnswer: latestBuzzerState.canAnswer,
        });
        return;
      }

      currentQuestionIdRef.current = nextQuestionId;

      const isNewQuestion = nextQuestionId !== previousQuestionId;

      if (isNewQuestion) {
        console.log(
          "[BuzzerGame] New question detected, clearing old answer state",
          {
            previousQuestionId,
            nextQuestionId,
          },
        );

        setAnswerText("");
        setAnswerOptions([]);
        clearSubmittedAnswerState();
        setFairPlayLockedQuestionId(null);
        stopWinnerAnimation();
        stopGlowAnimation();
      }

      setCurrentQuestion({
        ...question,
        question_id: nextQuestionId,
        game_type: "buzzer",
        ui_mode: question.ui_mode || "buzzer",
      });

      resetBuzzerState(nextQuestionId, isNewQuestion);

      if (incomingButtonState) {
        applyBackendButtonState(question);
      } else {
        startGlowAnimation();
      }
    };

    gameWebSocket.onBuzzerUpdate = (data: any) => {
      const eventType = data.type || data.event_type;
      const buttonState = data.button_state || data.buttonState || null;

      console.log("[BuzzerGame] onBuzzerUpdate", {
        eventType,
        buttonState,
        questionId: data.question_id ?? data.questionId,
        isCurrentPlayer: data.is_current_player ?? data.isCurrentPlayer,
        acceptingBuzzes: data.accepting_buzzes ?? data.acceptingBuzzes,
        transitioning: data.transitioning ?? data.isTransitioning,
        message: data.message,
      });

      /*
    Personal ui_update messages are authoritative for this device.
    They can set:
    - answer_mode for the buzzer winner
    - waiting for non-winners
    - active for available players after a wrong answer
    - frozen for players who answered wrong
  */
      if (eventType === "ui_update" && buttonState) {
        applyBackendButtonState(data);
        return;
      }

      /*
    Generic buzzer_state_update is session-wide.
    It must not be treated like a personal ui_update because it does not
    include answer payload/options.
  */
      if (eventType === "buzzer_state_update") {
        applyAuthoritativeBuzzerState(data);
        return;
      }

      if (eventType === "buzzer_winner") {
        Vibration.vibrate(500);
        return;
      }

      if (eventType === "correct_answer") {
        const matchStatus = getAnswerMatchStatus(data);
        const isMyAnswer = isPayloadForCurrentPlayer(data);

        const nextState: BuzzerState = {
          ...buzzerStateRef.current,
          buttonState: "waiting",
          isActive: false,
          canBuzz: false,
          canAnswer: false,
          transitioning: true,
          acceptingBuzzes: false,
          statusText: isMyAnswer
            ? matchStatus
              ? `Correct! ${matchStatus}`
              : "Correct!"
            : "Waiting for next question...",
        };

        setBuzzerState(nextState);
        stopGlowAnimation();
        return;
      }

      if (eventType === "incorrect_answer") {
        const shouldFreezeCurrentPlayer =
          isPayloadForCurrentPlayer(data) ||
          isCurrentPlayerFrozenInPayload(data);

        if (!shouldFreezeCurrentPlayer) {
          return;
        }

        const matchStatus = getAnswerMatchStatus(data);

        clearSubmittedAnswerState();

        const nextState: BuzzerState = {
          ...buzzerStateRef.current,
          buttonState: "frozen",
          isActive: false,
          canBuzz: false,
          canAnswer: false,
          transitioning: false,
          acceptingBuzzes: false,
          statusText: matchStatus
            ? `Not quite. ${matchStatus}`
            : "Not quite. You're frozen for this question.",
        };

        setBuzzerState(nextState);
        stopGlowAnimation();
        return;
      }

      if (eventType === "question_ended") {
        const nextState: BuzzerState = {
          ...buzzerStateRef.current,
          buttonState: "waiting",
          isActive: false,
          canBuzz: false,
          canAnswer: false,
          transitioning: true,
          acceptingBuzzes: false,
          statusText: "Waiting for next question...",
        };

        setBuzzerState(nextState);
        stopGlowAnimation();
        return;
      }

      if (eventType === "buzzer_reset") {
        const currentBuzzer = buzzerStateRef.current;
        const resetQuestionId = currentQuestionIdRef.current;
        const answerModeQuestionId = answerModeQuestionIdRef.current;

        if (
          answerModeQuestionId &&
          resetQuestionId === answerModeQuestionId &&
          currentBuzzer.buttonState === "answer_mode"
        ) {
          console.log(
            "[BuzzerGame] Ignoring buzzer_reset while in answer_mode",
            {
              resetQuestionId,
              answerModeQuestionId,
              currentButtonState: currentBuzzer.buttonState,
            },
          );

          return;
        }

        clearSubmittedAnswerState();
        setAnswerText("");
        setAnswerOptions([]);
        resetBuzzerState(resetQuestionId);
        startGlowAnimation();
        return;
      }

      if (buttonState) {
        console.log(
          "[BuzzerGame] Ignoring button_state from non-authoritative event",
          {
            eventType,
            buttonState,
            questionId: data.question_id ?? data.questionId,
          },
        );
      }
    };

    gameWebSocket.onAnswerRejected = (data: any) => {
      if (data.reason === "fair_play_restriction") {
        clearSubmittedAnswerState();
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

      clearSubmittedAnswerState();
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
    (hasSubmittedAnswer ||
      submittedQuestionId === currentQuestionId ||
      waitingForNextQuestionId === currentQuestionId) &&
    buzzerState.buttonState !== "frozen";
  const isQuestionTransitionWaiting =
    buzzerState.buttonState === "waiting" &&
    !buzzerState.acceptingBuzzes &&
    (buzzerState.transitioning ||
      /next question/i.test(buzzerState.statusText));
  const isWaitingForNextQuestion =
    isQuestionTransitionWaiting ||
    (isSubmittedAnswerWaiting && !isFairPlayLocked);
  const isTextInputAnswerMode =
    currentQuestion.ui_mode === "text_input" ||
    String(currentQuestion.difficulty || "").toLowerCase() === "hard";
  const visibleAnswerOptions = isTextInputAnswerMode ? [] : answerOptions;

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
    >
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
        (visibleAnswerOptions.length > 0 || isTextInputAnswerMode) ? (
          <View style={styles.answerContainer}>
            {visibleAnswerOptions.length > 0 ? (
              visibleAnswerOptions.map((option, index) => (
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
                  autoCapitalize="none"
                  autoCorrect
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    const trimmedAnswer = answerText.trim();
                    if (
                      trimmedAnswer &&
                      !hasSubmittedAnswer &&
                      !isFairPlayLocked
                    ) {
                      submitBuzzerAnswer(trimmedAnswer);
                    }
                  }}
                />
                {!!answerText.trim() &&
                  !hasSubmittedAnswer &&
                  !isFairPlayLocked && (
                    <TouchableOpacity
                      style={styles.submitAnswerButton}
                      onPress={() => submitBuzzerAnswer(answerText.trim())}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.submitAnswerText}>Submit Answer</Text>
                    </TouchableOpacity>
                  )}
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
                  isFairPlayLocked ||
                  buzzerState.buttonState === "waiting" ||
                  buzzerState.buttonState === "locked" ||
                  buzzerState.buttonState === "frozen" ||
                  buzzerState.buttonState === "answer_mode"
                }
                activeOpacity={0.8}
              >
                <View style={styles.buzzerButtonContent}>
                  <MaterialIcons
                    name={
                      isFairPlayLocked || buzzerState.buttonState === "frozen"
                        ? "block"
                        : buzzerState.buttonState === "answer_mode"
                          ? "edit"
                          : buzzerState.buttonState === "waiting" ||
                              buzzerState.buttonState === "locked"
                            ? "hourglass-empty"
                            : "touch-app"
                    }
                    size={64}
                    color={colors.white}
                  />

                  <Text style={styles.buzzerButtonText}>
                    {isFairPlayLocked || buzzerState.buttonState === "frozen"
                      ? "Frozen"
                      : buzzerState.buttonState === "answer_mode"
                        ? "Answer"
                        : buzzerState.buttonState === "waiting" ||
                            buzzerState.buttonState === "locked"
                          ? "Wait..."
                          : "BUZZ!"}
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
    </KeyboardAvoidingView>
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
