import FontAwesom from "@expo/vector-icons/FontAwesome";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#ffffffff",
        tabBarActiveBackgroundColor: "#9a9a9aff",
        tabBarInactiveTintColor: "#201e23ff",
        tabBarStyle: { height: 105 },
        tabBarLabelStyle: { fontSize: 12, marginBottom: 5 },
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
        name="index"
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
