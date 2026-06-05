import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from "react-native";
import type { FocusViolationReason } from "../api/gameWebSocketService";

const FAIR_PLAY_WINDOW_MODE_EVENT = "FairPlayWindowModeChanged";
const WINDOW_MODE_CLASSIFICATION_DELAY_MS = 150;
const USER_LEAVE_HINT_SUPPRESSION_MS = 1500;

type FairPlayWindowModePayload = {
  isInMultiWindowMode?: boolean;
  isInPictureInPictureMode?: boolean;
  hasWindowFocus?: boolean;
  userLeaveHint?: boolean;
};

type FairPlayWindowModeModule = {
  isInMultiWindowMode?: () => Promise<boolean>;
  isInPictureInPictureMode?: () => Promise<boolean>;
  hasWindowFocus?: () => Promise<boolean>;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

const getFairPlayWindowModeModule = (): FairPlayWindowModeModule | null => {
  if (Platform.OS !== "android") {
    return null;
  }

  return (NativeModules.FairPlayWindowMode as FairPlayWindowModeModule) ?? null;
};

interface UseFairPlayMonitorOptions {
  enabled: boolean;
  questionId?: string | null;
  phase: string;
  onFocusLost: (questionId: string, reason: FocusViolationReason) => void;
  onFocusReturned: (questionId: string) => void;
}

export function useFairPlayMonitor({
  enabled,
  questionId,
  phase,
  onFocusLost,
  onFocusReturned,
}: UseFairPlayMonitorOptions) {
  const pendingQuestionRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const windowFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingReasonRef = useRef<FocusViolationReason | null>(null);
  const lastFocusLossRef = useRef<{
    questionId: string | null;
    reason: FocusViolationReason | null;
    reportedAt: number;
  } | null>(null);

  const strictWindowModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const appStateReturnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const pendingWindowFocusLossTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const lastUserLeaveHintAtRef = useRef<number>(0);

  const FOCUS_LOSS_DEDUPE_MS = 10000;

  const cancelPendingWindowFocusLoss = useCallback(() => {
    if (pendingWindowFocusLossTimeoutRef.current) {
      clearTimeout(pendingWindowFocusLossTimeoutRef.current);
      pendingWindowFocusLossTimeoutRef.current = null;
    }
  }, []);

  const cancelStrictWindowModeTimer = useCallback(() => {
    if (strictWindowModeTimerRef.current) {
      clearTimeout(strictWindowModeTimerRef.current);
      strictWindowModeTimerRef.current = null;
    }
  }, []);

  const cancelPendingAppStateReturn = useCallback(() => {
    if (appStateReturnTimeoutRef.current) {
      clearTimeout(appStateReturnTimeoutRef.current);
      appStateReturnTimeoutRef.current = null;
    }
  }, []);

  const [graceQuestionId, setGraceQuestionId] = useState<string | null>(null);

  const activeQuestionId = enabled && phase === "question" ? questionId : null;

  useEffect(() => {
    pendingQuestionRef.current = null;
    const resetGraceTimeout = setTimeout(() => setGraceQuestionId(null), 0);

    if (windowFocusTimerRef.current) {
      clearTimeout(windowFocusTimerRef.current);
      windowFocusTimerRef.current = null;
    }

    return () => clearTimeout(resetGraceTimeout);
  }, [questionId]);

  const reportFocusLost = useCallback(
    (reason: FocusViolationReason) => {
      console.log("[FAIR PLAY] reportFocusLost called", {
        reason,
        enabled,
        activeQuestionId,
        isInGracePeriod: Boolean(graceQuestionId),
      });

      if (!enabled || !activeQuestionId) {
        return;
      }

      const now = Date.now();
      const lastFocusLoss = lastFocusLossRef.current;

      const isRecentDuplicate =
        lastFocusLoss?.questionId === activeQuestionId &&
        lastFocusLoss?.reason === reason &&
        now - lastFocusLoss.reportedAt < FOCUS_LOSS_DEDUPE_MS;

      if (isRecentDuplicate) {
        console.log("[FAIR PLAY] duplicate focus loss ignored", {
          reason,
          activeQuestionId,
          elapsedMs: now - lastFocusLoss.reportedAt,
        });
        return;
      }

      const pendingQuestionId = pendingQuestionRef.current;
      const pendingReason = pendingReasonRef.current;

      const isSamePendingReason =
        pendingQuestionId === activeQuestionId && pendingReason === reason;

      if (isSamePendingReason) {
        console.log("[FAIR PLAY] pending focus loss already exists", {
          reason,
          activeQuestionId,
        });
        return;
      }

      lastFocusLossRef.current = {
        questionId: activeQuestionId,
        reason,
        reportedAt: now,
      };

      pendingQuestionRef.current = activeQuestionId;
      pendingReasonRef.current = reason;

      const isImmediateViolation =
        reason === "multi_window_mode" ||
        reason === "picture_in_picture_mode" ||
        reason === "window_focus_lost";

      if (!isImmediateViolation) {
        setGraceQuestionId(activeQuestionId);
      }

      console.log("[FAIR PLAY] sending focus lost to GameContainer", {
        reason,
        activeQuestionId,
      });

      onFocusLost(activeQuestionId, reason);
    },
    [activeQuestionId, enabled, graceQuestionId, onFocusLost],
  );

  useEffect(() => {
    lastFocusLossRef.current = null;
  }, [activeQuestionId]);

  const reportFocusReturned = useCallback(
    (questionIdOverride?: string | null) => {
      const pendingQuestionId = pendingQuestionRef.current;
      const questionIdToReturn = pendingQuestionId ?? questionIdOverride;

      if (!questionIdToReturn) {
        console.log("[FAIR PLAY] return ignored; no question id available", {
          pendingQuestionId,
          questionIdOverride,
          activeQuestionId,
        });
        return;
      }

      console.log("[FAIR PLAY] sending focus returned", {
        questionIdToReturn,
        pendingQuestionId,
        questionIdOverride,
        pendingReason: pendingReasonRef.current,
      });

      pendingQuestionRef.current = null;
      pendingReasonRef.current = null;
      setGraceQuestionId(null);

      onFocusReturned(questionIdToReturn);
    },
    [activeQuestionId, onFocusReturned],
  );

  useEffect(() => {
    if (AppState.currentState !== "active") {
      return;
    }

    appStateRef.current = "active";

    const pendingReason = pendingReasonRef.current;

    if (
      pendingReason === "app_backgrounded" ||
      pendingReason === "app_inactive"
    ) {
      reportFocusReturned(activeQuestionId);
    }
  }, [activeQuestionId, reportFocusReturned]);

  useEffect(() => {
    if (!enabled || phase !== "question") {
      reportFocusReturned();
    }
  }, [enabled, phase, reportFocusReturned]);

  const handleAppStateChange = useCallback(
    (nextState: AppStateStatus) => {
      appStateRef.current = nextState;

      if (nextState === "active") {
        cancelPendingAppStateReturn();

        appStateReturnTimeoutRef.current = setTimeout(() => {
          appStateReturnTimeoutRef.current = null;

          if (appStateRef.current !== "active") {
            return;
          }

          if (!enabled || phase !== "question" || !activeQuestionId) {
            return;
          }

          console.log("[FAIR PLAY] AppState active sending return", {
            activeQuestionId,
            pendingQuestionId: pendingQuestionRef.current,
            pendingReason: pendingReasonRef.current,
            appState: appStateRef.current,
          });

          reportFocusReturned(activeQuestionId);
        }, 150);

        return;
      }

      if (nextState === "inactive") {
        cancelPendingAppStateReturn();
        cancelPendingWindowFocusLoss();
        reportFocusLost("app_inactive");
        return;
      }

      if (nextState === "background") {
        cancelPendingAppStateReturn();
        cancelPendingWindowFocusLoss();

        const alreadyReportedInactiveForQuestion =
          pendingQuestionRef.current === activeQuestionId &&
          pendingReasonRef.current === "app_inactive";

        if (!alreadyReportedInactiveForQuestion) {
          reportFocusLost("app_backgrounded");
        }

        return;
      }
    },
    [
      activeQuestionId,
      cancelPendingAppStateReturn,
      cancelPendingWindowFocusLoss,
      enabled,
      phase,
      reportFocusLost,
      reportFocusReturned,
    ],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => subscription.remove();
  }, [handleAppStateChange]);

  useEffect(() => {
    return () => {
      if (appStateReturnTimeoutRef.current) {
        clearTimeout(appStateReturnTimeoutRef.current);
        appStateReturnTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const windowModeModule = getFairPlayWindowModeModule();

    if (!windowModeModule) {
      return;
    }

    let isMounted = true;

    const clearWindowFocusTimer = () => {
      if (windowFocusTimerRef.current) {
        clearTimeout(windowFocusTimerRef.current);
        windowFocusTimerRef.current = null;
      }
    };

    const reportImmediateWindowViolationIfActive = (
      reason:
        | "multi_window_mode"
        | "picture_in_picture_mode"
        | "window_focus_lost",
    ) => {
      clearWindowFocusTimer();
      cancelPendingWindowFocusLoss();
      cancelStrictWindowModeTimer();

      windowFocusTimerRef.current = setTimeout(async () => {
        windowFocusTimerRef.current = null;

        if (!isMounted || !enabled || phase !== "question") {
          return;
        }

        if (appStateRef.current !== "active") {
          return;
        }

        const elapsedSinceUserLeaveHint =
          Date.now() - lastUserLeaveHintAtRef.current;

        if (elapsedSinceUserLeaveHint < USER_LEAVE_HINT_SUPPRESSION_MS) {
          const remainingMs =
            USER_LEAVE_HINT_SUPPRESSION_MS - elapsedSinceUserLeaveHint;

          windowFocusTimerRef.current = setTimeout(async () => {
            windowFocusTimerRef.current = null;

            if (!isMounted || !enabled || phase !== "question") {
              return;
            }

            if (appStateRef.current !== "active") {
              return;
            }

            const stillInMultiWindow =
              (await windowModeModule
                .isInMultiWindowMode?.()
                .catch(() => false)) ?? false;
            const stillInPictureInPicture =
              (await windowModeModule
                .isInPictureInPictureMode?.()
                .catch(() => false)) ?? false;
            const stillMissingWindowFocus =
              !(
                (await windowModeModule.hasWindowFocus?.().catch(() => true)) ??
                true
              );

            if (reason === "multi_window_mode" && stillInMultiWindow) {
              reportFocusLost("multi_window_mode");
            } else if (
              reason === "picture_in_picture_mode" &&
              stillInPictureInPicture
            ) {
              reportFocusLost("picture_in_picture_mode");
            } else if (
              reason === "window_focus_lost" &&
              stillMissingWindowFocus
            ) {
              reportFocusLost("window_focus_lost");
            }
          }, remainingMs + WINDOW_MODE_CLASSIFICATION_DELAY_MS);

          return;
        }

        reportFocusLost(reason);
      }, WINDOW_MODE_CLASSIFICATION_DELAY_MS);
    };

    const handleWindowMode = (payload: FairPlayWindowModePayload) => {
      if (!isMounted || !enabled || phase !== "question") {
        return;
      }

      if (payload.userLeaveHint === true) {
        lastUserLeaveHintAtRef.current = Date.now();
        clearWindowFocusTimer();
        cancelPendingWindowFocusLoss();
        cancelStrictWindowModeTimer();
        reportFocusLost("app_inactive");

        if (payload.isInPictureInPictureMode === true) {
          reportImmediateWindowViolationIfActive("picture_in_picture_mode");
        } else if (payload.isInMultiWindowMode === true) {
          reportImmediateWindowViolationIfActive("multi_window_mode");
        } else if (payload.hasWindowFocus === false) {
          reportImmediateWindowViolationIfActive("window_focus_lost");
        }

        return;
      }

      if (payload.isInPictureInPictureMode === true) {
        reportImmediateWindowViolationIfActive("picture_in_picture_mode");
        return;
      }

      if (payload.isInMultiWindowMode === true) {
        reportImmediateWindowViolationIfActive("multi_window_mode");
        return;
      }

      if (payload.hasWindowFocus === false) {
        clearWindowFocusTimer();

        if (pendingWindowFocusLossTimeoutRef.current) {
          clearTimeout(pendingWindowFocusLossTimeoutRef.current);
        }

        pendingWindowFocusLossTimeoutRef.current = setTimeout(() => {
          pendingWindowFocusLossTimeoutRef.current = null;
          reportImmediateWindowViolationIfActive("window_focus_lost");
        }, WINDOW_MODE_CLASSIFICATION_DELAY_MS);

        return;
      }
      if (payload.hasWindowFocus === true) {
        cancelPendingWindowFocusLoss();
        clearWindowFocusTimer();

        /*
         * If the only pending Fair Play event was a window-focus loss and
         * Android reports focus has returned while the app is still active,
         * clear the backend grace window.
         *
         * Without this, a temporary notification shade / overlay focus loss can
         * mature into a strike even though the player is still in the app.
         */
        if (
          appStateRef.current === "active" &&
          pendingReasonRef.current === "window_focus_lost"
        ) {
          reportFocusReturned(activeQuestionId);
        }

        return;
      }
    };

    Promise.all([
      windowModeModule.isInMultiWindowMode?.().catch(() => false) ??
        Promise.resolve(false),
      windowModeModule.isInPictureInPictureMode?.().catch(() => false) ??
        Promise.resolve(false),
      windowModeModule.hasWindowFocus?.().catch(() => true) ??
        Promise.resolve(true),
    ])
      .then(
        ([isInMultiWindowMode, isInPictureInPictureMode, hasWindowFocus]) => {
          handleWindowMode({
            isInMultiWindowMode,
            isInPictureInPictureMode,
            hasWindowFocus,
          });
        },
      )
      .catch(() => {
        // Expo Go and older native builds will not expose this module.
      });

    const emitter = new NativeEventEmitter(windowModeModule as any);
    const subscription = emitter.addListener(
      FAIR_PLAY_WINDOW_MODE_EVENT,
      (payload: FairPlayWindowModePayload) => {
        handleWindowMode(payload ?? {});
      },
    );

    return () => {
      isMounted = false;
      clearWindowFocusTimer();
      cancelPendingWindowFocusLoss();
      cancelStrictWindowModeTimer();
      subscription.remove();
    };
  }, [
    activeQuestionId,
    enabled,
    phase,
    reportFocusLost,
    reportFocusReturned,
    cancelPendingWindowFocusLoss,
    cancelStrictWindowModeTimer,
  ]);

  return { isInGracePeriod: graceQuestionId === activeQuestionId };
}
