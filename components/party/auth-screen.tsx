import { partyColors, partyFonts } from "@/assets/theme/party";
import { PartyBrand, PartyMascot } from "@/components/party/party-brand";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AuthScreenProps {
  title: string;
  description: string;
  children: ReactNode;
  tone?: "lime" | "pink" | "lavender";
  onBack?: () => void;
  backLabel?: string;
  busy?: boolean;
}

export function AuthScreen({
  title,
  description,
  children,
  tone = "pink",
  onBack,
  backLabel = "Back to sign in",
  busy = false,
}: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.hero, { backgroundColor: partyColors[tone], paddingTop: insets.top + 20 }]}>
          <View style={styles.contentWidth}>
            <View style={styles.brandRow}>
              <PartyBrand compact />
              <PartyMascot size={46} />
            </View>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={backLabel}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={onBack}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
              >
                <Ionicons name="arrow-back" color={partyColors.ink} size={20} />
                <Text style={styles.backLabel}>{backLabel}</Text>
              </Pressable>
            ) : null}
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
        </View>
        <View style={[styles.formArea, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}>
          <View style={styles.contentWidth}>{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthNotice({
  message,
  kind = "error",
}: {
  message?: string | null;
  kind?: "error" | "info" | "success";
}) {
  if (!message) return null;
  const isError = kind === "error";
  return (
    <View style={[styles.notice, { backgroundColor: isError ? partyColors.dangerSoft : kind === "success" ? partyColors.success : partyColors.lavender }]}>
      <Ionicons
        name={isError ? "alert-circle-outline" : kind === "success" ? "checkmark-circle-outline" : "information-circle-outline"}
        size={21}
        color={isError ? partyColors.danger : partyColors.ink}
      />
      <Text
        selectable
        accessibilityRole={isError ? "alert" : undefined}
        accessibilityLiveRegion="polite"
        style={[styles.noticeText, { color: isError ? partyColors.danger : partyColors.ink }]}
      >
        {message}
      </Text>
    </View>
  );
}

export const authStyles = StyleSheet.create({
  sectionTitle: { fontFamily: partyFonts.display, color: partyColors.ink, fontSize: 23, lineHeight: 30, marginBottom: 20 },
  body: { color: partyColors.muted, fontSize: 15, lineHeight: 23 },
  field: { marginBottom: 17 },
  helper: { color: partyColors.muted, fontSize: 13, lineHeight: 19, marginTop: -8, marginBottom: 20 },
  primary: { marginTop: 6 },
  switchArea: { borderTopWidth: 1, borderTopColor: partyColors.lavender, paddingTop: 22, marginTop: 24, gap: 10 },
  switchPrompt: { textAlign: "center", color: partyColors.muted, fontSize: 14, lineHeight: 20 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: partyColors.cream },
  scrollContent: { flexGrow: 1 },
  contentWidth: { width: "100%", maxWidth: 480, alignSelf: "center" },
  hero: { paddingHorizontal: 24, paddingBottom: 28, borderBottomWidth: 2, borderBottomColor: partyColors.border },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 25 },
  title: { fontFamily: partyFonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.7, color: partyColors.ink },
  description: { fontSize: 16, lineHeight: 23, color: partyColors.ink, marginTop: 13 },
  formArea: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  backButton: { minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, marginTop: -12, marginBottom: 14 },
  backLabel: { flexShrink: 1, color: partyColors.ink, fontWeight: "700", fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.65 },
  notice: { borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 9, marginBottom: 18 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 21 },
});
