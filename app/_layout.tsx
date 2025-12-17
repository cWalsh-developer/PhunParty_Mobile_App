import { gameWebSocket } from "@/assets/api/gameWebSocketService";
import { UserProvider } from "@/assets/authentication-storage/authContext";
import { ToastProvider } from "@/assets/components/ToastContext";
import { ThemeProvider, colors } from "@/assets/theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundTime = useRef<number>(0);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Handle app backgrounding/foregrounding
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App has come to the foreground
        const backgroundDuration = Date.now() - backgroundTime.current;
        console.log(
          `[App] Returning to foreground after ${Math.round(
            backgroundDuration / 1000
          )}s`
        );

        const connectionState = gameWebSocket.getConnectionState();

        if (connectionState === "disconnected") {
          console.log("[App] Connection lost while backgrounded");
          // Don't auto-reconnect here - let the component handle it
        } else if (connectionState === "connected") {
          console.log("[App] Connection still alive - verifying with ping");

          // Send immediate ping to verify connection is still responsive
          try {
            gameWebSocket.sendMessage({
              type: "ping",
              data: { clientSentAt: Date.now() },
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            console.error("[App] Failed to send verification ping:", error);
          }
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App going to background
        backgroundTime.current = Date.now();
        console.log(
          "[App] Going to background - connection will be kept alive by automatic pings"
        );
        // Don't disconnect - server's automatic pings (every 15s) will keep connection alive
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ToastProvider>
          <UserProvider>
            <View style={{ flex: 1, backgroundColor: colors.ink[900] }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.ink[900] },
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="resetPassword"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="newPassword"
                  options={{ headerShown: false }}
                />
              </Stack>
            </View>
          </UserProvider>
        </ToastProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
