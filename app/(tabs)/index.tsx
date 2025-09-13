import { useAuth } from "@/assets/authentication-storage/authContext";
import { Text, View } from "react-native";

export default function Index() {
  const { user } = useAuth();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Hello, {user?.email}!</Text>
    </View>
  );
}
