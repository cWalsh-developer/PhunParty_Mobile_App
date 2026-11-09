import API from "@/assets/api/API";
import { SessionJoinInfo } from "@/assets/api/gameTypes";
import { UserContext } from "@/assets/authentication-storage/authContext";
import { createUserContext } from "@/assets/authentication-storage/authenticationLogic";
import QRScanner from "@/components/QRScanner";
import dataAccess from "@/databaseAccess/dataAccess";
import { extractSessionCode } from "@/utils/session-code";
import { useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";

export default function QRScannerScreen() {
  const [scanned, setScanned] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isJoiningSession, setIsJoiningSession] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const joining = useRef(false);
  const { user, setUser } = useContext(UserContext)!;
  const router = useRouter();

  useEffect(() => {
    void createUserContext(setUser);
  }, [setUser]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    // A ref also guards duplicate camera events before React rerenders.
    if (joining.current) return;

    setScanned(true);
    setShowCamera(false);
    setJoinError(null);
    const sessionCode = extractSessionCode(data);

    if (!sessionCode) {
      setJoinError("Use the 9-character room code or scan the QR code on your host’s screen.");
      setScanned(false);
      return;
    }

    if (!user?.player_id) {
      setJoinError("Your player profile is not available. Please sign in again to join a game.");
      setScanned(false);
      return;
    }

    joining.current = true;
    setIsJoiningSession(true);

    try {
      const joinInfoResponse = await API.gameSession.getJoinInfo(sessionCode);
      if (!joinInfoResponse.isSuccess) {
        throw new Error(joinInfoResponse.message || "Session not found");
      }

      const sessionInfo: SessionJoinInfo = joinInfoResponse.result;
      const joinResponse = await API.gameSession.join(sessionCode);

      if (!joinResponse.isSuccess) {
        const message = joinResponse.message?.toLowerCase() || "";
        const alreadyInSession = message.includes("already in a game session") || message.includes("already in session");

        if (!alreadyInSession) {
          throw new Error(joinResponse.message || "Could not join this room. Please try again.");
        }

        // Preserve rejoining the current session and leaving a different one.
        if (user.active_game_code !== sessionCode) {
          let leftPreviousSession = false;
          try {
            leftPreviousSession = await dataAccess.leaveGameSession(user.player_id);
          } catch {
            throw new Error("Could not leave your previous game. Please try again.");
          }

          if (!leftPreviousSession) {
            throw new Error("You are in another game, and it could not be left automatically. Please try again.");
          }

          const retryJoinResponse = await API.gameSession.join(sessionCode);
          if (!retryJoinResponse.isSuccess) {
            throw new Error(retryJoinResponse.message || "Could not join this room. Please try again.");
          }
        }
      }

      router.push({
        pathname: "../gameSession" as any,
        params: {
          sessionCode: sessionInfo.session_code,
          hostName: sessionInfo.host_name,
          gameCode: sessionInfo.game_code,
          numberOfQuestions: sessionInfo.number_of_questions.toString(),
          websocketUrl: sessionInfo.websocket_url,
          playerName: user.player_name,
          playerId: user.player_id,
          playerPhoto: user.profile_photo_url || undefined,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not join this room. Please try again.";
      if (message.toLowerCase().includes("session not found")) {
        setJoinError(`Room ${sessionCode} was not found. Check the code with your host; the room may have ended.`);
      } else if (/network|fetch|connection/i.test(message)) {
        setJoinError("Check your internet connection, then try joining again.");
      } else {
        setJoinError(message);
      }
      // Keep the code and return to the form. Retrying never opens the camera
      // unexpectedly; players can explicitly choose either joining method.
      setScanned(false);
    } finally {
      joining.current = false;
      setIsJoiningSession(false);
    }
  };

  return (
    <QRScanner
      userName={user?.player_name || "Your player profile"}
      showCamera={showCamera}
      setShowCamera={setShowCamera}
      scanned={scanned}
      setScanned={setScanned}
      handleBarCodeScanned={handleBarCodeScanned}
      isJoining={isJoiningSession}
      error={joinError}
      onClearError={() => setJoinError(null)}
    />
  );
}
