import { AppButton, AppCard, AppInput } from "@/assets/components";
import { colors, layoutStyles, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput as RNTextInput,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

  const activeIdx = isPressed ? Math.min(code.length, 5) : -1;

  const focusCodeInput = () => {
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }
  };

  return (
    <View style={layoutStyles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={layoutStyles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 48 }}>
            <MaterialIcons
              name="lock-reset"
              size={80}
              color={colors.tea[400]}
              style={{ marginBottom: 16 }}
            />
            <Text
              style={[typography.h1, { textAlign: "center", marginBottom: 8 }]}
            >
              Reset Password
            </Text>
            <Text style={[typography.bodyMuted, { textAlign: "center" }]}>
              {!isPressed
                ? "Enter your phone number to receive a reset code"
                : "Enter the verification code sent to your phone"}
            </Text>
          </View>

          {/* Form Card */}
          <AppCard style={{ marginBottom: 24 }}>
            {!isPressed ? (
              /* Phone Number Input */
              <AppInput
                label="Phone Number"
                value={phone}
                onChangeText={handlePhoneChange}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                style={{ marginBottom: 24 }}
                editable={!loading}
              />
            ) : (
              /* Verification Code Input */
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={[
                    typography.body,
                    {
                      textAlign: "center",
                      marginBottom: 24,
                      color: colors.stone[300],
                    },
                  ]}
                >
                  Code sent to number ending in {phone.slice(-3)}
                </Text>

                <View style={{ position: "relative" }}>
                  <Pressable
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                    onPress={focusCodeInput}
                  >
                    {[...Array(6)].map((_, i) => (
                      <View
                        key={i}
                        style={{
                          width: 40,
                          height: 50,
                          marginHorizontal: 4,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.ink[700],
                          borderWidth: 2,
                          borderColor:
                            i === activeIdx ? colors.tea[400] : colors.ink[800],
                          borderRadius: 8,
                        }}
                      >
                        <Text
                          style={[typography.h3, { color: colors.stone[100] }]}
                        >
                          {code[i] || ""}
                        </Text>
                        {i === activeIdx && !code[i] && (
                          <View
                            style={{
                              position: "absolute",
                              width: 2,
                              height: 20,
                              backgroundColor: colors.tea[400],
                              borderRadius: 1,
                            }}
                          />
                        )}
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
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: 248,
                      height: 50,
                      opacity: 0.01,
                      zIndex: 1,
                    }}
                    autoFocus
                    editable={!loading}
                  />
                </View>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <Text
                style={[
                  typography.small,
                  {
                    color: colors.red[500],
                    textAlign: "center",
                    marginBottom: 16,
                  },
                ]}
              >
                {error}
              </Text>
            )}

            {/* Action Button */}
            <Selector onPress={isPressed ? onVerify : onReset}>
              <AppButton
                title={
                  loading
                    ? isPressed
                      ? "Verifying..."
                      : "Sending..."
                    : isPressed
                    ? "Verify Reset Code"
                    : "Send Reset Code"
                }
                onPress={() => {}}
                variant="primary"
                disabled={
                  loading ||
                  (!isPressed && phone.length === 0) ||
                  (isPressed && code.length < 6)
                }
                style={{ marginBottom: 16 }}
                icon={
                  isPressed ? (
                    <MaterialIcons
                      name="verified"
                      size={20}
                      color={colors.ink[900]}
                    />
                  ) : (
                    <MaterialIcons
                      name="send"
                      size={20}
                      color={colors.ink[900]}
                    />
                  )
                }
              />
            </Selector>

            {/* Back to Login */}
            <Selector onPress={handleBackToLogin}>
              <TouchableOpacity>
                <Text
                  style={[
                    typography.small,
                    {
                      textAlign: "center",
                      color: colors.tea[400],
                      textDecorationLine: "underline",
                    },
                  ]}
                >
                  Back to Login
                </Text>
              </TouchableOpacity>
            </Selector>
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ResetPasswordForm;
