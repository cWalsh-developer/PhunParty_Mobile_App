import { UserProvider } from "@/assets/authentication-storage/authContext";
import { ToastProvider } from "@/assets/components/ToastContext";
import { ThemeProvider, colors } from "@/assets/theme";
import { Stack } from "expo-router";
import { View } from "react-native";

export default function RootLayout() {
  return (
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
  );
}
