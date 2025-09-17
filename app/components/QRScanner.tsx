import Entypo from "@expo/vector-icons/Entypo";
import { CameraView } from "expo-camera";
import React from "react";
import { StyleSheet, View } from "react-native";
import { IconButton, Text } from "react-native-paper";
import AppButton from "./AppButton";
import Selector from "./Selector";

interface QRScannerProps {
  userName: string;
  showCamera: boolean;
  setShowCamera: (v: boolean) => void;
  scanned: boolean;
  setScanned: (v: boolean) => void;
  hasPermission: boolean | null;
  handleBarCodeScanned: ({ data }: { data: string }) => void;
}

export default function QRScanner({
  userName,
  showCamera,
  setShowCamera,
  scanned,
  setScanned,
  hasPermission,
  handleBarCodeScanned,
}: QRScannerProps) {
  if (hasPermission === null) return <Text>Requesting permission...</Text>;
  if (hasPermission === false) return <Text>No camera access</Text>;

  return (
    <View style={styles.container}>
      {!showCamera ? (
        <>
          <View style={styles.heading}>
            <Text style={styles.headingText} variant="headlineMedium">
              Welcome, {userName || "Player"}!
            </Text>
          </View>
          <View style={styles.textView}>
            <Text style={{ marginBottom: 20, textAlign: "center" }}>
              Press "Join Game" below to scan the QR code and enter the game
            </Text>
            <Selector onPress={() => setShowCamera(true)}>
              <AppButton onPress={() => {}} mode="contained">
                <View style={styles.buttonIconRow}>
                  <Entypo name="game-controller" size={20} color="white" />
                  <Text style={{ color: "white" }}>Join Game</Text>
                </View>
              </AppButton>
            </Selector>
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
  buttonIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
