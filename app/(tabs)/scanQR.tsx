import API from "@/assets/api/API";
import { SessionJoinInfo } from "@/assets/api/gameTypes";
import { UserContext } from "@/assets/authentication-storage/authContext";
import { createUserContext } from "@/assets/authentication-storage/authenticationLogic";
import { Camera } from "expo-camera";
import { useRouter } from "expo-router";
import { useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import QRScanner from "../components/QRScanner";

export default function QRScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isJoiningSession, setIsJoiningSession] = useState(false);
  const { user, setUser } = useContext(UserContext)!;
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
    createUserContext(setUser);
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (isJoiningSession) return; // Prevent multiple scans

    setScanned(true);
    setShowCamera(false);

    // Check if this looks like a game session QR code
    const isGameQR =
      (data.length === 6 && /^[A-Z0-9]{6}$/.test(data)) ||
      data.includes("/join/") ||
      data.includes("session_code");

    if (isGameQR) {
      // Extract session code from QR data
      let sessionCode = data;
      if (data.includes("/join/")) {
        const match = data.match(/\/join\/([A-Z0-9]{6})/);
        sessionCode = match ? match[1] : data;
      } else if (data.includes("session_code")) {
        try {
          const parsed = JSON.parse(data);
          sessionCode = parsed.session_code || data;
        } catch {
          // Keep original data if parsing fails
        }
      }

      if (!user?.player_id) {
        Alert.alert("Login Required", "Please login to join a game session", [
          {
            text: "OK",
            onPress: () => {
              setScanned(false);
              setShowCamera(true);
            },
          },
        ]);
        return;
      }

      // Join the session via API first
      try {
        setIsJoiningSession(true);

        // Get session join info first to validate the session
        const joinInfoResponse = await API.gameSession.getJoinInfo(sessionCode);

        if (!joinInfoResponse.isSuccess) {
          throw new Error(joinInfoResponse.message || "Session not found");
        }

        const sessionInfo: SessionJoinInfo = joinInfoResponse.result;

        // Now join the session
        const joinResponse = await API.gameSession.join(
          sessionCode,
          user.player_id
        );

        if (!joinResponse.isSuccess) {
          // Handle specific error cases
          if (joinResponse.message?.includes("already in a game session")) {
            Alert.alert(
              "Already in Game",
              "You are already in an active game session. Please leave your current session first.",
              [
                {
                  text: "OK",
                  onPress: () => {
                    setScanned(false);
                    setShowCamera(true);
                    setIsJoiningSession(false);
                  },
                },
              ]
            );
            return;
          }
          throw new Error(joinResponse.message || "Failed to join session");
        }

        console.log("Successfully joined session:", sessionInfo);

        // Navigate to game session with session info and user data
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
      } catch (error: any) {
        console.error("Error joining session:", error);
        Alert.alert(
          "Failed to Join Session",
          error.message || "Please check the QR code and try again.",
          [
            {
              text: "Try Again",
              onPress: () => {
                setScanned(false);
                setShowCamera(true);
                setIsJoiningSession(false);
              },
            },
          ]
        );
      } finally {
        setIsJoiningSession(false);
      }
    } else {
      // Regular QR code - show alert
      alert(`QR Code Scanned: ${data}`);
      // Reset scanner for another scan
      setTimeout(() => {
        setScanned(false);
        setShowCamera(true);
      }, 2000);
    }
  };

  return (
    <QRScanner
      userName={user?.player_name || "Player"}
      showCamera={showCamera}
      setShowCamera={setShowCamera}
      scanned={scanned}
      setScanned={setScanned}
      hasPermission={hasPermission}
      handleBarCodeScanned={handleBarCodeScanned}
    />
  );
}
