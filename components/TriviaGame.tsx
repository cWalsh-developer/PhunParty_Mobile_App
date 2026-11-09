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
  View,
} from "react-native";
import { partyColors, partyFonts } from "@/assets/theme/party";
import { PartyButton } from "@/components/party/party-button";
import * as APIGame from "../assets/api/API";
import {
  FairPlayStatus,
  FocusViolationReason,
  GamePhase,
  GameQuestion,
  gameWebSocket,
} from "../assets/api/gameWebSocketService";
import {
  hasImmediateFairPlayWindowViolation,
  useFairPlayMonitor,
} from "../assets/hooks/useFairPlayMonitor";

interface TriviaGameProps {
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

const isBeatClockQuestion = (question?: GameQuestion | null): boolean => {
  const compactGameType = String(question?.game_type ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const questionId = String(question?.question_id ?? "").toUpperCase();

  return (
    compactGameType.includes("beattheclock") ||
    compactGameType.includes("beatclock") ||
    questionId.startsWith("BTC")
  );
};

export const TriviaGame: React.FC<TriviaGameProps> = ({
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
  onAnswerSubmitted,
}) => {
  const { width, fontScale } = useWindowDimensions();
  // Use single atomic state for question + answers to prevent race conditions
  const [gameState, setGameState] = useState<GameState>({
    currentQuestion: null,
    answers: [],
  });

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedQuestionId, setSubmittedQuestionId] = useState<string | null>(
    null,
  );
  const [waitingForNextQuestionId, setWaitingForNextQuestionId] = useState<
    string | null
  >(null);
  const [transitionWaitingQuestionId, setTransitionWaitingQuestionId] =
    useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isGameActive, setIsGameActive] = useState(true);
  const [fairPlayLockedQuestionId, setFairPlayLockedQuestionId] = useState<
    string | null
  >(null);

