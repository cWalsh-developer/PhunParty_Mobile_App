import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import type { FocusViolationReason } from "../api/gameWebSocketService";

interface UseFairPlayMonitorOptions {
  enabled: boolean;
  questionId?: string | null;
  phase: string;
  onViolation: (questionId: string, reason: FocusViolationReason) => void;
}

export function useFairPlayMonitor({
  enabled,
  questionId,
  phase,
  onViolation,
}: UseFairPlayMonitorOptions) {
  const reportedQuestionRef = useRef<string | null>(null);
  const activeQuestionId = enabled && phase === "question" ? questionId : null;

  useEffect(() => {
    reportedQuestionRef.current = null;
  }, [questionId]);

  const reportViolation = useCallback(
    (reason: FocusViolationReason) => {
      if (!activeQuestionId) {
        return;
      }

      if (reportedQuestionRef.current === activeQuestionId) {
        return;
      }

      reportedQuestionRef.current = activeQuestionId;
      onViolation(activeQuestionId, reason);
    },
    [activeQuestionId, onViolation],
  );

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "background") {
        reportViolation("app_backgrounded");
        return;
      }

      if (nextState === "inactive") {
        reportViolation("app_inactive");
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => subscription.remove();
  }, [reportViolation]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        reportViolation("screen_blurred");
      };
    }, [reportViolation]),
  );
}
