import dataAccess from "@/databaseAccess/dataAccess";
import { Camera } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { PlayerInfo } from "../assets/api/gameWebSocketService";
import { colors } from "../assets/theme/colors";
import { GameContainer } from "./components/GameContainer";
import QRScanner from "./components/QRScanner";

export default function GameSession() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [hasJoinedGame, setHasJoinedGame] = useState(false);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [showScanner, setShowScanner] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [hasLeftSession, setHasLeftSession] = useState(false);

  // Extract specific param values to avoid object dependency issues
  const paramSessionCode = params.sessionCode as string;
  const paramPlayerName = params.playerName as string;
  const paramPlayerId = params.playerId as string;
  const paramPlayerPhoto = params.playerPhoto as string;

  useEffect(() => {
    if (!initialized) {
      setupCamera();
      loadPlayerInfo();
      setInitialized(true);
    }
  }, [initialized]);

  // Handle session code parameter changes separately
  useEffect(() => {
    if (
      paramSessionCode &&
      paramPlayerName &&
      !hasJoinedGame &&
      !hasLeftSession
    ) {
      const playerData: PlayerInfo = {
        player_id: paramPlayerId || generatePlayerId(),
        player_name: paramPlayerName,
        player_photo: paramPlayerPhoto,
      };

      handleGameJoin(paramSessionCode, playerData);
    }
  }, [
    paramSessionCode,
    paramPlayerName,
    paramPlayerId,
    paramPlayerPhoto,
    hasJoinedGame,
    hasLeftSession,
  ]);

  const setupCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === "granted");
  };

  const loadPlayerInfo = async () => {
    try {
      // First try to use passed navigation parameters
      if (paramPlayerName) {
        const playerData: PlayerInfo = {
          player_id: paramPlayerId || generatePlayerId(),
          player_name: paramPlayerName,
          player_photo: paramPlayerPhoto || undefined,
        };
        setPlayerInfo(playerData);
        return;
      }

      // Fallback: Try to load existing player info from storage
      const savedPlayerName = await SecureStore.getItemAsync("player_name");
      const savedPlayerPhoto = await SecureStore.getItemAsync("player_photo");

      if (savedPlayerName) {
        const playerData: PlayerInfo = {
          player_id: generatePlayerId(),
          player_name: savedPlayerName,
          player_photo: savedPlayerPhoto || undefined,
        };
        setPlayerInfo(playerData);
      } else {
        // Show error instead of redirecting to profile
        Alert.alert(
          "Profile Required",
          "Please set up your profile first before joining a game session.",
          [
            {
              text: "Go to Profile",
              onPress: () => router.replace("/(tabs)/profileTab"),
            },
            { text: "Cancel", onPress: () => router.replace("/(tabs)/scanQR") },
          ]
        );
        return;
      }
    } catch (error) {
      console.error("Error loading player info:", error);
      Alert.alert(
        "Error",
        "Failed to load player information. Please try again.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)/scanQR") }]
      );
    }
  };
  const generatePlayerId = (): string => {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleGameJoin = (code: string, player: PlayerInfo) => {
    setSessionCode(code);
    setPlayerInfo(player);
    setHasJoinedGame(true);
    setShowScanner(false);
  };

  const handleSessionJoin = (code: string) => {
    if (playerInfo) {
      handleGameJoin(code, playerInfo);
    }
  };

  const handleLeaveGame = async () => {
    try {
      // Immediately mark that we've left to prevent auto-rejoin
      const playerId = playerInfo!.player_id;
      setHasLeftSession(true);
      setHasJoinedGame(false);
      setSessionCode(null);
      setShowScanner(false);

      // Call leave API and navigate
      await dataAccess.leaveGameSession(playerId);
      console.log(`Player ${playerId} has left the game session.`);

      // Clear the entire navigation stack and navigate to root
      router.dismissAll();
      router.replace("/(tabs)/scanQR");
    } catch (error) {
      console.error("Error leaving game session:", error);
      // Still navigate away even if API call fails
      router.dismissAll();
      router.replace("/(tabs)/scanQR");
    }
  };

  const handleScannerClose = () => {
    router.replace("/(tabs)/scanQR");
  };

  const showErrorAlert = (title: string, message: string) => {
    Alert.alert(title, message, [{ text: "OK" }]);
  };

  if (hasJoinedGame && sessionCode && playerInfo) {
    return (
      <GameContainer
        sessionCode={sessionCode}
        playerInfo={playerInfo}
        onLeaveGame={handleLeaveGame}
      />
    );
  }

  if (!playerInfo) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <QRScanner
        userName={playerInfo.player_name}
        showCamera={showScanner}
        setShowCamera={setShowScanner}
        scanned={scanned}
        setScanned={setScanned}
        hasPermission={hasPermission}
        handleBarCodeScanned={({ data }) => {
          setScanned(true);
          setShowScanner(false);
          // Default handler - won't be called in game mode
        }}
        // Game mode props
        isGameMode={true}
        onGameJoin={handleSessionJoin}
        playerInfo={{
          player_id: playerInfo.player_id,
          player_name: playerInfo.player_name,
          profile_photo_url: playerInfo.player_photo,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink[900],
  },
});
