import { UserContext } from "@/assets/authentication-storage/authContext";
import { verifyEmailToken } from "@/assets/authentication-storage/authenticationLogic";
import { AppButton, AppCard } from "@/assets/components";
import { colors, layoutStyles, typography } from "@/assets/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

type VerificationState = "verifying" | "verified" | "error";

export default function VerifyEmail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const { setUser } = useContext(UserContext)!;
  const [state, setState] = useState<VerificationState>("verifying");
  const [message, setMessage] = useState("Verifying your email...");
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    if (!token) {
      setState("error");
      setMessage("This verification link is missing its token.");
      return;
    }

    verifyEmailToken({ token }, setUser).then((verified) => {
      if (verified) {
        setState("verified");
        setMessage("Your email is verified. You are signed in.");
        return;
      }

      setState("error");
      setMessage("This verification link is invalid or expired.");
    });
  }, [params.token, setUser]);

  return (
    <View style={[layoutStyles.screen, { padding: 16, justifyContent: "center" }]}>
      <AppCard>
        <Text style={[typography.h2, { textAlign: "center", marginBottom: 12 }]}>
          {state === "verifying"
            ? "Verifying Email"
            : state === "verified"
              ? "Email Verified"
              : "Link Not Verified"}
        </Text>
        <Text
          style={[
            typography.bodyMuted,
            { textAlign: "center", marginBottom: 24, color: colors.stone[300] },
          ]}
        >
          {message}
        </Text>

        {state === "verified" ? (
          <AppButton
            title="Continue"
            onPress={() => router.replace("/(tabs)/scanQR")}
          />
        ) : state === "error" ? (
          <AppButton title="Go to Sign In" onPress={() => router.replace("/login")} />
        ) : null}
      </AppCard>
    </View>
  );
}
