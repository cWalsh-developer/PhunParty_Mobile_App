import { partyColors, partyFonts } from "@/assets/theme/party";
import { AppButton, AppCard, AppInput } from "@/assets/components";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: {
    player_name: string | null;
    player_email: string | null;
    player_mobile: string | null;
  };
  onSave: (data: {
    player_name: string;
    player_email: string;
    player_mobile: string;
  }) => void;
  loading?: boolean;
}

const EditProfileForm: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  user,
  onSave,
  loading = false,
}) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(user.player_name || "");
  const [email, setEmail] = useState(user.player_email || "");
  const [phone, setPhone] = useState(user.player_mobile || "");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.backgroundOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close edit profile" />
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <AppCard style={styles.card}>
              <View style={styles.header}>
                <Text accessibilityRole="header" style={styles.title}>Edit profile</Text>
                <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close edit profile" style={styles.closeButton}>
                  <MaterialIcons name="close" size={23} color={partyColors.ink} />
                </TouchableOpacity>
              </View>
              <Text style={styles.description}>Keep your player details up to date.</Text>
              <AppInput label="Name" value={name} onChangeText={setName} placeholder="Enter your name" autoCapitalize="words" style={styles.input} />
              <AppInput label="Email" value={email} onChangeText={setEmail} placeholder="Enter your email" keyboardType="email-address" autoCapitalize="none" style={styles.input} />
              <AppInput label="Phone" value={phone} onChangeText={setPhone} placeholder="Enter your phone number" keyboardType="phone-pad" style={styles.input} />
              <AppButton title={loading ? "Saving..." : "Save changes"} onPress={() => onSave({ player_name: name, player_email: email, player_mobile: phone })} disabled={loading} icon={<MaterialIcons name="check" size={22} color={partyColors.ink} />} />
            </AppCard>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: { flex: 1 },
  backgroundOverlay: { flex: 1, backgroundColor: "rgba(38, 33, 48, 0.65)" },
  scrollContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  card: { width: "100%", maxWidth: 500, padding: 22, borderRadius: 22 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  title: { flex: 1, fontFamily: partyFonts.display, fontSize: 26, lineHeight: 34, color: partyColors.ink },
  closeButton: { width: 48, height: 48, backgroundColor: partyColors.lavender, borderWidth: 2, borderColor: partyColors.border, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  description: { color: partyColors.muted, fontSize: 15, lineHeight: 23, marginBottom: 24 },
  input: { marginBottom: 20 },
});

export default function EditProfileModal(props: EditProfileModalProps) {
  if (!props.visible) return null;
  const initialDetails = JSON.stringify([props.user.player_name, props.user.player_email, props.user.player_mobile]);
  return <EditProfileForm key={initialDetails} {...props} />;
}
