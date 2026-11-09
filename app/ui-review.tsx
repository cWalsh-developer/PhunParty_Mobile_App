// Temporary isolated component harness. Removed after visual verification.
import { gameWebSocket } from "@/assets/api/gameWebSocketService";
import { partyColors } from "@/assets/theme/party";
import QRScanner from "@/components/QRScanner";
import TriviaGame from "@/components/TriviaGame";
import { PartyBrand } from "@/components/party/party-brand";
import { PartyResults } from "@/components/party/party-results";
import { normalizePartyResults } from "@/utils/party-results";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

export default function UIReview() {
  const { screen = "join", long = "0" } = useLocalSearchParams<{ screen?: string; long?: string }>();
  const [notice, setNotice] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (screen !== "question" && screen !== "text") return;
    const timer = setTimeout(() => {
      gameWebSocket.submitAnswer = () => true;
      gameWebSocket.onQuestionReceived?.({
        question_id: "preview-question",
        question: long === "1" ? "Which of the following animals has three hearts and uses copper-based blood to carry oxygen throughout its body?" : "Which animal has THREE hearts?",
        display_options: long === "1" ? ["An octopus, a marine animal known for its eight arms and remarkable intelligence", "A bottlenose dolphin, a marine mammal found in oceans around the world", "A great white shark", "An emperor penguin"] : ["Octopus", "Dolphin", "Shark", "Penguin"],
        game_type: "trivia",
        ui_mode: screen === "text" ? "text_input" : "multiple_choice",
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [screen, long]);

  const results = normalizePartyResults([
    { player_id: "mina", display_name: "Mina", score: 5200 },
    { player_id: "jules", display_name: "Jules", score: screen === "ties" ? 5200 : 4800 },
    { player_id: "dev", display_name: "Dev", score: 4100 },
    { player_id: "leo", display_name: "Leo", score: 3600 },
  ]);

  if (!mounted) return <View />;

  return (
    <View style={{ flex: 1, backgroundColor: partyColors.cream }}>
      {!!notice && <Text accessibilityRole="alert">{notice}</Text>}
      {screen === "join" ? (
        <QRScanner userName="Jules" showCamera={showCamera} setShowCamera={setShowCamera} scanned={scanned} setScanned={setScanned} handleBarCodeScanned={({ data }) => setNotice(`Joined ${data}`)} />
      ) : screen === "question" || screen === "text" ? (
        <>
          <View style={{ padding: 20 }}><PartyBrand compact /></View>
          <TriviaGame sessionCode="TEST12345" onGameEnd={() => setNotice("Game ended")} onError={setNotice} />
        </>
      ) : (
        <PartyResults results={screen === "empty" ? [] : results} currentPlayerId="jules" sessionCode="TEST12345" onLeave={() => setNotice("Returned to joining")} />
      )}
    </View>
  );
}
