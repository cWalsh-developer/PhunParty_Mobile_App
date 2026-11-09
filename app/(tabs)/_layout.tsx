import { partyColors } from "@/assets/theme/party";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Ionicons from "@expo/vector-icons/Ionicons";
import { createMaterialTopTabNavigator } from "expo-router/js-top-tabs";
import { withLayoutContext } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <MaterialTopTabs
      screenOptions={{
        tabBarActiveTintColor: partyColors.purple,
        tabBarInactiveTintColor: partyColors.muted,
        tabBarStyle: {
          backgroundColor: partyColors.cream,
          borderTopColor: partyColors.border,
          borderTopWidth: 2,
          paddingBottom: insets.bottom,
          minHeight: 68 + insets.bottom,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "800", textTransform: "none" },
        tabBarIndicatorStyle: { backgroundColor: partyColors.purple, height: 4 },
        tabBarPressColor: partyColors.lavender,
        swipeEnabled: true,
      }}
      tabBarPosition="bottom"
    >
      <MaterialTopTabs.Screen
        name="scanQR"
        options={{
          title: "Join Game",
          tabBarIcon: ({ color }: { color: string }) => (
            <FontAwesome name="qrcode" size={24} color={color} />
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={24} color={color} />
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="profileTab"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
          ),
        }}
      />
    </MaterialTopTabs>
  );
}