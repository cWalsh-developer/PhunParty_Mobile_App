import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
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
import { partyColors, partyFonts } from "@/assets/theme/party";
import { PartyButton } from "@/components/party/party-button";
import {
  hasImmediateFairPlayWindowViolation,
  useFairPlayMonitor,
} from "../assets/hooks/useFairPlayMonitor";

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
  const { width, fontScale } = useWindowDimensions();
  const buzzerSize = Math.min(Math.max(width - 80, 160), 260);
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
      shadowColor: partyColors.purple,
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
        accessibilityLiveRegion="polite"
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
          color={isConfirmedLocked ? partyColors.danger : partyColors.ink}
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

  const renderScreen = (content: React.ReactNode) => (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
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
      <View style={styles.waitingCard} accessibilityLiveRegion="polite">
        <View style={styles.waitingIcon}>
          <MaterialIcons name="touch-app" size={38} color={partyColors.ink} />
        </View>
        <Text accessibilityRole="header" style={styles.waitingText}>Ready, set, buzz.</Text>
        <Text style={styles.waitingDetail}>
          Keep this screen open. Your buzzer will light up when the question starts.
        </Text>
        <Text style={styles.sessionCode}>Room {sessionCode}</Text>
      </View>,
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
    return renderScreen(
      <View style={styles.waitingCard} accessibilityLiveRegion="polite">
        <View style={styles.waitingIcon}>
          <MaterialIcons
            name={isSubmittedAnswerWaiting ? "check" : "hourglass-empty"}
            size={36}
            color={partyColors.ink}
          />
        </View>
        <Text accessibilityRole="header" style={styles.waitingText}>
          {isSubmittedAnswerWaiting ? "Answer submitted!" : "Next question, coming up."}
        </Text>
        <Text style={styles.waitingDetail}>
          {isSubmittedAnswerWaiting
            ? "Look up at the big screen. Your host will reveal what happens next."
            : "Stay here. Your host is moving the game along."}
        </Text>
        <Text style={styles.sessionCode}>Room {sessionCode}</Text>
      </View>,
    );
  }

  const useSingleColumn =
    width < 360 || fontScale >= 1.25 ||
    visibleAnswerOptions.some((option) => option.length > 54);
  const isBuzzerDisabled =
    isFairPlayLocked ||
    buzzerState.buttonState === "waiting" ||
    buzzerState.buttonState === "locked" ||
    buzzerState.buttonState === "frozen" ||
    buzzerState.buttonState === "answer_mode";
  const buzzerLabel =
    isFairPlayLocked || buzzerState.buttonState === "frozen"
      ? "Frozen"
      : buzzerState.buttonState === "answer_mode"
        ? "Answer"
        : buzzerState.buttonState === "waiting" || buzzerState.buttonState === "locked"
          ? "Wait..."
          : "BUZZ!";

  return renderScreen(
    <View style={styles.gameContent}>
      <View style={styles.questionCard}>
        <View style={styles.questionMode}>
          <MaterialIcons name="bolt" size={19} color={partyColors.lime} />
          <Text style={styles.questionModeText}>Buzzer round</Text>
        </View>
        <Text accessibilityRole="header" style={styles.questionText}>
          {currentQuestion.question}
        </Text>
      </View>
      {renderFairPlayStatus()}

      {buzzerState.winner && (
        <Animated.View
          accessibilityLiveRegion="polite"
          style={[
            styles.winnerCard,
            { opacity: winnerAnimation, transform: [{ scale: winnerAnimation }] },
          ]}
        >
          <MaterialIcons name="emoji-events" size={32} color={partyColors.ink} />
          <Text style={styles.winnerText}>{buzzerState.winner} buzzed first!</Text>
        </Animated.View>
      )}

      {buzzerState.canAnswer &&
      !isFairPlayLocked &&
      (visibleAnswerOptions.length > 0 || isTextInputAnswerMode) ? (
        <View style={styles.answerContainer}>
          <Text style={styles.answerHint}>
            {visibleAnswerOptions.length > 0
              ? "Your turn. Tap an answer to submit it."
              : "Your turn. Type your answer, then submit it."}
          </Text>
          {visibleAnswerOptions.length > 0 ? (
            <View style={styles.optionsGrid}>
              {visibleAnswerOptions.map((option, index) => (
                <TouchableOpacity
                  key={`${option}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Submit answer ${String.fromCharCode(65 + index)}: ${option}`}
                  accessibilityHint="Submits this answer immediately."
                  accessibilityState={{ disabled: hasSubmittedAnswer || isFairPlayLocked }}
                  style={[
                    styles.optionButton,
                    useSingleColumn && styles.optionButtonFullWidth,
                    (hasSubmittedAnswer || isFairPlayLocked) && styles.optionButtonDisabled,
                  ]}
                  onPress={() => submitBuzzerAnswer(option)}
                  disabled={hasSubmittedAnswer || isFairPlayLocked}
                  activeOpacity={0.8}
                >
                  <View style={styles.optionTopRow}>
                    <Text style={styles.optionLetter}>{String.fromCharCode(65 + index)}</Text>
                    <MaterialIcons name="arrow-forward" size={18} color={partyColors.ink} />
                  </View>
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <>
              <Text style={styles.inputLabel}>Your answer</Text>
              <TextInput
                accessibilityLabel="Your answer"
                accessibilityHint="Type your answer, then choose Submit answer."
                style={styles.answerInput}
                value={answerText}
                onChangeText={setAnswerText}
                placeholder="Type your answer"
                placeholderTextColor={partyColors.muted}
                editable={!hasSubmittedAnswer && !isFairPlayLocked}
                autoCapitalize="none"
                autoCorrect
                returnKeyType="done"
                onSubmitEditing={() => {
                  const trimmedAnswer = answerText.trim();
                  if (trimmedAnswer && !hasSubmittedAnswer && !isFairPlayLocked) {
                    submitBuzzerAnswer(trimmedAnswer);
                  }
                }}
              />
              {!!answerText.trim() && !hasSubmittedAnswer && !isFairPlayLocked && (
                <PartyButton
                  title="Submit answer"
                  onPress={() => submitBuzzerAnswer(answerText.trim())}
                  icon={<MaterialIcons name="arrow-forward" size={21} color={partyColors.ink} />}
                />
              )}
            </>
          )}
        </View>
      ) : (
        <View style={styles.buzzerContainer}>
          <Animated.View
            style={[
              getBuzzerGlowStyle(),
              { borderRadius: buzzerSize / 2, transform: [{ scale: scaleAnimation }] },
            ]}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={buzzerLabel === "BUZZ!" ? "Buzz in" : buzzerLabel}
              accessibilityHint={isBuzzerDisabled ? buzzerState.statusText : "Buzz to get a chance to answer."}
              accessibilityState={{ disabled: isBuzzerDisabled }}
              style={[
                getBuzzerButtonStyle(),
                { width: buzzerSize, minHeight: buzzerSize, borderRadius: buzzerSize / 2 },
              ]}
              onPress={handleBuzzerPress}
              disabled={isBuzzerDisabled}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={
                  isFairPlayLocked || buzzerState.buttonState === "frozen"
                    ? "block"
                    : buzzerState.buttonState === "answer_mode"
                      ? "edit"
                      : buzzerState.buttonState === "waiting" || buzzerState.buttonState === "locked"
                        ? "hourglass-empty"
                        : "touch-app"
                }
                size={58}
                color={partyColors.ink}
              />
              <Text style={styles.buzzerButtonText}>{buzzerLabel}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      <View style={styles.statusContainer} accessibilityLiveRegion="polite">
        <MaterialIcons
          name={isFairPlayLocked ? "lock" : buzzerState.isActive ? "bolt" : "hourglass-empty"}
          size={22}
          color={partyColors.ink}
        />
        <Text style={styles.statusText}>
          {isFairPlayLocked
            ? "Fair Play freeze. Wait for the next question."
            : buzzerState.isActive
              ? "Buzzer is live. First to buzz gets the answer!"
              : buzzerState.statusText}
        </Text>
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
  waitingCard: {
    alignItems: "center", gap: 16, marginVertical: 24, padding: 24,
    backgroundColor: partyColors.lavender, borderColor: partyColors.border,
    borderWidth: 2, borderBottomWidth: 5, borderRadius: 24,
  },
  waitingIcon: {
    alignItems: "center", justifyContent: "center", width: 76, height: 76,
    borderRadius: 38, borderWidth: 2, borderColor: partyColors.border,
    backgroundColor: partyColors.lime,
  },
  waitingText: {
    fontFamily: partyFonts.display, fontSize: 25, lineHeight: 33,
    color: partyColors.ink, textAlign: "center",
  },
  waitingDetail: { fontSize: 16, lineHeight: 24, color: partyColors.ink, textAlign: "center" },
  sessionCode: { fontSize: 14, fontWeight: "700", color: partyColors.muted },
  gameContent: { gap: 16 },
  questionCard: { backgroundColor: partyColors.purple, borderRadius: 22, padding: 20, gap: 20 },
  questionMode: { flexDirection: "row", alignItems: "center", gap: 6 },
  questionModeText: { fontSize: 13, fontWeight: "800", color: partyColors.lime },
  questionText: { fontFamily: partyFonts.display, fontSize: 27, lineHeight: 35, color: partyColors.white },
  winnerCard: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 16,
    borderColor: partyColors.border, borderWidth: 2, borderBottomWidth: 4,
    borderRadius: 16, backgroundColor: partyColors.pink,
  },
  winnerText: { flex: 1, fontSize: 18, lineHeight: 25, fontWeight: "800", color: partyColors.ink },
  fairPlayBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: partyColors.lavender, borderColor: partyColors.border,
    borderWidth: 1, borderRadius: 12, padding: 12,
  },
  fairPlayBannerWarning: { borderColor: partyColors.danger, backgroundColor: partyColors.dangerSoft },
  fairPlayBannerGrace: { backgroundColor: partyColors.lime },
  fairPlayText: { flex: 1, fontSize: 14, lineHeight: 21, fontWeight: "600", color: partyColors.ink },
  fairPlayTextGrace: { color: partyColors.ink },
  fairPlayTextWarning: { color: partyColors.ink },
  buzzerContainer: { alignItems: "center", paddingVertical: 12 },
  buzzerButton: {
    alignItems: "center", justifyContent: "center", gap: 10, padding: 24,
    borderWidth: 3, borderBottomWidth: 8, borderColor: partyColors.border,
  },
  buzzerButtonActive: { backgroundColor: partyColors.lime },
  buzzerButtonPressed: { backgroundColor: partyColors.lavender },
  buzzerButtonFrozen: { backgroundColor: partyColors.dangerSoft },
  buzzerButtonInactive: { backgroundColor: partyColors.white },
  buzzerButtonText: {
    fontFamily: partyFonts.display, fontSize: 30, lineHeight: 38,
    color: partyColors.ink, textAlign: "center",
  },
  statusContainer: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: partyColors.lavender, borderRadius: 12, padding: 14,
  },
  statusText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: "600", color: partyColors.ink },
  answerContainer: { gap: 12 },
  answerHint: { fontSize: 15, lineHeight: 22, color: partyColors.muted },
  optionsGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: 12 },
  optionButton: {
    flexBasis: "46%", flexGrow: 1, minWidth: 0, minHeight: 104, gap: 12,
    backgroundColor: partyColors.white, borderColor: partyColors.border,
    borderWidth: 2, borderBottomWidth: 5, borderRadius: 12, padding: 12,
  },
  optionButtonFullWidth: { flexBasis: "100%" },
  optionButtonDisabled: { opacity: 0.6 },
  optionTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  optionLetter: { color: partyColors.ink, fontSize: 13, fontWeight: "800" },
  optionText: { color: partyColors.ink, fontSize: 17, lineHeight: 24, fontWeight: "800" },
  inputLabel: { color: partyColors.ink, fontSize: 14, fontWeight: "700" },
  answerInput: {
    backgroundColor: partyColors.white, borderColor: partyColors.border,
    borderWidth: 2, borderBottomWidth: 4, borderRadius: 12,
    color: partyColors.ink, fontSize: 18, padding: 16, minHeight: 60,
  },
});

export default BuzzerGame;
