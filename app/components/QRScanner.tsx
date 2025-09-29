import { AppButton, AppCard } from "@/assets/components";
import { colors, layoutStyles, typography } from "@/assets/theme";
import Entypo from "@expo/vector-icons/Entypo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView } from "expo-camera";
import { Text, TouchableOpacity, View } from "react-native";
import Selector from "./Selector";

interface QRScannerProps {
  userName: string;
  showCamera: boolean;
  setShowCamera: (v: boolean) => void;
  scanned: boolean;
  setScanned: (v: boolean) => void;
  hasPermission: boolean | null;
  handleBarCodeScanned: ({ data }: { data: string }) => void;
  // Game-specific props (optional)
  isGameMode?: boolean;
  onGameJoin?: (sessionCode: string, playerInfo: any) => void;
  playerInfo?: {
    player_id: string;
    player_name: string;
    profile_photo_url?: string;
  };
}

export default function QRScanner({
  userName,
  showCamera,
  setShowCamera,
  scanned,
  setScanned,
  hasPermission,
  handleBarCodeScanned,
  isGameMode = false,
  onGameJoin,
  playerInfo,
}: QRScannerProps) {
  const handleQRScan = ({ data }: { data: string }) => {
    if (isGameMode && onGameJoin && playerInfo) {
      // Parse game session code from QR data
      const sessionCode = extractSessionCode(data);
      if (sessionCode) {
        onGameJoin(sessionCode, playerInfo);
      } else {
        // Invalid game QR code
        handleBarCodeScanned({ data });
      }
    } else {
      // Default behavior
      handleBarCodeScanned({ data });
    }
  };

  const extractSessionCode = (qrData: string): string | null => {
    try {
      // Handle different QR formats:
      // 1. Direct session code: "ABC123" or longer codes like "EXGRM3U8V"
      // 2. URL format: "https://phun.party/join/ABC123" or "https://phun.party/#/join/EXGRM3U8V"
      // 3. JSON format: {"session_code": "ABC123"}

      if (qrData.length >= 6 && /^[A-Z0-9]{6,}$/.test(qrData)) {
        return qrData;
      }

      if (qrData.includes("/join/")) {
        // Updated regex to handle variable length session codes
        const match = qrData.match(/\/join\/([A-Z0-9]+)/);
        return match ? match[1] : null;
      }

      try {
        const parsed = JSON.parse(qrData);
        return parsed.session_code || null;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  };
  if (hasPermission === null) {
    return (
      <View style={[layoutStyles.screen, layoutStyles.container]}>
        <Text style={typography.body}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[layoutStyles.screen, layoutStyles.container]}>
        <AppCard style={{ alignItems: "center" }}>
          <Ionicons
            name="camera-outline"
            size={48}
            color={colors.stone[400]}
            style={{ marginBottom: 16 }}
          />
          <Text
            style={[typography.h3, { marginBottom: 8, textAlign: "center" }]}
          >
            Camera Access Required
          </Text>
          <Text style={[typography.bodyMuted, { textAlign: "center" }]}>
            Please enable camera access in your device settings to scan QR codes
          </Text>
        </AppCard>
      </View>
    );
  }

  return (
    <View style={layoutStyles.screen}>
      {!showCamera ? (
        <View style={[layoutStyles.container, { justifyContent: "center" }]}>
          {/* Welcome Header */}
          <View style={{ alignItems: "center", marginBottom: 48 }}>
            <Text
              style={[typography.h1, { textAlign: "center", marginBottom: 8 }]}
            >
              Welcome,{"\n"}
              <Text style={{ color: colors.tea[400] }}>{userName}!</Text>
            </Text>
            <Text style={[typography.bodyMuted, { textAlign: "center" }]}>
              Ready to join the fun? Scan a game QR code to get started
            </Text>
          </View>

          {/* Join Game Card */}
          <AppCard style={{ alignItems: "center", marginBottom: 24 }}>
            <Entypo
              name="game-controller"
              size={64}
              color={colors.tea[400]}
              style={{ marginBottom: 24 }}
            />
            <Text
              style={[typography.h2, { marginBottom: 16, textAlign: "center" }]}
            >
              Join Game
            </Text>
            <Text
              style={[
                typography.body,
                { textAlign: "center", marginBottom: 32 },
              ]}
            >
              Tap the button below to open your camera and scan the host&apos;s
              QR code
            </Text>
            <Selector
              onPress={() => {
                setShowCamera(true);
                setScanned(false);
              }}
            >
              <AppButton
                title="Start Camera"
                onPress={() => {}}
                variant="primary"
                style={{ paddingHorizontal: 32 }}
                icon={
                  <Ionicons name="camera" size={20} color={colors.ink[900]} />
                }
              />
            </Selector>
          </AppCard>
        </View>
      ) : (
        <>
          {/* Camera View */}
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleQRScan}
            style={{ flex: 1 }}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          />

          {/* Close Button */}
          <View
            style={{
              position: "absolute",
              top: 60,
              right: 20,
              zIndex: 20,
            }}
          >
            <Selector
              onPress={() => {
                setShowCamera(false);
                setScanned(false);
              }}
            >
              <TouchableOpacity
                style={{
                  backgroundColor: colors.ink[800],
                  borderRadius: 25,
                  width: 50,
                  height: 50,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: colors.tea[400],
                }}
              >
                <Ionicons name="close" size={24} color={colors.stone[100]} />
              </TouchableOpacity>
            </Selector>
          </View>

          {/* Scanning Frame */}
          <View
            style={{
              position: "absolute",
              top: "25%",
              left: "15%",
              width: "70%",
              height: "30%",
              borderWidth: 3,
              borderColor: colors.tea[400],
              borderRadius: 12,
              zIndex: 10,
            }}
          />

          {/* Instructions */}
          <View
            style={{
              position: "absolute",
              bottom: 100,
              left: 20,
              right: 20,
              alignItems: "center",
              zIndex: 10,
            }}
          >
            <View
              style={{
                backgroundColor: `${colors.ink[800]}CC`,
                paddingHorizontal: 24,
                paddingVertical: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.tea[400],
              }}
            >
              <Text
                style={[
                  typography.body,
                  {
                    textAlign: "center",
                    color: colors.stone[100],
                    fontWeight: "600",
                  },
                ]}
              >
                {isGameMode
                  ? "Scan the game QR code to join session"
                  : "Position the QR code within the frame"}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
