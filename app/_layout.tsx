import { UserProvider } from "@/assets/authentication-storage/authContext";
import { getToken } from "@/assets/authentication-storage/authStorage";
import { ThemeProvider, colors } from "@/assets/theme";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkToken = async () => {
      const token = await getToken();
      setIsAuthenticated(!!token);
    };
    checkToken();
  }, []);

  if (isAuthenticated === null) {
    console.log("Rendering TabsLayout");
    return (
      <ThemeProvider>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.ink[900],
          }}
        >
          <ActivityIndicator size="large" color={colors.tea[500]} />
        </View>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <UserProvider>
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="resetPassword" options={{ headerShown: false }} />
          <Stack.Screen name="newPassword" options={{ headerShown: false }} />
        </Stack>
      </UserProvider>
    </ThemeProvider>
  );
}
