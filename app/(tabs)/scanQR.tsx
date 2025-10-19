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
      (data.length === 9 && /^[A-Z0-9]{9}$/.test(data)) ||
      data.includes("/join/") ||
      data.includes("session_code") ||
      data.includes("phun.party");

    if (isGameQR) {
      // Extract session code from QR data
      let sessionCode = data;



      if (data.includes("/join/")) {
        // Handle both #/join/ and /join/ patterns
        const match = data.match(/#?\/join\/([A-Z0-9]{9})/i);
        sessionCode = match ? match[1] : data;

      } else if (data.includes("session_code")) {
        try {
          const parsed = JSON.parse(data);
          sessionCode = parsed.session_code || data;

        } catch (parseError) {

          // Keep original data if parsing fails
        }
      } else {

      }

      // Validate session code format
      if (!sessionCode || !/^[A-Z0-9]{9}$/.test(sessionCode)) {
        Alert.alert(
          "Invalid QR Code",
          `The scanned QR code does not contain a valid session code. Expected 9 alphanumeric characters, got: ${sessionCode}`,
          [
            {
              text: "Try Again",
              onPress: () => {
                setScanned(false);
                setShowCamera(true);
              },
            },
          ]
        );
        return;
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





        // Check if user is trying to rejoin the same session they're already in
        if (user.active_game_code === sessionCode) {

          // Allow rejoin - just navigate to the game session
        }

        // Get session join info first to validate the session
        const joinInfoResponse = await API.gameSession.getJoinInfo(sessionCode);



        if (!joinInfoResponse.isSuccess) {
          console.error(
            "Failed to get session info:",
            joinInfoResponse.message
          );
          throw new Error(joinInfoResponse.message || "Session not found");
        }

        const sessionInfo: SessionJoinInfo = joinInfoResponse.result;

        // Now join the session
        console.log("📞 Calling API.gameSession.join with:", {
          sessionCode,
          playerId: user.player_id,
        });

        const joinResponse = await API.gameSession.join(
          sessionCode,
          user.player_id
        );

        console.log("📞 Join API response:", {
          isSuccess: joinResponse.isSuccess,
          message: joinResponse.message,
          hasResult: !!joinResponse.result,
        });

        if (!joinResponse.isSuccess) {


          // Handle specific error cases
          const errorMsg = joinResponse.message?.toLowerCase() || "";

          if (errorMsg.includes("already in a game session") ||
              errorMsg.includes("already in session")) {

            // Check if they're trying to rejoin the same session
            if (user.active_game_code === sessionCode) {

              // Continue to navigation - they're rejoining the same session
            } else {
              // They're in a different session - try to leave it first


              try {
                const dataAccess = (await import("@/databaseAccess/dataAccess")).default;
                const leaveResult = await dataAccess.leaveGameSession(user.player_id);

                if (leaveResult) {


                  // Retry join
                  const retryJoinResponse = await API.gameSession.join(
                    sessionCode,
                    user.player_id
                  );

                  if (retryJoinResponse.isSuccess) {

                    // Continue to navigation
                  } else {
                    // Still failed - show alert
                    Alert.alert(
                      "Unable to Join",
                      `Could not join session. ${retryJoinResponse.message || "Please try again."}`,
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
                } else {
                  Alert.alert(
                    "Already in Game",
                    `You are already in a different game session. Could not leave it automatically. Please try again.`,
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
              } catch (leaveError: any) {

                Alert.alert(
                  "Error",
                  "Could not leave previous session. Please try again.",
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
            }
          } else {
            // Other error - throw it
            throw new Error(joinResponse.message || "Failed to join session");
          }
        } else {

        }



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


        console.error("User context:", {
          player_id: user?.player_id,
          player_name: user?.player_name,
        });

        let errorMessage = "Please check the QR code and try again.";

        if (error.message?.includes("Session not found")) {
          errorMessage = `Session "${sessionCode}" was not found. The session may have expired or the QR code may be invalid.`;
        } else if (error.message?.includes("network")) {
          errorMessage =
            "Network error. Please check your internet connection and try again.";
        } else if (error.message) {
          errorMessage = error.message;
        }

        Alert.alert("Failed to Join Session", errorMessage, [
          {
            text: "Try Again",
            onPress: () => {
              setScanned(false);
              setShowCamera(true);
              setIsJoiningSession(false);
            },
          },
        ]);
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
