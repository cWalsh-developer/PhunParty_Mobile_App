import { UserContext } from "@/assets/authentication-storage/authContext";
import { createUserContext } from "@/assets/authentication-storage/authenticationLogic";
import { Camera } from "expo-camera";
import { useRouter } from "expo-router";
import { useContext, useEffect, useState } from "react";
import QRScanner from "../components/QRScanner";

export default function QRScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const { user, setUser } = useContext(UserContext)!;
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
    createUserContext(setUser);
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
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

      // Navigate to game session with user data and session code
      router.push({
        pathname: "../gameSession" as any,
        params: {
          sessionCode,
          playerName: user?.player_name || "Player",
          playerId: user?.player_id || undefined,
          playerPhoto: user?.profile_photo_url || undefined,
        },
      });
    } else {
      // Regular QR code - show alert
      alert(`QR Code Scanned: ${data}`);
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
