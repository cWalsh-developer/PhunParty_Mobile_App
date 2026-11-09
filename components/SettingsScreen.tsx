import { AppButton, AppCard } from "@/assets/components";
import { partyColors, partyFonts } from "@/assets/theme/party";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SocialHeader, SocialScreen } from "./party/social-layout";

interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onChangePassword: () => void;
  onPrivacySettings: () => void;
  onNotificationSettings: () => void;
}

export default function SettingsScreen({
  onBack, onLogout, onDeleteAccount, onChangePassword,
  onPrivacySettings, onNotificationSettings,
}: SettingsScreenProps) {
  return (
    <SocialScreen>
      <SocialHeader title="Your settings" subtitle="Make Phun Party feel like you." onBack={onBack} />
      <AppCard style={styles.accountCard}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Your account</Text>
        <SettingsRow title="Change password" description="Keep your account secure." icon="lock-outline" onPress={onChangePassword} />
        <SettingsRow title="Privacy" description="Choose what other players can see." icon="privacy-tip" onPress={onPrivacySettings} />
        <SettingsRow title="Notifications" description="Decide what you hear about." icon="notifications-none" onPress={onNotificationSettings} />
      </AppCard>
      <SettingsRow title="Log out" icon="logout" onPress={onLogout} />
      <View style={styles.deleteSection}>
        <Text accessibilityRole="header" style={styles.deleteTitle}>Delete account</Text>
        <Text style={styles.deleteCopy}>Your account is deactivated now and permanently deleted after 30 days. Sign back in during that time to restore it.</Text>
        <AppButton title="Delete account" onPress={onDeleteAccount} variant="delete" icon={<MaterialIcons name="delete-outline" size={22} color={partyColors.danger} />} />
      </View>
    </SocialScreen>
  );
}

function SettingsRow({ title, description, icon, onPress }: {
  title: string;
  description?: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.row} activeOpacity={0.8}>
      <View style={styles.icon}><MaterialIcons name={icon} size={23} color={partyColors.ink} /></View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {description && <Text style={styles.rowDescription}>{description}</Text>}
      </View>
      <MaterialIcons name="chevron-right" size={24} color={partyColors.ink} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  accountCard: { gap: 12, marginBottom: 16, padding: 16 },
  sectionTitle: { fontFamily: partyFonts.display, color: partyColors.ink, fontSize: 20, lineHeight: 27, marginBottom: 4 },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1.5, borderColor: partyColors.border, borderRadius: 12, backgroundColor: partyColors.white },
  icon: { width: 40, height: 40, flexShrink: 0, justifyContent: "center", alignItems: "center", borderRadius: 13, backgroundColor: partyColors.lavender },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { color: partyColors.ink, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  rowDescription: { color: partyColors.muted, fontSize: 13, lineHeight: 19 },
  deleteSection: { marginTop: 28, gap: 12, padding: 18, borderWidth: 1.5, borderColor: partyColors.danger, borderRadius: 18, backgroundColor: partyColors.dangerSoft },
  deleteTitle: { fontFamily: partyFonts.display, color: partyColors.danger, fontSize: 20, lineHeight: 27 },
  deleteCopy: { color: partyColors.ink, fontSize: 14, lineHeight: 21 },
});
