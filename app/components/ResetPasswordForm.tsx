// ...existing code...
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  Pressable,
  TextInput as RNTextInput,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "react-native-paper";
import AppButton from "./AppButton";
import Selector from "./Selector";

interface ResetPasswordFormProps {
  phone: string;
  setPhone: (phone: string) => void;
  code: string;
  setCode: (code: string) => void;
  isPressed: boolean;
  onReset: () => void;
  onVerify: () => void;
  loading?: boolean;
  error?: string;
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  phone,
  setPhone,
  code,
  setCode,
  isPressed,
  onReset,
  onVerify,
  loading = false,
  error,
}) => {
  const codeInputRef = useRef<any>(null);
  const handleBackToLogin = () => {
    router.replace("/login");
  };
  const handlePhoneChange = (text: string) => setPhone(text);
  const handleCodeChange = (text: string) =>
    setCode(text.replace(/[^0-9]/g, "").slice(0, 6));
  // Find the index of the next empty code box (for cursor highlight)
  const activeIdx = isPressed ? Math.min(code.length, 5) : -1;
  const focusCodeInput = () => {
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }
  };

  return (
    <View style={styles.content}>
      <Text style={styles.title} variant="headlineMedium">
        Reset Password
      </Text>
      {!isPressed ? (
        <TextInput
          label="Phone Number"
          value={phone}
          onChangeText={handlePhoneChange}
          placeholder="Enter your phone number"
          autoCapitalize="none"
          keyboardType="phone-pad"
          mode="outlined"
          outlineColor="#201e23ff"
          activeOutlineColor="#201e23ff"
          style={styles.input}
          editable={!loading}
        />
      ) : (
        <View>
          <Text style={styles.resetHeading} variant="bodyMedium">
            Please enter the reset code that has been sent to your phone number
            ending in {phone.slice(-3)}.
          </Text>
          <View style={{ position: "relative" }}>
            <Pressable
              style={styles.codeRow}
              onPress={focusCodeInput}
              accessible
              accessibilityLabel="Enter reset code"
            >
              {[...Array(6)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.codeBox,
                    i === activeIdx
                      ? styles.codeBoxActive
                      : styles.codeBoxInactive,
                  ]}
                >
                  <Text style={styles.codeDigit}>{code[i] || ""}</Text>
                  {i === activeIdx && !code[i] ? (
                    <View style={styles.cursorLine} />
                  ) : null}
                </View>
              ))}
            </Pressable>
            <RNTextInput
              ref={codeInputRef}
              value={code}
              onChangeText={handleCodeChange}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={6}
              style={styles.hiddenInput}
              autoFocus
              editable={!loading}
              importantForAccessibility="yes"
              accessibilityLabel="Reset code input"
              selectionColor="#201e23ff"
              underlineColorAndroid="transparent"
              returnKeyType="done"
            />
          </View>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Selector onPress={isPressed ? onVerify : onReset}>
        <AppButton
          onPress={() => {}}
          disabled={
            loading ||
            (!isPressed && phone.length === 0) ||
            (isPressed && code.length === 0)
          }
        >
          <Text style={{ color: "#fff" }}>
            {loading
              ? isPressed
                ? "Verifying..."
                : "Sending..."
              : isPressed
              ? "Verify Reset Code"
              : "Send Reset Code"}
          </Text>
        </AppButton>
      </Selector>
      <Selector onPress={handleBackToLogin}>
        <AppButton onPress={() => {}} mode="text" style={{ marginTop: 16 }}>
          <Text style={{ color: "#201e23ff", fontSize: 16, fontWeight: "500" }}>
            Back To Login
          </Text>
        </AppButton>
      </Selector>
    </View>
  );
};
const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: "center", padding: 16 },
  title: { textAlign: "center", marginBottom: 16 },
  input: { marginBottom: 16 },
  button: { marginTop: 8, backgroundColor: "#201e23ff" },
  resetHeading: { textAlign: "center", marginBottom: 16 },
  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
    alignItems: "center",
    position: "relative",
  },
  codeBox: {
    width: 40,
    height: 50,
    marginHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 2,
    borderColor: "#bbb",
    position: "relative",
  },
  codeBoxActive: {
    borderColor: "#201e23ff",
    borderBottomWidth: 3,
  },
  codeBoxInactive: {
    borderColor: "#bbb",
    borderBottomWidth: 2,
  },
  cursorLine: {
    position: "absolute",
    bottom: 8,
    left: "50%",
    width: 16,
    height: 2,
    backgroundColor: "#201e23ff",
    marginLeft: -8,
    borderRadius: 1,
  },
  codeDigit: {
    fontSize: 24,
    color: "#201e23ff",
  },
  hiddenInput: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 248,
    height: 50,
    opacity: 0.01,
    zIndex: 1,
    color: "#201e23ff",
    borderWidth: 0,
    padding: 0,
  },
  error: {
    color: "#d32f2f",
    marginBottom: 8,
    fontSize: 14,
    alignSelf: "center",
  },
});

export default ResetPasswordForm;
