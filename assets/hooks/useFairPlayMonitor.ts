import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Dimensions,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from "react-native";
import type { FocusViolationReason } from "../api/gameWebSocketService";

const FAIR_PLAY_WINDOW_MODE_EVENT = "FairPlayWindowModeChanged";
const WINDOW_MODE_CLASSIFICATION_DELAY_MS = 150;
const WINDOW_FOCUS_LOSS_CLASSIFICATION_DELAY_MS = 1200;
const WINDOW_MODE_POLL_INTERVAL_MS = 750;
const USER_LEAVE_HINT_SUPPRESSION_MS = 1500;
const MULTI_WINDOW_REDUCTION_RATIO = 0.92;

type FairPlayWindowModePayload = {
  isInMultiWindowMode?: boolean;
  isInPictureInPictureMode?: boolean;
  hasWindowFocus?: boolean;
  isTopResumedActivity?: boolean;
  userLeaveHint?: boolean;
  userLeaveHintAtMs?: number;
  activityState?: "resumed" | "paused" | "stopped";
  eventSource?:
    | "activity_state_changed"
    | "multi_window_changed"
    | "picture_in_picture_changed"
    | "poll"
    | "snapshot"
    | "system_dialog_closed"
    | "top_resumed_changed"
    | "user_leave_hint"
    | "window_focus_changed";
  systemDialogReason?: string;
};

