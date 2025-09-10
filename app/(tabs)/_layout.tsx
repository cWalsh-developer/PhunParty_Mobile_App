import { Tabs } from "expo-router";

export default function TabsLayout() {
  console.log("TabsLayout rendered");
  return (
    <Tabs initialRouteName="index">
      <Tabs.Screen name="index" options={{ headerShown: false }} />
    </Tabs>
  );
}
