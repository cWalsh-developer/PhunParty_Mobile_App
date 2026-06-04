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
      if (!activeQuestionId) {
        return;
      }

      if (pendingQuestionRef.current === activeQuestionId) {
        return;
      }

      pendingQuestionRef.current = activeQuestionId;

      const isImmediateViolation =
        reason === "multi_window_mode" ||
        reason === "picture_in_picture_mode" ||
        reason === "window_focus_lost";

      if (!isImmediateViolation) {
        setGraceQuestionId(activeQuestionId);
      }

      onFocusLost(activeQuestionId, reason);
    },
    [activeQuestionId, onFocusLost],
  );

  const reportFocusReturned = useCallback(() => {
    const pendingQuestionId = pendingQuestionRef.current;

    if (!pendingQuestionId) {
      return;
    }

    pendingQuestionRef.current = null;
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
        reportFocusReturned();
        return;
      }

      if (nextState === "background") {
        reportFocusLost("app_backgrounded");
        return;
      }

      if (nextState === "inactive") {
        reportFocusLost("app_inactive");
      }
    },
    [reportFocusLost, reportFocusReturned],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => subscription.remove();
  }, [handleAppStateChange]);

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
        reportFocusLost("picture_in_picture_mode");
        return;
      }

      if (payload.isInMultiWindowMode === true) {
        clearWindowFocusTimer();
        reportFocusLost("multi_window_mode");
        return;
      }

      if (payload.hasWindowFocus === false) {
        handleWindowFocusLost();
        return;
      }

      /*
       * Do not call reportFocusReturned() here.
       *
       * Multi-window and picture-in-picture are immediate Fair Play violations.
       * Window-focus loss only reports after a debounce if the app remains active.
       *
       * Normal app switching/backgrounding is handled by AppState and keeps the
       * grace-period behaviour.
       */
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
        reportFocusLost("screen_blurred");
      };
    }, [reportFocusLost, reportFocusReturned]),
  );

  return { isInGracePeriod: graceQuestionId === activeQuestionId };
}
