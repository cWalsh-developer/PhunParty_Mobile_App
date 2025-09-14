import { useAuth } from "@/assets/authentication-storage/authContext";
import { Camera, CameraView } from "expo-camera";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, IconButton, Text } from "react-native-paper";

export default function QRScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const { user } = useAuth();

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

  if (hasPermission === null) return <Text>Requesting permission...</Text>;
  if (hasPermission === false) return <Text>No camera access</Text>;

  return (
    <View style={styles.container}>
      {!showCamera ? (
        <>
          <View style={styles.heading}>
            <Text style={styles.headingText} variant="headlineMedium">
              Welcome, {user?.name}
            </Text>
          </View>
          <View style={styles.textView}>
            <Text style={{ marginBottom: 20, textAlign: "center" }}>
              Press "Join Game" below to scan the QR code and enter the game
            </Text>
            <Button
              onPress={() => setShowCamera(true)}
              mode="contained"
              theme={{ colors: { primary: "#201e23ff" } }}
            >
              Join Game
            </Button>
          </View>
        </>
      ) : (
        <>
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          />
          <View
            style={{ position: "absolute", top: 40, right: 20, zIndex: 20 }}
          >
            <IconButton
              icon="close"
              size={18}
              onPress={() => {
                setShowCamera(false);
                setScanned(false);
              }}
              style={{ backgroundColor: "white", elevation: 2 }}
              iconColor="#201e23ff"
            />
          </View>
          <View style={styles.view} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  button: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  view: {
    position: "absolute",
    top: "35%",
    left: "15%",
    width: "70%",
    height: "30%",
    borderWidth: 3,
    borderColor: "#fefefeff",
    borderRadius: 12,
    zIndex: 10,
  },
  textView: {
    position: "absolute",
    top: "50%",
    left: "10%",
    width: "80%",
    padding: 10,
    textAlign: "center",
    color: "#fefefeff",
    fontSize: 16,
    fontWeight: "bold",
    zIndex: 10,
  },
  heading: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 20,
  },
  headingText: {
    color: "#201e23ff",
    fontSize: 24,
    textAlign: "center",
  },
});
