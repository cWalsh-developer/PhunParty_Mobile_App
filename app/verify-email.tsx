import { UserContext } from "@/assets/authentication-storage/authContext";
import { verifyEmailToken } from "@/assets/authentication-storage/authenticationLogic";
import { partyColors } from "@/assets/theme/party";
import { AuthScreen, authStyles } from "@/components/party/auth-screen";
import { PartyButton } from "@/components/party/party-button";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type VerificationResult = { token: string; state: "verified" | "error" };

export default function VerifyEmail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = (Array.isArray(params.token) ? params.token[0] : params.token)?.trim();
  const { setUser } = useContext(UserContext)!;
  const [result, setResult] = useState<VerificationResult | null>(null);
  const request = useRef<{ token: string; promise: Promise<boolean> } | null>(null);
  const state = !token ? "error" : result?.token === token ? result.state : "verifying";

  useEffect(() => {
    if (!token) return;
    let active = true;
    // Reuse the request across effect cleanup/restarts so one-time tokens are
    // not submitted twice by development Strict Mode.
    if (request.current?.token !== token) {
      request.current = { token, promise: verifyEmailToken({ token }, setUser) };
    }
    request.current.promise.then((verified) => {
      if (active) setResult({ token, state: verified ? "verified" : "error" });
    }).catch(() => {
      if (active) setResult({ token, state: "error" });
    });
    return () => { active = false; };
  }, [token, setUser]);

  const message = state === "verified"
    ? "Your email is verified and you’re signed in. All that’s left is joining a game."
    : state === "verifying"
      ? "We’re checking your verification link. This should only take a moment."
      : !token
        ? "This link is missing its verification code. Open the complete link from your email."
        : "This verification link could not be confirmed. It may have expired or already been used. Try signing in, or request another verification email.";

  return (
    <AuthScreen
      title={state === "verified" ? "You’re\nverified." : state === "verifying" ? "One quick\ncheck." : "Link not\nverified."}
      description={state === "verified" ? "You’re ready for the next round." : "Let’s finish setting up your account."}
      tone={state === "verified" ? "lime" : "lavender"}
    >
      <View style={styles.statusCard}>
        <View style={[styles.statusIcon, { backgroundColor: state === "verified" ? partyColors.lime : state === "error" ? partyColors.dangerSoft : partyColors.lavender }]}>
          {state === "verifying" ? (
            <ActivityIndicator size="large" color={partyColors.purple} accessibilityLabel="Verifying email" />
          ) : (
            <Ionicons name={state === "verified" ? "checkmark" : "mail-unread-outline"} size={36} color={partyColors.ink} />
          )}
        </View>
        <Text
          selectable
          accessibilityLiveRegion="polite"
          accessibilityRole={state === "error" ? "alert" : undefined}
          style={authStyles.body}
        >
          {message}
        </Text>
      </View>
      {state === "verified" ? (
        <PartyButton title="Join a game" onPress={() => router.replace("/(tabs)/scanQR")} icon={<Ionicons name="arrow-forward" size={21} color={partyColors.ink} />} />
      ) : state === "error" ? (
        <PartyButton title="Go to sign in" onPress={() => router.replace("/login")} />
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  statusCard: { padding: 22, borderWidth: 2, borderColor: partyColors.border, backgroundColor: partyColors.white, borderRadius: 18, marginBottom: 22, gap: 22 },
  statusIcon: { width: 68, height: 68, borderWidth: 2, borderColor: partyColors.border, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
