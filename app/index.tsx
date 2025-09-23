import { AppCard } from "@/assets/components";
import { colors, layoutStyles, typography } from "@/assets/theme";
import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={layoutStyles.screen}>
      <View style={layoutStyles.centerContainer}>
        <AppCard style={{ alignItems: "center", marginBottom: 32 }}>
          <Text
            style={[typography.h1, { textAlign: "center", marginBottom: 16 }]}
          >
            Welcome to{"\n"}
            <Text style={{ color: colors.peach[400] }}>PhunParty</Text>
          </Text>
          <Text style={[typography.bodyMuted, { textAlign: "center" }]}>
            Kahoot meets Jackbox.{"\n"}
            Host trivia on desktop. Friends join on mobile.
          </Text>
        </AppCard>
      </View>
    </View>
  );
}
