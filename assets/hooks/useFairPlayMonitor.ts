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
};

type FairPlayWindowModeModule = {
  isInMultiWindowMode?: () => Promise<boolean>;
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
  const [graceQuestionId, setGraceQuestionId] = useState<string | null>(null);
  const activeQuestionId = enabled && phase === "question" ? questionId : null;

  useEffect(() => {
    pendingQuestionRef.current = null;
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
      setGraceQuestionId(activeQuestionId);
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

    const handleWindowMode = (isInMultiWindowMode: boolean) => {
      if (!isMounted || !enabled || phase !== "question") {
        return;
      }

      if (isInMultiWindowMode) {
        reportFocusLost("multi_window_mode");
      }
    };

    windowModeModule
      .isInMultiWindowMode?.()
      .then(handleWindowMode)
      .catch(() => {
        // Expo Go and older native builds will not expose this module.
      });

    const emitter = new NativeEventEmitter(windowModeModule as any);
    const subscription = emitter.addListener(
      FAIR_PLAY_WINDOW_MODE_EVENT,
      (payload: FairPlayWindowModePayload) => {
        handleWindowMode(payload?.isInMultiWindowMode === true);
      },
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [enabled, phase, reportFocusLost, reportFocusReturned]);

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
