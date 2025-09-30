import { AppButton, AppCard, AppInput } from "@/assets/components";
import { colors, layoutStyles, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DismissKeyboardWrapper from "./DismissKeyboardWrapper";
import Selector from "./Selector";

interface LoginFormProps {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  mobile: string;
  setMobile: (v: string) => void;
  isSignUp: boolean;
  toggleForm: () => void;
  handleLogin: () => void;
  handleSignUp: (termsAccepted: boolean) => void;
  setTermsAccepted: (termsAccepted: boolean) => void;
  termsAccepted: boolean;
  handleReset: () => void;
}

export default function LoginForm({
  email,
  setEmail,
  password,
  setPassword,
  name,
  setName,
  mobile,
  setMobile,
  isSignUp,
  toggleForm,
  handleLogin,
  handleSignUp,
  setTermsAccepted,
  termsAccepted,
  handleReset,
}: LoginFormProps) {
  return (
    <DismissKeyboardWrapper style={layoutStyles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "position"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -185}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingVertical: 105,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", marginBottom: 48 }}>
            <Text
              style={[typography.h1, { textAlign: "center", marginBottom: 8 }]}
            >
              Welcome to{"\n"}
              <Text style={{ color: colors.peach[400] }}>PhunParty</Text>
            </Text>
            <Text style={[typography.bodyMuted, { textAlign: "center" }]}>
              {isSignUp
                ? "Create your account to start playing"
                : "Sign in to continue your journey"}
            </Text>
          </View>

          {/* Form Card */}
          <AppCard style={{ marginBottom: 0 }}>
            <Text
              style={[typography.h2, { marginBottom: 24, textAlign: "center" }]}
            >
              {isSignUp ? "Create Account" : "Welcome Back"}
            </Text>

            {/* Sign Up Fields */}
            {isSignUp && (
              <>
                <AppInput
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  style={{ marginBottom: 16 }}
                  horizontalScrollEnabled={true}
                  maxWidth={320}
                />
                <AppInput
                  label="Mobile"
                  value={mobile}
                  onChangeText={setMobile}
                  placeholder="Enter your mobile number"
                  keyboardType="phone-pad"
                  style={{ marginBottom: 16 }}
                  horizontalScrollEnabled={true}
                  maxWidth={320}
                />
              </>
            )}

            {/* Common Fields */}
            <AppInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              style={{ marginBottom: 16 }}
              horizontalScrollEnabled={true}
              maxWidth={320}
            />
            <AppInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              autoCapitalize="none"
              secureTextEntry
              style={{ marginBottom: 24 }}
              horizontalScrollEnabled={true}
              maxWidth={320}
            />

            {/* Accept TOS and PP check box button with links to https://terms-and-privacy.nexusgit.info/desktop-apps/terms */}
            {isSignUp && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 24,
                }}
              >
                <TouchableOpacity
                  style={{
                    width: 24,
                    height: 24,
                    borderWidth: 2,
                    borderColor: colors.tea[400],
                    borderRadius: 6,
                    marginRight: 12,
                    backgroundColor: colors.ink[900],
                  }}
                  onPress={() => {
                    // Toggle termsAccepted state
                    setTermsAccepted(termsAccepted === true ? false : true);
                  }}
                >
                  {termsAccepted && (
                    <MaterialIcons
                      name="check"
                      size={20}
                      color={colors.tea[400]}
                      style={{ marginTop: 1, marginLeft: 1 }}
                    />
                  )}
                </TouchableOpacity>
                <Text style={[typography.small, { flex: 1 }]}>
                  I agree to the{" "}
                  <Text
                    onPress={() => {
                      // Open links in browser
                      import("expo-linking").then((Linking) => {
                        Linking.openURL(
                          "https://terms-and-privacy.nexusgit.info/desktop-apps/terms"
                        );
                      });
                    }}
                    style={{
                      color: colors.tea[400],
                      textDecorationLine: "underline",
                    }}
                  >
                    Terms of Service
                  </Text>{" "}
                  and{" "}
                  <Text
                    onPress={() => {
                      // Open links in browser
                      import("expo-linking").then((Linking) => {
                        Linking.openURL(
                          "https://terms-and-privacy.nexusgit.info/desktop-apps/privacy"
                        );
                      });
                    }}
                    style={{
                      color: colors.tea[400],
                      textDecorationLine: "underline",
                    }}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <Selector
              onPress={
                isSignUp ? () => handleSignUp(termsAccepted) : handleLogin
              }
            >
              <AppButton
                title={isSignUp ? "Create Account" : "Sign In"}
                onPress={() => {}} // This will be overridden by Selector
                variant="primary"
                style={{ marginBottom: 16 }}
                icon={
                  isSignUp ? (
                    <MaterialIcons
                      name="person-add"
                      size={20}
                      color={colors.ink[900]}
                    />
                  ) : (
                    <MaterialIcons
                      name="login"
                      size={20}
                      color={colors.ink[900]}
                    />
                  )
                }
              />
            </Selector>

            {/* Reset Password (Login only) */}
            {!isSignUp && (
              <Selector onPress={handleReset}>
                <TouchableOpacity style={{ marginBottom: 16 }}>
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
                    Forgot your password?
                  </Text>
                </TouchableOpacity>
              </Selector>
            )}

            {/* Toggle Form */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <Text style={[typography.small, { marginRight: 8 }]}>
                {isSignUp
                  ? "Already have an account?"
                  : "Don't have an account?"}
              </Text>
              <Selector onPress={toggleForm}>
                <TouchableOpacity>
                  <Text
                    style={[
                      typography.small,
                      {
                        color: colors.tea[400],
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {isSignUp ? "Sign In" : "Sign Up"}
                  </Text>
                </TouchableOpacity>
              </Selector>
            </View>
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </DismissKeyboardWrapper>
  );
}
