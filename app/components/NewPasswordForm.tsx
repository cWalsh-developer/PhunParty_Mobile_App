import React from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import AppButton from "./AppButton";

interface NewPasswordFormProps {
  password: string;
  confirmPassword: string;
  onPasswordChange: (text: string) => void;
  onConfirmPasswordChange: (text: string) => void;
  onSubmit: () => void;
}

export default function NewPasswordForm({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: NewPasswordFormProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title} variant="headlineMedium">
          Set New Password
        </Text>
        <TextInput
          label="New Password"
          value={password}
          onChangeText={onPasswordChange}
          outlineColor="#201e23ff"
          activeOutlineColor="#201e23ff"
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />
        <TextInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={onConfirmPasswordChange}
          outlineColor="#201e23ff"
          activeOutlineColor="#201e23ff"
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />
        <AppButton mode="contained" onPress={onSubmit} style={styles.button}>
          Set New Password
        </AppButton>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: { flex: 1, justifyContent: "center", padding: 16 },
  title: { textAlign: "center", marginBottom: 16 },
  input: { marginBottom: 16 },
  button: { marginTop: 8, backgroundColor: "#201e23ff" },
});
