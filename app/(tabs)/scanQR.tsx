import { UserContext } from "@/assets/authentication-storage/authContext";
import { Camera } from "expo-camera";
import React, { useContext, useEffect, useState } from "react";
import QRScanner from "../components/QRScanner";

export default function QRScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const { user } = useContext(UserContext)!;

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    alert(`QR Code Scanned: ${data}`);
    setShowCamera(false);
  };

  return (
    <QRScanner
      userName={user?.UserName || "Player"}
      showCamera={showCamera}
      setShowCamera={setShowCamera}
      scanned={scanned}
      setScanned={setScanned}
      hasPermission={hasPermission}
      handleBarCodeScanned={handleBarCodeScanned}
    />
  );
}
