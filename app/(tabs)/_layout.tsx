import { colors } from "@/assets/theme";
import FontAwesom from "@expo/vector-icons/FontAwesome";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tea[400],
        tabBarActiveBackgroundColor: colors.ink[900],
        tabBarInactiveTintColor: colors.stone[400],
        tabBarStyle: {
          height: 105,
          backgroundColor: colors.stone[950],
          borderTopColor: colors.ink[800],
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 5,
          fontWeight: "600",
        },
        headerStyle: {
          backgroundColor: colors.stone[950],
        },
        headerTintColor: colors.stone[100],
      }}
    >
      <Tabs.Screen
        name="scanQR"
        options={{
          title: "Join Game",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <FontAwesom
              name="qrcode"
              size={29}
              color={focused ? color : "#201e23ff"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profileTab"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name="person"
              size={29}
              color={focused ? color : "#201e23ff"}
            />
          ),
        }}
      />
    </Tabs>
  );
}
