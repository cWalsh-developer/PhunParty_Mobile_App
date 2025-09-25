import { getToken } from "@/assets/authentication-storage/authStorage";
import { colors, layoutStyles, typography } from "@/assets/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export default function SplashScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    try {
      // Add a small delay for splash screen visibility
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const token = await getToken();

      if (token) {
        // User is authenticated, go to main app
        router.replace("/(tabs)/scanQR");
      } else {
        // User is not authenticated, go to login
        router.replace("/login");
      }
    } catch (error) {
      console.error("Auth check error:", error);
      // If there's an error, default to login
      router.replace("/login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[layoutStyles.screen, layoutStyles.centerContainer]}>
      <View style={{ alignItems: "center" }}>
        {/* App Logo/Title */}
        <Text
          style={[
            typography.h1,
            {
              textAlign: "center",
              marginBottom: 16,
              color: colors.stone[100],
            },
          ]}
        >
          Welcome to{"\n"}
          <Text style={{ color: colors.peach[400] }}>PhunParty</Text>
        </Text>

        <Text
          style={[
            typography.bodyMuted,
            { textAlign: "center", marginBottom: 48 },
          ]}
        >
          Kahoot meets Jackbox.{"\n"}
          Host trivia on desktop. Friends join on mobile.
        </Text>

        {/* Loading Indicator */}
        {isLoading && (
          <View style={{ alignItems: "center" }}>
            <ActivityIndicator
              size="large"
              color={colors.tea[500]}
              style={{ marginBottom: 16 }}
            />
            <Text
              style={[
                typography.small,
                { color: colors.stone[300], textAlign: "center" },
              ]}
            >
              Loading...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
