import { partyColors, partyFonts } from "@/assets/theme/party";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ReactNode } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function SocialScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  );
}

export function SocialHeader({ title, subtitle, onBack, action }: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headingRow}>
        {onBack && (
          <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={23} color={partyColors.ink} />
          </TouchableOpacity>
        )}
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {action}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

export function SocialToggle({ title, subtitle, value, onValueChange, icon, disabled = false, testable = false, onTest }: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon: keyof typeof MaterialIcons.glyphMap;
  disabled?: boolean;
  testable?: boolean;
  onTest?: () => void;
}) {
  return (
    <View style={[styles.toggleCard, disabled && styles.disabled]}>
      <View style={styles.toggleRow}>
        <MaterialIcons name={icon} size={23} color={partyColors.purple} />
        <View style={styles.toggleBody}>
          <Text style={styles.toggleTitle}>{title}</Text>
          {subtitle && <Text style={styles.toggleDescription}>{subtitle}</Text>}
        </View>
        <Switch accessibilityLabel={title} accessibilityHint={subtitle} value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: "#AFA7B7", true: partyColors.purple }} thumbColor={partyColors.white} />
      </View>
      {testable && value && onTest && (
        <TouchableOpacity onPress={onTest} accessibilityRole="button" accessibilityLabel={`Test ${title.toLowerCase()}`} style={styles.testButton}>
          <Text style={styles.testLabel}>Test notification</Text>
          <MaterialIcons name="notifications-active" size={18} color={partyColors.ink} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: partyColors.cream },
  content: { width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: 20, paddingBottom: 32 },
  header: { marginBottom: 24, gap: 10 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, minWidth: 0, fontFamily: partyFonts.display, color: partyColors.ink, fontSize: 30, lineHeight: 37, letterSpacing: -0.6 },
  subtitle: { color: partyColors.muted, fontSize: 16, lineHeight: 24 },
  backButton: { width: 48, height: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: partyColors.white, borderWidth: 2, borderColor: partyColors.border, borderRadius: 16 },
  toggleCard: { backgroundColor: partyColors.cream, padding: 14, borderWidth: 1, borderColor: partyColors.border, borderRadius: 12, marginBottom: 12, gap: 12 },
  disabled: { opacity: 0.65 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggleBody: { flex: 1, minWidth: 0, gap: 4 },
  toggleTitle: { color: partyColors.ink, fontSize: 15, lineHeight: 22, fontWeight: "700" },
  toggleDescription: { color: partyColors.muted, fontSize: 13, lineHeight: 20 },
  testButton: { minHeight: 44, alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: partyColors.lime, borderWidth: 1.5, borderColor: partyColors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  testLabel: { color: partyColors.ink, fontSize: 13, lineHeight: 19, fontWeight: "700" },
});
