import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import type { FocusViolationReason } from "../api/gameWebSocketService";

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
