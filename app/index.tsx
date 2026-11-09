import { getToken } from "@/assets/authentication-storage/authStorage";
import { partyColors } from "@/assets/theme/party";
import { PartyBrand, PartyMascot } from "@/components/party/party-brand";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let active = true;
    const redirect = async () => {
      try {
        const token = await getToken();
        if (active) router.replace(token ? "/(tabs)/scanQR" : "/login");
      } catch {
        if (active) router.replace("/login");
      }
    };
    void redirect();
    return () => { active = false; };
  }, [router]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
    >
      <View style={styles.brand}>
        <PartyMascot size={112} />
        <PartyBrand />
      </View>
      <Text style={styles.tagline}>Big brains. Loud friends.</Text>
      <Text style={styles.description}>Host on desktop. Play on your phone.</Text>
      <View style={styles.loadingCard}>
        <ActivityIndicator color={partyColors.purple} accessibilityLabel="Loading your account" />
        <Text accessibilityLiveRegion="polite" style={styles.loadingText}>Getting your party ready…</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: partyColors.lime },
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  brand: { alignItems: "center", gap: 24, marginBottom: 28 },
  tagline: { color: partyColors.ink, textAlign: "center", fontSize: 20, lineHeight: 28, fontWeight: "800" },
  description: { color: partyColors.ink, textAlign: "center", fontSize: 15, lineHeight: 22, marginTop: 8 },
  loadingCard: { width: "100%", maxWidth: 360, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: partyColors.cream, borderWidth: 2, borderColor: partyColors.border, borderRadius: 14, padding: 18, marginTop: 40 },
  loadingText: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: "700", color: partyColors.ink },
});
