import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { Card, Text, TextInput } from "react-native-paper";
import AppButton from "./AppButton";

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
        <Card style={styles.card}>
          <Text variant="headlineSmall" style={styles.title}>
            Edit Profile
          </Text>
          <TextInput
            label="Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            mode="outlined"
            outlineColor="#393939ff"
            activeOutlineColor="#201e23ff"
          />
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            outlineColor="#393939ff"
            activeOutlineColor="#201e23ff"
          />
          <TextInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
            mode="outlined"
            keyboardType="phone-pad"
            outlineColor="#393939ff"
            activeOutlineColor="#201e23ff"
          />
          <View style={styles.buttonRow}>
            <AppButton onPress={onClose} mode="text" disabled={loading}>
              <View style={styles.buttonIconRow}>
                <MaterialIcons name="cancel" size={20} color="#201e23ff" />
                <Text style={{ color: "#201e23ff", fontSize: 17 }}>Cancel</Text>
              </View>
            </AppButton>
            <AppButton
              onPress={() =>
                onSave({
                  player_name: name,
                  player_email: email,
                  player_mobile: phone,
                })
              }
              mode="contained"
              disabled={loading}
            >
              <View style={styles.buttonIconRow}>
                <MaterialIcons name="save" size={20} color="#ffffff" />
                <Text style={{ color: "#ffffff" }}>Save</Text>
              </View>
            </AppButton>
          </View>
        </Card>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "90%",
    padding: 20,
    borderRadius: 16,
  },
  title: {
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    gap: 10,
  },
  button: {
    flex: 1,
    marginLeft: 8,
  },
  buttonIconRow: { flexDirection: "row", alignItems: "center", gap: 4 },
});

export default EditProfileModal;
