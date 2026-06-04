import { useFocusEffect } from "expo-router";
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

type FairPlayWindowModePayload = {
  isInMultiWindowMode?: boolean;
  isInPictureInPictureMode?: boolean;
  hasWindowFocus?: boolean;
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

  const windowFocusReturnTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const appStateReturnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const pendingWindowFocusLossTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const FOCUS_LOSS_DEDUPE_MS = 10000;

  const cancelPendingWindowFocusLoss = useCallback(() => {
    if (pendingWindowFocusLossTimeoutRef.current) {
      clearTimeout(pendingWindowFocusLossTimeoutRef.current);
      pendingWindowFocusLossTimeoutRef.current = null;
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
    setGraceQuestionId(null);

    if (windowFocusTimerRef.current) {
      clearTimeout(windowFocusTimerRef.current);
      windowFocusTimerRef.current = null;
    }
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
        reason === "multi_window_mode" || reason === "picture_in_picture_mode";

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

  const reportFocusReturned = useCallback(() => {
    const pendingQuestionId = pendingQuestionRef.current;

    if (!pendingQuestionId) {
      return;
    }

    pendingQuestionRef.current = null;
    pendingReasonRef.current = null;
    setGraceQuestionId(null);
    onFocusReturned(pendingQuestionId);
  }, [onFocusReturned]);

  useEffect(() => {
    if (AppState.currentState === "active") {
      appStateRef.current = "active";
      reportFocusReturned();
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

          const pendingReason = pendingReasonRef.current;

          /*
           * Only clear genuine AppState-based losses after the app has remained
           * active for a short stable period. This prevents Android state bounces
           * from clearing the grace window while the app is still closing/backgrounding.
           */
          if (
            pendingReason === "app_backgrounded" ||
            pendingReason === "app_inactive"
          ) {
            reportFocusReturned();
          }
        }, 600);

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

    const handleWindowFocusLost = () => {
      clearWindowFocusTimer();

      /*
       * Window focus loss is noisy.
       *
       * It can mean:
       * - Google Assistant / overlay appeared while PhunParty is still active
       * - OR the user is simply leaving/backgrounding the app
       *
       * We wait briefly so AppState has time to update. If the app is still
       * active after the debounce, treat it as an overlay-style violation.
       * If AppState has become inactive/background, AppState handles it using
       * the normal Fair Play grace period.
       */
      windowFocusTimerRef.current = setTimeout(() => {
        if (!isMounted || !enabled || phase !== "question") {
          return;
        }

        if (appStateRef.current === "active") {
          reportFocusLost("window_focus_lost");
        }
      }, 250);
    };

    const handleWindowMode = (payload: FairPlayWindowModePayload) => {
      if (!isMounted || !enabled || phase !== "question") {
        return;
      }

      if (payload.isInPictureInPictureMode === true) {
        clearWindowFocusTimer();
        cancelPendingWindowFocusLoss();
        reportFocusLost("picture_in_picture_mode");
        return;
      }

      if (payload.isInMultiWindowMode === true) {
        clearWindowFocusTimer();
        cancelPendingWindowFocusLoss();
        reportFocusLost("multi_window_mode");
        return;
      }

      if (payload.hasWindowFocus === false) {
        clearWindowFocusTimer();

        if (pendingWindowFocusLossTimeoutRef.current) {
          clearTimeout(pendingWindowFocusLossTimeoutRef.current);
        }

        /*
         * Delay window_focus_lost slightly.
         * If the user is actually leaving the app, AppState should move to
         * inactive/background and cancel this timer.
         *
         * If AppState stays active, this is likely notification shade / overlay.
         */
        pendingWindowFocusLossTimeoutRef.current = setTimeout(() => {
          pendingWindowFocusLossTimeoutRef.current = null;

          if (appStateRef.current === "active") {
            handleWindowFocusLost();
          }
        }, 250);

        return;
      }

      if (payload.hasWindowFocus === true) {
        if (pendingReasonRef.current === "window_focus_lost") {
          clearWindowFocusTimer();

          windowFocusTimerRef.current = setTimeout(() => {
            windowFocusTimerRef.current = null;

            if (
              appStateRef.current === "active" &&
              pendingReasonRef.current === "window_focus_lost"
            ) {
              reportFocusReturned();
            }
          }, 750);
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
      subscription.remove();
    };
  }, [enabled, phase, reportFocusLost]);

  useFocusEffect(
    useCallback(() => {
      reportFocusReturned();

      return () => {
        // Disabled for now.
        // Screen blur can happen during internal navigation/component transitions.
        // AppState + native window mode checks handle Fair Play detection.
      };
    }, [reportFocusReturned]),
  );

  return { isInGracePeriod: graceQuestionId === activeQuestionId };
}
