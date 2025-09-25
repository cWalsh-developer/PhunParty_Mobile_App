import { UserContext } from "@/assets/authentication-storage/authContext";
import { changePassword } from "@/assets/authentication-storage/authenticationLogic";
import { AppButton, AppCard, AppInput } from "@/assets/components";
import { colors, layoutStyles, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useContext, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Selector from "./Selector";

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({
  visible,
  onClose,
}: ChangePasswordModalProps) {
  const { user, setUser } = useContext(UserContext)!;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const validatePasswords = () => {
    if (!currentPassword.trim()) {
      Alert.alert("Error", "Please enter your current password");
      return false;
    }
    if (!newPassword.trim()) {
      Alert.alert("Error", "Please enter a new password");
      return false;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return false;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return false;
    }
    if (currentPassword === newPassword) {
      Alert.alert(
        "Error",
        "New password must be different from current password"
      );
      return false;
    }
    return true;
  };

  const handleChangePassword = async () => {
    if (!validatePasswords()) return;

    // Check if user has phone number
    const phoneNumber = user.player_mobile;
    if (!phoneNumber) {
      Alert.alert(
        "Error",
        "Phone number is required for password change. Please update your profile."
      );
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword(
        currentPassword,
        newPassword,
        phoneNumber,
        setUser
      );

      if (result.success) {
        Alert.alert("Success", result.message, [
          { text: "OK", onPress: handleClose },
        ]);
      } else {
        Alert.alert("Error", result.message);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to change password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[layoutStyles.screen, layoutStyles.container]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerRow}>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={styles.closeButton}
                  >
                    <MaterialIcons
                      name="close"
                      size={24}
                      color={colors.stone[300]}
                    />
                  </TouchableOpacity>
                  <Text style={[typography.h2, styles.title]}>
                    Change Password
                  </Text>
                  <View style={{ width: 24 }} />
                </View>

                <MaterialIcons
                  name="lock"
                  size={48}
                  color={colors.tea[400]}
                  style={{ marginTop: 20 }}
                />

                <Text style={[typography.body, styles.subtitle]}>
                  Enter your current password and choose a new one
                </Text>
              </View>

              {/* Form */}
              <AppCard style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={[typography.small, styles.label]}>
                    Current Password
                  </Text>
                  <AppInput
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[typography.small, styles.label]}>
                    New Password
                  </Text>
                  <AppInput
                    placeholder="Enter new password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[typography.small, styles.label]}>
                    Confirm New Password
                  </Text>
                  <AppInput
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>

                {/* Password Requirements */}
                <View style={styles.requirements}>
                  <Text style={[typography.small, styles.requirementsTitle]}>
                    Password Requirements:
                  </Text>
                  <Text style={[typography.small, styles.requirement]}>
                    {"\u2022"} At least 6 characters long
                  </Text>
                  <Text style={[typography.small, styles.requirement]}>
                    {"\u2022"} Different from current password
                  </Text>
                </View>
              </AppCard>

              {/* Actions */}
              <View style={styles.actions}>
                <Selector onPress={handleClose} label="Cancel">
                  <AppButton
                    title="Cancel"
                    variant="secondary"
                    onPress={() => {}}
                    style={styles.button}
                  />
                </Selector>

                <View style={{ marginTop: 12 }}>
                  <Selector
                    onPress={handleChangePassword}
                    label="Change Password"
                  >
                    <AppButton
                      title={loading ? "Changing..." : "Change Password"}
                      variant="primary"
                      onPress={() => {}}
                      disabled={loading}
                      style={styles.button}
                    />
                  </Selector>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingVertical: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.ink[800],
  },
  title: {
    color: colors.stone[100],
    textAlign: "center",
  },
  subtitle: {
    color: colors.stone[300],
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: colors.stone[300],
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.ink[700],
  },
  requirements: {
    marginTop: 8,
    padding: 16,
    backgroundColor: colors.ink[800],
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.tea[400],
  },
  requirementsTitle: {
    color: colors.tea[400],
    fontWeight: "600",
    marginBottom: 8,
  },
  requirement: {
    color: colors.stone[400],
    marginBottom: 4,
    lineHeight: 16,
  },
  actions: {
    marginTop: "auto",
    paddingTop: 20,
  },
  button: {
    width: "100%",
  },
});
