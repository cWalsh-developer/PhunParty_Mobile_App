// Temporary isolated visual fixture. Never shipped as an app route.
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { gameWebSocket } from "@/assets/api/gameWebSocketService";
import API from "@/assets/api/API";
import { friendsApi } from "@/assets/api/friendsApi";
import { presenceApi } from "@/assets/api/presenceApi";
import { privacyApi, DEFAULT_PRIVACY_SETTINGS } from "@/assets/api/privacyApi";
import { notificationsApi } from "@/assets/api/notificationsApi";
import { pushNotificationService } from "@/assets/api/pushNotificationService";
import { UserContext } from "@/assets/authentication-storage/authContext";
import { partyColors } from "@/assets/theme/party";
import FriendsScreen from "@/components/FriendsScreen";
import ProfileTab from "@/app/(tabs)/profileTab";
import BuzzerGame from "@/components/BuzzerGame";
import BeatTheClockGame from "@/components/BeatTheClockGame";
import dataAccess from "@/databaseAccess/dataAccess";
import Toast from "@/components/Toast";
import { PartyBrand } from "@/components/party/party-brand";

const friend = { player_id: "mina", player_name: "Mina", relationship_status: "friends", can_view_profile: true, can_view_game_stats: true, is_online: true };
const initialUser = { player_id: "preview", player_name: "Jules", player_email: "jules@example.com", player_mobile: "+447700900123", profile_photo_url: null, active_game_code: null };
const ok = (result: any) => ({ isSuccess: true, result, message: "" });

export default function RestReview() {
  const { screen = "profile", long = "0" } = useLocalSearchParams<{ screen?: string; long?: string }>();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(initialUser);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (friendsApi as any).getMyCode = async () => ok({ friend_code: "JULES123", friend_request_notifications_enabled: false });
    (friendsApi as any).getFriends = async () => ok(screen === "friends-empty" ? [] : [friend, { ...friend, player_id: "dev", player_name: "Dev Patel", is_online: false }]);
    (friendsApi as any).getIncomingRequests = async () => ok([{ id: "r1", sender: { ...friend, player_name: "Leo", relationship_status: "incoming_pending" }, sender_player_id: "leo", receiver_player_id: "preview", status: "pending" }]);
    (friendsApi as any).getOutgoingRequests = async () => ok([]);
    (friendsApi as any).searchByCode = async () => ok({ ...friend, player_name: "Alex", relationship_status: "none" });
    (friendsApi as any).sendRequest = async () => { setNotice("Friend request sent"); return ok({}); };
    (friendsApi as any).getProfile = async () => ok(friend);
    (friendsApi as any).getProfileStats = async () => ok({ games_played: 12, wins: 4, losses: 7, draws: 1, win_percentage: 33, loss_percentage: 58, draw_percentage: 9 });
    (presenceApi as any).getFriendsPresence = async () => ok([]);
    (privacyApi as any).getSettings = async () => ok(DEFAULT_PRIVACY_SETTINGS);
    (privacyApi as any).updateSettings = async (settings: any) => { setNotice("Privacy preference saved"); return ok(settings); };
    (notificationsApi as any).updateSettings = async (settings: any) => { setNotice("Notification preference saved"); return ok(settings); };
    (pushNotificationService as any).registerForPushNotifications = async () => ({ registered: true });
    (dataAccess as any).updatePlayer = async () => { setNotice("Profile saved"); return true; };
    (API.gameSession as any).getCurrentQuestion = async () => ({ isSuccess: false });
    gameWebSocket.playerInfo = { player_id: "preview", player_name: "Jules" };
    gameWebSocket.requestCurrentQuestion = () => true;
    gameWebSocket.setReadyForQuestions = () => {};
    gameWebSocket.pressBuzzer = () => { setNotice("Buzz sent"); return true; };
    gameWebSocket.submitAnswer = () => { setNotice("Answer sent"); return true; };
    (window as any).preview = {
      question: (data: any) => gameWebSocket.onQuestionReceived?.(data),
      buzzer: (data: any) => gameWebSocket.onBuzzerUpdate?.(data),
      result: (data: any) => gameWebSocket.onBeatClockAnswerResult?.(data),
    };
    setMounted(true);
  }, [screen]);

  useEffect(() => {
    if (!mounted || !["buzzer", "clock", "clock-text"].includes(screen)) return;
    const timer = setTimeout(() => {
      gameWebSocket.onQuestionReceived?.({
        question_id: screen === "buzzer" ? "BUZZ1" : "BTC1",
        question: long === "1" ? "Which of these animals has three hearts and uses copper-based blood to carry oxygen throughout its body?" : "Which animal has THREE hearts?",
        game_type: screen === "buzzer" ? "buzzer" : "beat_the_clock",
        ui_mode: screen === "clock-text" ? "text_input" : "multiple_choice",
        display_options: long === "1" ? ["An octopus, known for its eight arms and remarkable intelligence", "A bottlenose dolphin, a marine mammal found in oceans worldwide", "A great white shark", "An emperor penguin"] : ["Octopus", "Dolphin", "Shark", "Penguin"],
        button_state: "active",
        ends_at: new Date(Date.now() + 90000).toISOString(),
        score: 1200, answered_count: 5, correct_count: 4,
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [mounted, screen, long]);

  if (!mounted) return null;
  return (
    <UserContext.Provider value={{ user, setUser: setUser as any }}>
      <View style={{ flex: 1, backgroundColor: partyColors.cream }}>
        {!!notice && <Text testID="notice" accessibilityRole="alert">{notice}</Text>}
        {screen.startsWith("friends") ? <FriendsScreen playerId="preview" /> :
        screen === "profile" ? <ProfileTab /> :
        screen === "toast" ? <Toast visible message="Your profile is ready. Let the games begin!" type="success" duration={30000} onHide={() => setNotice("Dismissed")} /> :
        <><View style={{ padding: 20 }}><PartyBrand compact /></View>{screen === "buzzer" || screen === "buzzer-waiting" ? <BuzzerGame sessionCode="TEST12345" onGameEnd={() => {}} onError={setNotice} /> : <BeatTheClockGame sessionCode="TEST12345" onGameEnd={() => {}} onError={setNotice} />}</>}
      </View>
    </UserContext.Provider>
  );
}