  const [pulseAnimation] = useState(new Animated.Value(1));
  const [fadeAnimation] = useState(new Animated.Value(0));
  const revealTimeoutRef = useRef<any>(null);
  const currentQuestionRef = useRef<GameQuestion | null>(null);
  const fairPlayStatusRef = useRef<FairPlayStatus | null | undefined>(
    fairPlayStatus,
  );
  const fairPlayEnabledRef = useRef(fairPlayEnabled);
  const gameEndedTimeoutRef = useRef<any>(null);
  const submittedQuestionIdRef = useRef<string | null>(null);
  const waitingForNextQuestionIdRef = useRef<string | null>(null);
  const transitionWaitingQuestionIdRef = useRef<string | null>(null);
  const lastFairPlayViolationRef = useRef<{
    key: string;
    reportedAt: number;
  } | null>(null);

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
    transitionWaitingQuestionIdRef.current = transitionWaitingQuestionId;
  }, [transitionWaitingQuestionId]);

  useEffect(() => {
    if (
      externalTransitionWaitingQuestionId &&
      externalTransitionWaitingQuestionId === currentQuestionId
    ) {
      transitionWaitingQuestionIdRef.current = externalTransitionWaitingQuestionId;
      setTransitionWaitingQuestionId(externalTransitionWaitingQuestionId);
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
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  useEffect(() => {
    if (!isFairPlayLocked) {
      return;
    }

    clearSubmittedQuestionState();
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
      if (gameEndedTimeoutRef.current) {
        clearTimeout(gameEndedTimeoutRef.current);
        gameEndedTimeoutRef.current = null;
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
      resetForNewQuestion(currentQuestionId);
      animateQuestionEntry();
    }
  }, [currentQuestionId]); // Only reset when question ID changes

  const setupWebSocketListeners = () => {
    const markCurrentQuestionTransitionWaiting = (data?: any) => {
      const action = data?.action ?? data?.game_state?.action;

      if (action !== "next_question" && action !== "game_ended") {
        return false;
      }

      const transitionQuestionId =
        data?.question_id ??
        data?.questionId ??
        data?.current_question_id ??
        data?.game_state?.question_id ??
        data?.game_state?.questionId ??
        currentQuestionRef.current?.question_id ??
        null;

      if (!transitionQuestionId) {
        return false;
      }

      transitionWaitingQuestionIdRef.current = transitionQuestionId;
      setTransitionWaitingQuestionId(transitionQuestionId);
      setShowResults(false);
      return true;
    };

    gameWebSocket.onQuestionReceived = (question: GameQuestion) => {
      if (isBeatClockQuestion(question)) {
        console.log("TriviaGame ignored Beat the Clock question", {
          questionId: question.question_id,
          gameType: question.game_type,
        });
        gameWebSocket.requestCurrentQuestion();
        return;
      }

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
      if (markCurrentQuestionTransitionWaiting(data)) {
        return;
      }

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

      if (isMyAnswer && data.is_correct !== undefined) {
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
        clearSubmittedQuestionState();
        setShowResults(false);
        return;
      }

      clearSubmittedQuestionState();
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
        const endedQuestionId =
          data.question_id ??
          data.questionId ??
          currentQuestionRef.current?.question_id ??
          null;

        if (endedQuestionId) {
          transitionWaitingQuestionIdRef.current = endedQuestionId;
          setTransitionWaitingQuestionId(endedQuestionId);
        }

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

        console.log("DEBUG - Answer options created:", {
          source: question.display_options ? "display_options" : "empty",
          options_count: answerOptions.length,
          options: answerOptions.map((a) => a.option),
        });

        // ATOMIC UPDATE: Set both question AND answers together
        console.log("API fetch: Setting question and answers atomically");
        setGameState({
          currentQuestion: question,
          answers: answerOptions,
        });
        console.log("API fetch: Atomic state update complete");
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

      // Host controls game start; mobile only fetches the current question.
      await fetchCurrentQuestionNow();
    } catch (error) {}
  };
  void fetchInitialQuestion;

  const resetForNewQuestion = (questionId?: string | null) => {
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
    const isSubmittedQuestion =
      !!questionId && submittedQuestionIdRef.current === questionId;
    const isWaitingQuestion =
      !!questionId && waitingForNextQuestionIdRef.current === questionId;
    const isTransitionWaitingQuestion =
      !!questionId && transitionWaitingQuestionIdRef.current === questionId;

    if (
      !isSubmittedQuestion &&
      !isWaitingQuestion &&
      !isTransitionWaitingQuestion
    ) {
      setSelectedAnswer(null);
      clearSubmittedQuestionState();
    }

    if (questionId && !isTransitionWaitingQuestion) {
      transitionWaitingQuestionIdRef.current = null;
      setTransitionWaitingQuestionId(null);
    }

    setShowResults(false);
    setTimeLeft(0);
    fadeAnimation.setValue(0);
  };

  const setSubmittedQuestionState = (questionId: string) => {
    submittedQuestionIdRef.current = questionId;
    waitingForNextQuestionIdRef.current = questionId;
    setHasSubmitted(true);
    setSubmittedQuestionId(questionId);
    setWaitingForNextQuestionId(questionId);
  };

  const clearSubmittedQuestionState = () => {
    submittedQuestionIdRef.current = null;
    waitingForNextQuestionIdRef.current = null;
    setHasSubmitted(false);
    setSubmittedQuestionId(null);
    setWaitingForNextQuestionId(null);
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

    if (fairPlayEnabled) {
      const immediateViolation = await hasImmediateFairPlayWindowViolation({
        includeWindowFocusLoss: false,
      });

      if (immediateViolation) {
        handleFairPlayViolation(currentQuestion.question_id, immediateViolation);
      }
    }

    setSubmittedQuestionState(currentQuestion.question_id);
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
          clearSubmittedQuestionState();
          onError("Failed to submit answer. Please check your connection.");
          return;
        }
      } catch (error) {
        clearSubmittedQuestionState();
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

  const getAnswerButtonStyle = (answer: Answer) => [
    styles.answerButton,
    showResults && answer.isCorrect && styles.correctAnswer,
    showResults && answer.isSelected && !answer.isCorrect && styles.incorrectAnswer,
    showResults && !answer.isCorrect && !answer.isSelected && styles.neutralAnswer,
    !showResults && answer.isSelected && styles.selectedAnswer,
  ];

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
        <Text style={styles.fairPlayText}>
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
      <View style={styles.waitingCard} accessibilityLiveRegion="polite">
        <View style={styles.waitingIcon}>
          <MaterialIcons name="hourglass-empty" size={36} color={partyColors.ink} />
        </View>
        <Text style={styles.waitingText}>Next question, coming up.</Text>
        <Text style={styles.waitingDetail}>
          Keep this screen open. Your host will get things started.
        </Text>
        <Text style={styles.sessionCode}>Room {sessionCode}</Text>
      </View>,
    );
  }

  const isWaitingForSubmittedQuestion =
    waitingForNextQuestionId === currentQuestionId ||
    submittedQuestionId === currentQuestionId ||
    (hasSubmitted && !showResults);
  const isWaitingForQuestionTransition =
    transitionWaitingQuestionId === currentQuestionId;

  if (
    isWaitingForQuestionTransition ||
    (isWaitingForSubmittedQuestion && !isFairPlayLocked)
  ) {
    return renderScreen(
      <View style={styles.waitingCard} accessibilityLiveRegion="polite">
        <View style={styles.waitingIcon}>
          <MaterialIcons
            name={isWaitingForQuestionTransition ? "hourglass-empty" : "lock"}
            size={36}
            color={partyColors.ink}
          />
        </View>
        <Text style={styles.waitingText}>
          {isWaitingForQuestionTransition
            ? "Next question, coming up."
            : "Answer submitted!"}
        </Text>
        {isWaitingForSubmittedQuestion && selectedAnswer?.trim() && (
          <View style={styles.submittedAnswer}>
            <Text style={styles.submittedLabel}>Your answer</Text>
            <Text style={styles.submittedText}>{selectedAnswer.trim()}</Text>
          </View>
        )}
        <Text style={styles.waitingDetail}>
          {isWaitingForQuestionTransition
            ? "Stay here. Your host is moving the game along."
            : "Look up at the big screen. Your host will reveal what happens next."}
        </Text>
        <Text style={styles.sessionCode}>Room {sessionCode}</Text>
      </View>,
    );
  }

  const isTextInputQuestion = currentQuestion.ui_mode === "text_input";
  const typedAnswer = selectedAnswer ?? "";
  const hasAnswer = Boolean(selectedAnswer?.trim());
  const selectedAnswerIndex = answers.findIndex((answer) => answer.isSelected);
  const useSingleColumn =
    width < 360 ||
    fontScale >= 1.25 ||
    answers.some((answer) => answer.option.length > 54);

  return renderScreen(
    <Animated.View style={[styles.gameContent, { opacity: fadeAnimation }]}>
      <View style={styles.questionCard}>
        <View style={styles.questionHeader}>
          <View style={styles.questionMode}>
            <MaterialIcons name="auto-awesome" size={17} color={partyColors.lime} />
            <Text style={styles.questionModeText}>Trivia</Text>
          </View>
          {timeLeft > 0 && (
            <View
              style={styles.timerContainer}
              accessible
              accessibilityLabel={`${timeLeft} seconds remaining`}
            >
              <MaterialIcons name="timer" size={18} color={partyColors.ink} />
              <Text style={styles.timerText}>{timeLeft}s</Text>
            </View>
          )}
        </View>
        <Text accessibilityRole="header" style={styles.questionText}>
          {currentQuestion.question}
        </Text>
      </View>
      {renderFairPlayStatus()}

      <Text style={styles.answerHint}>
        {isFairPlayLocked
          ? "Your answers are locked for this question."
          : showResults
            ? "The answer is in."
            : isTextInputQuestion
              ? "Trust your gut. Type your answer, then lock it in."
              : "Trust your gut. Tap one, then lock it in."}
      </Text>

      {isTextInputQuestion ? (
        <View style={styles.textAnswerContainer}>
          <Text style={styles.inputLabel}>Your answer</Text>
          <TextInput
            accessibilityLabel="Your answer"
            accessibilityHint="Type your answer, then choose Lock it in."
            style={[
              styles.textAnswerInput,
              isFairPlayLocked && styles.answerButtonDisabled,
            ]}
            value={typedAnswer}
            onChangeText={setSelectedAnswer}
            placeholder="Type your answer"
            placeholderTextColor={partyColors.muted}
            editable={!hasSubmitted && !isFairPlayLocked}
            autoCapitalize="none"
            autoCorrect
            returnKeyType="done"
            onSubmitEditing={submitAnswer}
          />
        </View>
      ) : (
        <View
          style={styles.answersContainer}
          accessibilityRole="radiogroup"
          accessibilityLabel="Answer choices"
        >
          {answers.map((answer, index) => {
            const answerLetter = String.fromCharCode(65 + index);
            const isCorrectResult = showResults && answer.isCorrect;
            const isIncorrectResult =
              showResults && answer.isSelected && !answer.isCorrect;
            const answerDisabled = hasSubmitted || showResults || isFairPlayLocked;

            return (
              <Animated.View
                key={index}
                style={[
                  styles.answerCell,
                  useSingleColumn && styles.answerCellFullWidth,
                  { transform: [{ scale: pulseAnimation }] },
                ]}
              >
                <TouchableOpacity
                  accessibilityRole="radio"
                  accessibilityLabel={`${answerLetter}. ${answer.option}${
                    isCorrectResult
                      ? ". Correct answer"
                      : isIncorrectResult
                        ? ". Incorrect answer"
                        : ""
                  }`}
                  accessibilityHint={
                    answerDisabled
                      ? undefined
                      : "Select this answer, then choose Lock it in."
                  }
                  accessibilityState={{
                    checked: answer.isSelected,
                    disabled: answerDisabled,
                  }}
                  aria-checked={answer.isSelected}
                  aria-disabled={answerDisabled}
                  style={[
                    getAnswerButtonStyle(answer),
                    isFairPlayLocked && styles.answerButtonDisabled,
                  ]}
                  onPress={() => selectAnswer(answer.option)}
                  disabled={answerDisabled}
                  activeOpacity={0.8}
                >
                  <View style={styles.answerTopRow}>
                    <Text style={styles.answerLetter}>{answerLetter}</Text>
                    <MaterialIcons
                      name={
                        isIncorrectResult
                          ? "cancel"
                          : isCorrectResult || answer.isSelected
                            ? "check-circle-outline"
                            : "radio-button-unchecked"
                      }
                      size={19}
                      color={isIncorrectResult ? partyColors.danger : partyColors.ink}
                    />
                  </View>
                  <Text style={styles.answerText}>{answer.option}</Text>
                  {isCorrectResult && (
                    <Text style={styles.answerResult}>Correct answer</Text>
                  )}
                  {isIncorrectResult && (
                    <Text style={styles.answerResult}>Your answer</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      )}

      {!hasSubmitted && !showResults && !isFairPlayLocked && (
        <View style={styles.submitContainer}>
          <View style={styles.selectionStatus} accessibilityLiveRegion="polite">
            <MaterialIcons
              name={hasAnswer ? "check-circle-outline" : "touch-app"}
              size={20}
              color={partyColors.ink}
            />
            <Text style={styles.selectionText}>
              {hasAnswer
                ? isTextInputQuestion
                  ? "Answer ready. Lock it in to submit."
                  : selectedAnswerIndex >= 0
                    ? `You picked ${String.fromCharCode(65 + selectedAnswerIndex)}. Lock it in to submit.`
                    : "Answer selected. Lock it in to submit."
                : isTextInputQuestion
                  ? "Type an answer to get started."
                  : "Pick your answer."}
            </Text>
          </View>
          <PartyButton
            title="Lock it in!"
            onPress={submitAnswer}
            disabled={!hasAnswer}
            icon={<MaterialIcons name="lock-outline" size={21} color={partyColors.ink} />}
          />
        </View>
      )}

      {hasSubmitted && !showResults && (
        <View style={styles.statusContainer} accessibilityLiveRegion="polite">
          <MaterialIcons name="lock" size={22} color={partyColors.ink} />
          <Text style={styles.selectionText}>
            Answer submitted. Waiting for your host.
          </Text>
        </View>
      )}
    </Animated.View>,
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: partyColors.cream,
  },
  scrollContent: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 32,
  },
  waitingCard: {
    backgroundColor: partyColors.lavender,
    borderColor: partyColors.border,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderRadius: 24,
    alignItems: "center",
    padding: 24,
    marginVertical: 24,
    gap: 16,
  },
  waitingIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: partyColors.lime,
    borderColor: partyColors.border,
    borderWidth: 2,
  },
  waitingText: {
    fontFamily: partyFonts.display,
    fontSize: 25,
    lineHeight: 32,
    color: partyColors.ink,
    textAlign: "center",
  },
  waitingDetail: {
    fontSize: 16,
    lineHeight: 24,
    color: partyColors.ink,
    textAlign: "center",
  },
  sessionCode: {
    fontSize: 14,
    fontWeight: "700",
    color: partyColors.muted,
  },
  submittedAnswer: {
    alignSelf: "stretch",
    backgroundColor: partyColors.white,
    borderColor: partyColors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  submittedLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: partyColors.muted,
  },
  submittedText: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700",
    color: partyColors.ink,
  },
  gameContent: {
    gap: 16,
  },
  questionCard: {
    backgroundColor: partyColors.purple,
    borderRadius: 22,
    padding: 20,
    gap: 22,
    minHeight: 194,
  },
  questionHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  questionMode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  questionModeText: {
    color: partyColors.lime,
    fontSize: 13,
    fontWeight: "800",
  },
  questionText: {
    fontFamily: partyFonts.display,
    fontSize: 27,
    lineHeight: 35,
    color: partyColors.white,
    textAlign: "left",
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: partyColors.lime,
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  timerText: {
    fontSize: 15,
    color: partyColors.ink,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  answerHint: {
    fontSize: 14,
    lineHeight: 21,
    color: partyColors.muted,
  },
  answersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: 12,
  },
  answerCell: {
    flexBasis: "46%",
    flexGrow: 1,
    minWidth: 0,
  },
  answerCellFullWidth: {
    flexBasis: "100%",
  },
  textAnswerContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: partyColors.ink,
  },
  textAnswerInput: {
    backgroundColor: partyColors.white,
    borderColor: partyColors.border,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 12,
    color: partyColors.ink,
    fontSize: 18,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  answerButton: {
    flexGrow: 1,
    backgroundColor: partyColors.white,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: partyColors.border,
    gap: 12,
    minHeight: 104,
  },
  answerButtonDisabled: {
    opacity: 0.6,
  },
  selectedAnswer: {
    backgroundColor: partyColors.lime,
  },
  correctAnswer: {
    backgroundColor: partyColors.lime,
  },
  incorrectAnswer: {
    backgroundColor: partyColors.dangerSoft,
  },
  neutralAnswer: {
    backgroundColor: partyColors.cream,
  },
  answerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  answerLetter: {
    fontSize: 13,
    fontWeight: "800",
    color: partyColors.ink,
  },
  answerText: {
    color: partyColors.ink,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
  },
  answerResult: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: partyColors.ink,
  },
  fairPlayBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: partyColors.lavender,
    borderColor: partyColors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  fairPlayBannerWarning: {
    borderColor: partyColors.danger,
    backgroundColor: partyColors.dangerSoft,
  },
  fairPlayBannerGrace: {
    backgroundColor: partyColors.lime,
  },
  fairPlayText: {
    color: partyColors.ink,
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  submitContainer: {
    gap: 12,
  },
  selectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectionText: {
    color: partyColors.ink,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    flex: 1,
  },
  statusContainer: {
    backgroundColor: partyColors.lavender,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
});

export default TriviaGame;
