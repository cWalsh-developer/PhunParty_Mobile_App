import { partyColors, partyFonts } from "@/assets/theme/party";
import { PartyBrand, PartyMascot } from "@/components/party/party-brand";
import { PartyButton } from "@/components/party/party-button";
import { extractSessionCode, SESSION_CODE_LENGTH } from "@/utils/session-code";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Camera, CameraView } from "expo-camera";
import { useIsFocused } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ScannerPlayerInfo {
  player_id: string;
  player_name: string;
  profile_photo_url?: string;
}

interface QRScannerProps {
  userName: string;
  showCamera: boolean;
  setShowCamera: (value: boolean) => void;
  scanned: boolean;
  setScanned: (value: boolean) => void;
  handleBarCodeScanned: ({ data }: { data: string }) => void;
  isJoining?: boolean;
  error?: string | null;
  onClearError?: () => void;
  isGameMode?: boolean;
  onGameJoin?: (sessionCode: string, playerInfo: ScannerPlayerInfo) => void;
  playerInfo?: ScannerPlayerInfo;
}

export default function QRScanner({
  userName,
  showCamera,
  setShowCamera,
  scanned,
  setScanned,
  handleBarCodeScanned,
  isJoining = false,
  error,
  onClearError,
  isGameMode = false,
  onGameJoin,
  playerInfo,
}: QRScannerProps) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [roomCode, setRoomCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const permissionRequest = useRef(false);
  const canJoin = roomCode.length === SESSION_CODE_LENGTH && !isJoining && !requestingPermission;
  const visibleError = error || localError;

  const closeCamera = () => {
    setShowCamera(false);
    setScanned(false);
    setLocalError(null);
  };

  const openCamera = async () => {
    if (isJoining || permissionRequest.current) return;

    Keyboard.dismiss();
    permissionRequest.current = true;
    setRequestingPermission(true);
    setLocalError(null);
    onClearError?.();

    try {
      // Opening the scanner is the only action that requests camera access.
      const permission = await Camera.requestCameraPermissionsAsync();
      setPermissionDenied(!permission.granted);
      if (permission.granted) {
        setScanned(false);
        setShowCamera(true);
      } else {
        setLocalError(
          "Camera access is off. Enter the room code above, or enable camera access in Settings to scan.",
        );
      }
    } catch {
      setLocalError("The camera could not open. You can still join with a room code.");
    } finally {
      permissionRequest.current = false;
      setRequestingPermission(false);
    }
  };

  const joinWithData = (data: string) => {
    if (isJoining) return;
    setLocalError(null);
    onClearError?.();

    const code = extractSessionCode(data);
    if (code) setRoomCode(code);

    if (isGameMode && onGameJoin && playerInfo) {
      if (!code) {
        setScanned(true);
        setLocalError("That QR code is not a PhunParty room. Try the code on your host’s screen.");
        return;
      }
      setScanned(true);
      onGameJoin(code, playerInfo);
      return;
    }

    handleBarCodeScanned({ data });
  };

  const joinManually = () => {
    if (!canJoin) return;
    Keyboard.dismiss();
    joinWithData(roomCode);
  };

  if (showCamera) {
    return (
      <View style={styles.cameraScreen}>
        {isFocused && <StatusBar style="light" />}
        <CameraView
          style={StyleSheet.absoluteFill}
          onBarcodeScanned={scanned || isJoining ? undefined : ({ data }) => joinWithData(data)}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onMountError={() => {
            setShowCamera(false);
            setLocalError("The camera could not open. Enter the room code to join instead.");
          }}
        />
        <View style={[styles.cameraHeader, { paddingTop: insets.top + 16 }]}>
          <View style={styles.cameraTitle}>
            <Text style={styles.cameraTitleText}>Scan your host’s QR</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close camera and enter a room code"
            onPress={closeCamera}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={24} color={partyColors.ink} />
          </Pressable>
        </View>
        <View pointerEvents="none" style={styles.scanTargetContainer}>
          <View style={styles.scanTarget} />
        </View>
        <View style={[styles.cameraFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.cameraInstructions}>
            {visibleError ? (
              <Text selectable accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.cameraError}>
                {visibleError}
              </Text>
            ) : (
              <Text style={styles.cameraInstructionsText}>
                {isJoining ? "Joining your room…" : "Keep the QR code inside the frame."}
              </Text>
            )}
            {scanned && !isJoining ? (
              <PartyButton
                title="Scan again"
                onPress={() => {
                  setLocalError(null);
                  onClearError?.();
                  setScanned(false);
                }}
              />
            ) : null}
            <PartyButton title="Enter code instead" variant="secondary" onPress={closeCamera} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {isFocused && <StatusBar style="dark" />}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
          <View style={styles.contentWidth}>
            <Text style={styles.eyebrow}>Good company. Friendly competition.</Text>
            <View style={styles.brandRow}>
              <View style={styles.brandContainer}><PartyBrand /></View>
              <View accessible={false} style={styles.mascot}><PartyMascot size={82} /></View>
            </View>
            <Text style={styles.heroCopy}>Big brains. Loud friends.</Text>
            <Text style={styles.heroCopy}>Your phone. Your place in the game.</Text>
          </View>
        </View>

        <View style={[styles.form, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.contentWidth}>
            <View style={styles.headingRow}>
              <Text accessibilityRole="header" style={styles.heading}>Got a room code?</Text>
              <Ionicons name="ticket-outline" size={25} color={partyColors.ink} />
            </View>
            <Text nativeID="room-code-label" style={styles.label}>Room code · from your host</Text>
            <TextInput
              accessibilityLabel="Room code"
              accessibilityHint="Enter the nine letters and numbers shown by your host"
              accessibilityState={{ disabled: isJoining }}
              value={roomCode}
              onChangeText={(value) => {
                setRoomCode(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, SESSION_CODE_LENGTH));
                setLocalError(null);
                onClearError?.();
              }}
              editable={!isJoining && !requestingPermission}
              maxLength={SESSION_CODE_LENGTH}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              textContentType="none"
              placeholder="9-character code"
              placeholderTextColor={partyColors.muted}
              selectionColor={partyColors.purple}
              returnKeyType="go"
              onSubmitEditing={joinManually}
              style={styles.codeInput}
            />
            <Text style={styles.inputHint}>Enter all 9 letters and numbers to join.</Text>

            <Text style={[styles.label, styles.playerLabel]}>Playing as</Text>
            <View style={styles.playerIdentity}>
              <View style={styles.avatar} accessible={false}>
                <Text style={styles.avatarText}>{userName.trim().charAt(0).toUpperCase() || "?"}</Text>
              </View>
              <Text selectable style={styles.playerName}>{userName}</Text>
              <Ionicons name="lock-closed-outline" size={17} color={partyColors.muted} />
            </View>
            <Text style={styles.inputHint}>Using your player profile.</Text>

            {visibleError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={21} color={partyColors.danger} />
                <Text selectable accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorText}>
                  {visibleError}
                </Text>
              </View>
            ) : null}

            <PartyButton
              title={isJoining ? "Joining your room…" : "Join the party"}
              onPress={joinManually}
              disabled={!canJoin}
              loading={isJoining}
              style={styles.joinButton}
              icon={<Ionicons name="arrow-forward" size={21} color={partyColors.ink} />}
            />
            <View style={styles.orRow}>
              <View style={styles.divider} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.divider} />
            </View>
            <PartyButton
              title={requestingPermission ? "Opening camera…" : "Scan QR code"}
              onPress={openCamera}
              variant="secondary"
              disabled={isJoining || requestingPermission}
              loading={requestingPermission}
              icon={<Ionicons name="qr-code-outline" size={21} color={partyColors.ink} />}
            />
            {permissionDenied ? (
              <PartyButton
                title="Open camera settings"
                variant="text"
                onPress={() => {
                  void Linking.openSettings().catch(() => {
                    setLocalError("Open your device Settings to allow camera access. You can also use the room code.");
                  });
                }}
              />
            ) : null}
            <Text style={styles.footerText}>Your host starts the game. Keep this app open once you join.</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: partyColors.cream },
  scrollContent: { flexGrow: 1 },
  contentWidth: { width: "100%", maxWidth: 480, alignSelf: "center" },
  hero: { backgroundColor: partyColors.lime, paddingHorizontal: 24, paddingBottom: 26 },
  eyebrow: { fontSize: 12, fontWeight: "700", color: partyColors.ink, marginBottom: 14 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  brandContainer: { flex: 1 },
  mascot: { flexShrink: 0, transform: [{ rotate: "9deg" }] },
  heroCopy: { fontSize: 16, lineHeight: 22, color: partyColors.ink },
  form: { flex: 1, paddingHorizontal: 24, paddingTop: 26 },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 24 },
  heading: { fontFamily: partyFonts.display, fontSize: 24, lineHeight: 30, flex: 1, color: partyColors.ink },
  label: { color: partyColors.ink, fontWeight: "700", fontSize: 13, marginBottom: 8 },
  codeInput: { minHeight: 60, borderWidth: 2, borderColor: partyColors.ink, borderRadius: 12, backgroundColor: partyColors.white, paddingHorizontal: 16, paddingVertical: 12, fontSize: 22, fontWeight: "800", letterSpacing: 1, color: partyColors.ink },
  inputHint: { color: partyColors.muted, fontSize: 12, lineHeight: 17, marginTop: 6 },
  playerLabel: { marginTop: 20 },
  playerIdentity: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, backgroundColor: partyColors.white, borderColor: partyColors.border, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: partyColors.ink, backgroundColor: partyColors.lime, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "800", color: partyColors.ink },
  playerName: { flex: 1, color: partyColors.ink, fontSize: 16, fontWeight: "600" },
  joinButton: { marginTop: 22 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: partyColors.dangerSoft, borderRadius: 10, padding: 12, marginTop: 18 },
  errorText: { flex: 1, color: partyColors.danger, fontSize: 14, lineHeight: 20 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 },
  divider: { flex: 1, height: 1, backgroundColor: partyColors.border, opacity: 0.3 },
  orText: { color: partyColors.muted, fontSize: 13 },
  footerText: { textAlign: "center", fontSize: 12, lineHeight: 18, color: partyColors.muted, marginTop: 20 },
  cameraScreen: { flex: 1, backgroundColor: partyColors.ink },
  cameraHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 20 },
  cameraTitle: { flexShrink: 1, backgroundColor: partyColors.ink, padding: 12, borderRadius: 12 },
  cameraTitleText: { color: partyColors.white, fontSize: 16, fontWeight: "700" },
  closeButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: partyColors.cream, borderWidth: 2, borderColor: partyColors.ink, justifyContent: "center", alignItems: "center" },
  pressed: { opacity: 0.75 },
  scanTargetContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  scanTarget: { width: "100%", maxWidth: 280, aspectRatio: 1, borderRadius: 24, borderWidth: 4, borderColor: partyColors.lime },
  cameraFooter: { paddingHorizontal: 20 },
  cameraInstructions: { backgroundColor: partyColors.ink, borderRadius: 16, padding: 16, gap: 14 },
  cameraInstructionsText: { textAlign: "center", color: partyColors.white, fontSize: 16, lineHeight: 22 },
  cameraError: { color: partyColors.white, fontSize: 15, lineHeight: 21 },
});
