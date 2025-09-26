import { AppButton, AppCard, AppInput } from "@/assets/components";
import { colors, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DismissKeyboardWrapper from "./DismissKeyboardWrapper";
import Selector from "./Selector";

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

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  user,
  onSave,
  loading = false,
}) => {
  const [name, setName] = useState(user.player_name || "");
  const [email, setEmail] = useState(user.player_email || "");
  const [phone, setPhone] = useState(user.player_mobile || "");

  React.useEffect(() => {
    if (visible) {
      setName(user.player_name || "");
      setEmail(user.player_email || "");
      setPhone(user.player_mobile || "");
    }
  }, [visible, user]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        {/* Tap away to close overlay - covers entire screen */}
        <TouchableOpacity
          style={styles.tapAwayOverlay}
          activeOpacity={1}
          onPress={onClose}
        />
        
        {/* Close button overlay */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <MaterialIcons name="close" size={24} color={colors.stone[100]} />
        </TouchableOpacity>

        {/* Centered modal content with keyboard dismissal */}
        <View style={styles.modalContent}>
          <DismissKeyboardWrapper>
          <AppCard style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <MaterialIcons name="edit" size={24} color={colors.tea[400]} />
              <Text style={[typography.h2, styles.title]}>Edit Profile</Text>
            </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            <AppInput
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              autoCapitalize="words"
              style={styles.input}
              inputStyle={styles.inputField}
            />

            <AppInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              inputStyle={styles.inputField}
            />

            <AppInput
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
              style={styles.input}
              inputStyle={styles.inputField}
            />
          </View>

          {/* Save Button */}
          <View style={styles.buttonContainer}>
            <Selector
              onPress={() =>
                onSave({
                  player_name: name,
                  player_email: email,
                  player_mobile: phone,
                })
              }
            >
              <AppButton
                title={loading ? "Saving..." : "Save Changes"}
                onPress={() => {}}
                variant="primary"
                disabled={loading}
                style={styles.centeredSaveButton}
                icon={
                  <MaterialIcons
                    name="save"
                    size={20}
                    color={colors.ink[900]}
                  />
                }
              />
            </Selector>
          </View>
          </AppCard>
          </DismissKeyboardWrapper>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)", // Less transparent
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  tapAwayOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    backgroundColor: "transparent",
  },
  modalContent: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    zIndex: 2,
    pointerEvents: "box-none", // Allow touch events to pass through to overlay
  },
  closeButton: {
    position: "absolute",
    top: 60,
    right: 30,
    zIndex: 10,
    backgroundColor: colors.ink[800] + "CC",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.tea[400],
  },
  card: {
    width: "100%",
    maxWidth: 450, // Increased from 400 to make card wider
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    gap: 12,
  },
  title: {
    color: colors.stone[100],
    textAlign: "center",
  },
  formContainer: {
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  inputField: {
    backgroundColor: colors.ink[800], // Slightly lighter than ink[900]
    borderColor: colors.tea[400], // Subtle tea green border
    borderWidth: 1,
    color: colors.stone[100], // Brighter text
  },
  buttonContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  centeredSaveButton: {
    minWidth: 200,
  },
  buttonIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});

export default EditProfileModal;
