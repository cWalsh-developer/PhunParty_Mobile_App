import { UserContext } from "@/assets/authentication-storage/authContext";
import { createUserContext } from "@/assets/authentication-storage/authenticationLogic";
import { Camera } from "expo-camera";
import { useContext, useEffect, useState } from "react";
import QRScanner from "../components/QRScanner";
export default function QRScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const { user, setUser } = useContext(UserContext)!;
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
    createUserContext(setUser);
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    alert(`QR Code Scanned: ${data}`);
    setShowCamera(false);
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
