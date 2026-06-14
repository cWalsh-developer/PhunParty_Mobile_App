import { presenceApi } from "@/assets/api/presenceApi";
import { UserContext } from "@/assets/authentication-storage/authContext";
import { useContext, useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

const HEARTBEAT_INTERVAL_MS = 20000;

export default function PresenceMonitor() {
  const userContext = useContext(UserContext);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const playerId = userContext?.user?.player_id;

    const stopHeartbeat = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (!playerId) {
      stopHeartbeat();
      return;
    }

    const sendHeartbeat = () => {
      presenceApi.sendHeartbeat().catch(() => undefined);
    };

    const startHeartbeat = () => {
      sendHeartbeat();

      if (!intervalRef.current) {
        intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
      }
    };

    startHeartbeat();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        startHeartbeat();
      }

      if (nextState.match(/inactive|background/)) {
        stopHeartbeat();
        presenceApi.setOffline().catch(() => undefined);
      }

      appState.current = nextState;
    });

    return () => {
      subscription.remove();
      stopHeartbeat();
      presenceApi.setOffline().catch(() => undefined);
    };
  }, [userContext?.user?.player_id]);

  return null;
}
