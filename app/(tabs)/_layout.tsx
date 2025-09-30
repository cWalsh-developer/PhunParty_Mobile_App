import { colors } from "@/assets/theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Ionicons from "@expo/vector-icons/Ionicons";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { withLayoutContext } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <MaterialTopTabs
      screenOptions={{
        tabBarActiveTintColor: colors.tea[400],
        tabBarInactiveTintColor: colors.stone[400],
        tabBarStyle: {
          backgroundColor: colors.stone[950],
          borderBottomColor: colors.ink[800],
          borderBottomWidth: 1,
          paddingBottom: insets.bottom,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          textTransform: "none",
        },
        tabBarIndicatorStyle: {
          backgroundColor: colors.tea[400],
          height: 3,
        },
        swipeEnabled: true,
        tabBarPressColor: colors.ink[800],
      }}
      tabBarPosition="bottom"
    >
      <MaterialTopTabs.Screen
        name="scanQR"
        options={{
          title: "Join Game",
          tabBarIcon: ({
            color,
            focused,
          }: {
            color: string;
            focused: boolean;
          }) => (
            <FontAwesome
              name="qrcode"
              size={24}
              color={focused ? color : colors.stone[400]}
            />
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="profileTab"
        options={{
          title: "Profile",
          tabBarIcon: ({
            color,
            focused,
          }: {
            color: string;
            focused: boolean;
          }) => (
            <Ionicons
              name="person"
              size={24}
              color={focused ? color : colors.stone[400]}
            />
          ),
        }}
      />
    </MaterialTopTabs>
  );
}