type FairPlayWindowModeModule = {
  isInMultiWindowMode?: () => Promise<boolean>;
  isInPictureInPictureMode?: () => Promise<boolean>;
  hasWindowFocus?: () => Promise<boolean>;
  isTopResumedActivity?: () => Promise<boolean>;
  getActivityState?: () => Promise<"resumed" | "paused" | "stopped">;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

const getFairPlayWindowModeModule = (): FairPlayWindowModeModule | null => {
  if (Platform.OS !== "android") {
    return null;
  }

  return (NativeModules.FairPlayWindowMode as FairPlayWindowModeModule) ?? null;
};

const isAppWindowMateriallyReduced = () => {
  const windowSize = Dimensions.get("window");
  const screenSize = Dimensions.get("screen");

  if (
    !windowSize.width ||
    !windowSize.height ||
    !screenSize.width ||
    !screenSize.height
  ) {
    return false;
  }

  return (
    windowSize.width / screenSize.width < MULTI_WINDOW_REDUCTION_RATIO ||
    windowSize.height / screenSize.height < MULTI_WINDOW_REDUCTION_RATIO
  );
};

export const hasImmediateFairPlayWindowViolation = async (
  options: { includeWindowFocusLoss?: boolean } = {},
): Promise<FocusViolationReason | null> => {
  const includeWindowFocusLoss = options.includeWindowFocusLoss ?? true;
  const windowModeModule = getFairPlayWindowModeModule();

  if (!windowModeModule) {
    return null;
  }

  const [
    isInPictureInPictureMode,
    isInMultiWindowMode,
    hasWindowFocus,
    isTopResumedActivity,
  ] = await Promise.all([
    windowModeModule.isInPictureInPictureMode?.().catch(() => false) ??
      Promise.resolve(false),
    windowModeModule.isInMultiWindowMode?.().catch(() => false) ??
      Promise.resolve(false),
    windowModeModule.hasWindowFocus?.().catch(() => true) ??
      Promise.resolve(true),
    windowModeModule.isTopResumedActivity?.().catch(() => true) ??
      Promise.resolve(true),
  ]);

  if (isInPictureInPictureMode) {
    return "picture_in_picture_mode";
  }

  if (isInMultiWindowMode && isAppWindowMateriallyReduced()) {
    return "multi_window_mode";
  }

  if (!isTopResumedActivity && AppState.currentState === "active") {
    return "picture_in_picture_mode";
  }

  if (
    includeWindowFocusLoss &&
    !hasWindowFocus &&
    AppState.currentState === "active"
  ) {
    return "window_focus_lost";
  }

  return null;
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
  const [immediateLockQuestionId, setImmediateLockQuestionId] = useState<
    string | null
  >(null);

  const activeQuestionId = enabled && phase === "question" ? questionId : null;

  useEffect(() => {
    pendingQuestionRef.current = null;
    const resetLockTimeout = setTimeout(
      () => setImmediateLockQuestionId(null),
      0,
    );
    const resetGraceTimeout = setTimeout(() => setGraceQuestionId(null), 0);

    if (windowFocusTimerRef.current) {
      clearTimeout(windowFocusTimerRef.current);
      windowFocusTimerRef.current = null;
    }

    return () => {
      clearTimeout(resetLockTimeout);
      clearTimeout(resetGraceTimeout);
    };
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
      } else {
        setImmediateLockQuestionId(activeQuestionId);
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
      const resetLockTimeout = setTimeout(
        () => setImmediateLockQuestionId(null),
        0,
      );
      reportFocusReturned();
      return () => clearTimeout(resetLockTimeout);
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

      if (activeQuestionId) {
        setImmediateLockQuestionId(activeQuestionId);
      }

      if (reason === "picture_in_picture_mode") {
        reportFocusLost(reason);
        return;
      }

      windowFocusTimerRef.current = setTimeout(async () => {
        windowFocusTimerRef.current = null;

        if (!isMounted || !enabled || phase !== "question") {
          setImmediateLockQuestionId(null);
          return;
        }

        if (appStateRef.current !== "active") {
          setImmediateLockQuestionId(null);
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
              setImmediateLockQuestionId(null);
              return;
            }

            if (appStateRef.current !== "active") {
              setImmediateLockQuestionId(null);
              return;
            }

            const activityState =
              (await windowModeModule
                .getActivityState?.()
                .catch(() => "resumed")) ?? "resumed";

            if (activityState !== "resumed") {
              setImmediateLockQuestionId(null);
              appStateRef.current =
                activityState === "stopped" ? "background" : "inactive";
              reportFocusLost(
                activityState === "stopped"
                  ? "app_backgrounded"
                  : "app_inactive",
              );
              return;
            }

            const stillInMultiWindow =
              (await windowModeModule
                .isInMultiWindowMode?.()
                .catch(() => false)) ?? false;
            const stillMissingWindowFocus =
              !(
                (await windowModeModule.hasWindowFocus?.().catch(() => true)) ??
                true
              );

            if (reason === "multi_window_mode" && stillInMultiWindow) {
              if (isAppWindowMateriallyReduced()) {
                reportFocusLost("multi_window_mode");
              } else {
                setImmediateLockQuestionId(null);
              }
            } else if (
              reason === "window_focus_lost" &&
              stillMissingWindowFocus
            ) {
              reportFocusLost("window_focus_lost");
            } else {
              setImmediateLockQuestionId(null);
            }
          }, remainingMs + WINDOW_MODE_CLASSIFICATION_DELAY_MS);

          return;
        }

        const confirmedReason = await hasImmediateFairPlayWindowViolation();

        if (confirmedReason === reason) {
          reportFocusLost(reason);
          return;
        }

        setImmediateLockQuestionId(null);
      }, WINDOW_MODE_CLASSIFICATION_DELAY_MS);
    };

    const handleWindowMode = (payload: FairPlayWindowModePayload) => {
      if (!isMounted || !enabled || phase !== "question") {
        return;
      }

      if (
        typeof payload.userLeaveHintAtMs === "number" &&
        payload.userLeaveHintAtMs > lastUserLeaveHintAtRef.current
      ) {
        lastUserLeaveHintAtRef.current = payload.userLeaveHintAtMs;
      }

      if (
        (payload.eventSource === "top_resumed_changed" ||
          payload.eventSource === "poll") &&
        payload.isTopResumedActivity === false
      ) {
        clearWindowFocusTimer();
        cancelPendingWindowFocusLoss();
        cancelStrictWindowModeTimer();

        if (activeQuestionId) {
          setImmediateLockQuestionId(activeQuestionId);
        }

        windowFocusTimerRef.current = setTimeout(() => {
          windowFocusTimerRef.current = null;

          void (async () => {
            const activityState =
              (await windowModeModule
                .getActivityState?.()
                .catch(() => "resumed")) ?? "resumed";

            if (activityState !== "resumed") {
              setImmediateLockQuestionId(null);
              appStateRef.current =
                activityState === "stopped" ? "background" : "inactive";
              reportFocusLost(
                activityState === "stopped"
                  ? "app_backgrounded"
                  : "app_inactive",
              );
              return;
            }

            const hasRecentUserLeaveHint =
              Date.now() - lastUserLeaveHintAtRef.current <
              USER_LEAVE_HINT_SUPPRESSION_MS;

            if (hasRecentUserLeaveHint && appStateRef.current !== "active") {
              setImmediateLockQuestionId(null);
              reportFocusLost("app_inactive");
              return;
            }

            if (appStateRef.current !== "active") {
              setImmediateLockQuestionId(null);
              return;
            }

            reportFocusLost("picture_in_picture_mode");
          })();
        }, WINDOW_MODE_CLASSIFICATION_DELAY_MS);

        return;
      }

      if (
        payload.eventSource === "system_dialog_closed" &&
        (payload.systemDialogReason === "recentapps" ||
          payload.systemDialogReason === "homekey" ||
          payload.systemDialogReason === "lock")
      ) {
        lastUserLeaveHintAtRef.current = Date.now();
        appStateRef.current = "inactive";
        clearWindowFocusTimer();
        cancelPendingWindowFocusLoss();
        cancelStrictWindowModeTimer();
        reportFocusLost("app_inactive");
        return;
      }

      if (
        payload.activityState === "paused" ||
        payload.activityState === "stopped"
      ) {
        lastUserLeaveHintAtRef.current = Date.now();
        appStateRef.current =
          payload.activityState === "stopped" ? "background" : "inactive";
        clearWindowFocusTimer();
        cancelPendingWindowFocusLoss();
        cancelStrictWindowModeTimer();
        reportFocusLost(
          payload.activityState === "stopped"
            ? "app_backgrounded"
            : "app_inactive",
        );
        return;
      }

      const hasRecentUserLeaveHint =
        Date.now() - lastUserLeaveHintAtRef.current <
        USER_LEAVE_HINT_SUPPRESSION_MS;

      if (payload.userLeaveHint === true) {
        lastUserLeaveHintAtRef.current = Date.now();
        clearWindowFocusTimer();
        cancelPendingWindowFocusLoss();
        cancelStrictWindowModeTimer();

        if (payload.isInPictureInPictureMode === true) {
          reportImmediateWindowViolationIfActive("picture_in_picture_mode");
          return;
        } else if (payload.isInMultiWindowMode === true) {
          if (isAppWindowMateriallyReduced()) {
            reportImmediateWindowViolationIfActive("multi_window_mode");
            return;
          }
        }

        appStateRef.current = "inactive";
        reportFocusLost("app_inactive");
        return;
      }

      if (payload.isInPictureInPictureMode === true) {
        reportImmediateWindowViolationIfActive("picture_in_picture_mode");
        return;
      }

      if (payload.isInMultiWindowMode === true) {
        if (isAppWindowMateriallyReduced()) {
          reportImmediateWindowViolationIfActive("multi_window_mode");
        }
        return;
      }

      if (
        (payload.eventSource === "window_focus_changed" ||
          payload.eventSource === "poll") &&
        payload.hasWindowFocus === false
      ) {
        clearWindowFocusTimer();

        if (hasRecentUserLeaveHint) {
          appStateRef.current = "inactive";
          cancelStrictWindowModeTimer();
          reportFocusLost("app_inactive");
          return;
        }

        if (pendingWindowFocusLossTimeoutRef.current) {
          return;
        }

        pendingWindowFocusLossTimeoutRef.current = setTimeout(() => {
          pendingWindowFocusLossTimeoutRef.current = null;

          void (async () => {
            const activityState =
              (await windowModeModule
                .getActivityState?.()
                .catch(() => "resumed")) ?? "resumed";

            if (activityState !== "resumed") {
              appStateRef.current =
                activityState === "stopped" ? "background" : "inactive";
              reportFocusLost(
                activityState === "stopped"
                  ? "app_backgrounded"
                  : "app_inactive",
              );
              return;
            }

            if (
              pendingReasonRef.current === "app_inactive" ||
              pendingReasonRef.current === "app_backgrounded"
            ) {
              return;
            }

            if (appStateRef.current !== "active") {
              return;
            }

            const stillMissingWindowFocus =
              !(
                (await windowModeModule.hasWindowFocus?.().catch(() => true)) ??
                true
              );

            if (stillMissingWindowFocus) {
              reportFocusLost("window_focus_lost");
            }
          })();
        }, WINDOW_FOCUS_LOSS_CLASSIFICATION_DELAY_MS);

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
          (pendingReasonRef.current === "window_focus_lost" ||
            pendingReasonRef.current === "app_inactive" ||
            pendingReasonRef.current === "app_backgrounded")
        ) {
          setImmediateLockQuestionId(null);
          reportFocusReturned(activeQuestionId);
        }

        return;
      }

      if (
        payload.activityState === "resumed" &&
        payload.hasWindowFocus !== false
      ) {
        appStateRef.current = "active";
        lastUserLeaveHintAtRef.current = 0;
        cancelPendingWindowFocusLoss();
        clearWindowFocusTimer();

        if (
          pendingReasonRef.current === "app_inactive" ||
          pendingReasonRef.current === "app_backgrounded"
        ) {
          reportFocusReturned(activeQuestionId);
        }

        return;
      }
    };

    const pollWindowModeSnapshot = async (eventSource: "poll" | "snapshot") => {
      const [
        isInMultiWindowMode,
        isInPictureInPictureMode,
        hasWindowFocus,
        isTopResumedActivity,
        activityState,
      ] = await Promise.all([
        windowModeModule.isInMultiWindowMode?.().catch(() => false) ??
          Promise.resolve(false),
        windowModeModule.isInPictureInPictureMode?.().catch(() => false) ??
          Promise.resolve(false),
        windowModeModule.hasWindowFocus?.().catch(() => true) ??
          Promise.resolve(true),
        windowModeModule.isTopResumedActivity?.().catch(() => true) ??
          Promise.resolve(true),
        windowModeModule.getActivityState?.().catch(() => "resumed") ??
          Promise.resolve("resumed" as const),
      ]);

      handleWindowMode({
        activityState: activityState as FairPlayWindowModePayload["activityState"],
        eventSource,
        hasWindowFocus,
        isTopResumedActivity,
        isInMultiWindowMode,
        isInPictureInPictureMode,
      });
    };

    pollWindowModeSnapshot("snapshot").catch(() => {
      // Expo Go and older native builds will not expose this module.
    });

    let pollInFlight = false;
    const pollInterval = setInterval(() => {
      if (pollInFlight || !enabled || phase !== "question") {
        return;
      }

      pollInFlight = true;
      pollWindowModeSnapshot("poll")
        .catch(() => {
          // Native polling is best-effort on older development builds.
        })
        .finally(() => {
          pollInFlight = false;
        });
    }, WINDOW_MODE_POLL_INTERVAL_MS);

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
      clearInterval(pollInterval);
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

  return {
    isImmediateViolationPending: immediateLockQuestionId === activeQuestionId,
    isInGracePeriod: graceQuestionId === activeQuestionId,
  };
}
