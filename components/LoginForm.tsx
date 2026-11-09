import { AppInput } from "@/assets/components";
import { partyColors } from "@/assets/theme/party";
import { AuthNotice, AuthScreen, authStyles } from "@/components/party/auth-screen";
import { PartyButton } from "@/components/party/party-button";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface LoginFormProps {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  mobile: string;
  setMobile: (value: string) => void;
  isSignUp: boolean;
  isVerifyingEmail: boolean;
  toggleForm: () => void;
  handleLogin: () => void;
  handleSignUp: (accepted: boolean) => void;
  handleResendVerification: () => void;
  setTermsAccepted: (accepted: boolean) => void;
  termsAccepted: boolean;
  handleReset: () => void;
  loading?: boolean;
  resending?: boolean;
  error?: string | null;
  notice?: string | null;
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
  isVerifyingEmail,
  toggleForm,
  handleLogin,
  handleSignUp,
  handleResendVerification,
  setTermsAccepted,
  termsAccepted,
  handleReset,
  loading = false,
  resending = false,
  error,
  notice,
}: LoginFormProps) {
  const [linkError, setLinkError] = useState<string | null>(null);
  const busy = loading || resending;
  const hasDetails = !!email.trim() && !!password;
  const canSubmit = hasDetails && (!isSignUp || (!!name.trim() && !!mobile.trim() && password.length >= 8 && termsAccepted));

  const openPolicy = async (policy: "terms" | "privacy") => {
    setLinkError(null);
    try {
      await Linking.openURL("https://terms-and-privacy.nexusgit.info/websites/phun-party/" + policy);
    } catch {
      setLinkError("The link could not open. Please try again.");
    }
  };

  const submit = () => {
    if (busy || !canSubmit) return;
    if (isSignUp) handleSignUp(termsAccepted);
    else handleLogin();
  };

  return (
    <AuthScreen
      title={isVerifyingEmail ? "Check your\ninbox." : isSignUp ? "Your name.\nYour game." : "Good to\nsee you."}
      description={isVerifyingEmail
        ? "One quick check, then you’re in."
        : isSignUp
          ? "Make an account and join your people."
          : "Sign in for your next round of friendly competition."}
      tone={isVerifyingEmail ? "lavender" : isSignUp ? "lime" : "pink"}
      busy={busy}
    >
      {isVerifyingEmail ? (
        <>
          <View style={styles.emailBadge}>
            <Ionicons name="mail-open-outline" size={34} color={partyColors.ink} />
            <Text selectable style={styles.emailAddress}>{email}</Text>
          </View>
          <Text style={[authStyles.body, styles.verificationCopy]}>
            Tap the verification button in the email we sent you. Check your spam folder if it hasn’t arrived.
          </Text>
          <AuthNotice message={error || linkError} />
          <AuthNotice message={notice} kind="success" />
          <PartyButton
            title={resending ? "Sending email…" : "Resend verification email"}
            onPress={handleResendVerification}
            disabled={busy}
            loading={resending}
            icon={<Ionicons name="mail-outline" size={21} color={partyColors.ink} />}
          />
          <PartyButton title="Back to sign in" variant="text" disabled={busy} onPress={toggleForm} />
        </>
      ) : (
        <>
          <Text accessibilityRole="header" style={authStyles.sectionTitle}>
            {isSignUp ? "Create your account" : "Sign in"}
          </Text>
          {isSignUp ? (
            <>
              <AppInput
                label="Player name"
                value={name}
                onChangeText={setName}
                placeholder="What should we call you?"
                autoCapitalize="words"
                textContentType="name"
                autoComplete="name"
                autoCorrect={false}
                editable={!busy}
                style={authStyles.field}
              />
              <AppInput
                label="Mobile number"
                value={mobile}
                onChangeText={setMobile}
                placeholder="Your mobile number"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                editable={!busy}
                style={authStyles.field}
              />
            </>
          ) : null}
          <AppInput
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            editable={!busy}
            style={authStyles.field}
          />
          <AppInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={isSignUp ? "Create a password" : "Enter your password"}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            textContentType={isSignUp ? "newPassword" : "password"}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            editable={!busy}
            returnKeyType="go"
            onSubmitEditing={submit}
            style={authStyles.field}
          />
          {isSignUp ? (
            <>
              <Text style={authStyles.helper}>Use at least 8 characters.</Text>
              <View style={styles.termsRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
                  accessibilityState={{ checked: termsAccepted, disabled: busy }}
                  disabled={busy}
                  onPress={() => setTermsAccepted(!termsAccepted)}
                  style={styles.checkboxTarget}
                >
                  <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                    {termsAccepted ? <Ionicons name="checkmark" size={21} color={partyColors.ink} /> : null}
                  </View>
                </Pressable>
                <Text style={styles.termsText}>
                  I agree to the{" "}
                  <Text accessibilityRole="link" style={styles.policyLink} onPress={() => void openPolicy("terms")}>Terms of Service</Text>
                  {" "}and{" "}
                  <Text accessibilityRole="link" style={styles.policyLink} onPress={() => void openPolicy("privacy")}>Privacy Policy</Text>.
                </Text>
              </View>
            </>
          ) : null}
          <AuthNotice message={error || linkError} />
          <AuthNotice message={notice} kind="success" />
          <PartyButton
            title={loading ? (isSignUp ? "Creating your account…" : "Signing in…") : isSignUp ? "Create account" : "Sign in"}
            onPress={submit}
            disabled={busy || !canSubmit}
            loading={loading}
            icon={<Ionicons name="arrow-forward" size={21} color={partyColors.ink} />}
            style={authStyles.primary}
          />
          {!isSignUp ? (
            <PartyButton title="Forgot your password?" onPress={handleReset} variant="text" disabled={busy} />
          ) : null}
          <View style={authStyles.switchArea}>
            <Text style={authStyles.switchPrompt}>{isSignUp ? "Already part of the party?" : "New around here?"}</Text>
            <PartyButton
              title={isSignUp ? "Sign in instead" : "Create an account"}
              onPress={toggleForm}
              variant="secondary"
              disabled={busy}
            />
          </View>
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 20 },
  checkboxTarget: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  checkbox: { width: 27, height: 27, borderWidth: 2, borderColor: partyColors.ink, borderRadius: 7, backgroundColor: partyColors.white, justifyContent: "center", alignItems: "center" },
  checkboxChecked: { backgroundColor: partyColors.lime },
  termsText: { flex: 1, color: partyColors.muted, fontSize: 14, lineHeight: 22, paddingTop: 10 },
  policyLink: { color: partyColors.purple, textDecorationLine: "underline", fontWeight: "700" },
  emailBadge: { borderWidth: 2, borderColor: partyColors.border, borderRadius: 16, padding: 20, backgroundColor: partyColors.white, alignItems: "flex-start", gap: 15, marginBottom: 20 },
  emailAddress: { color: partyColors.ink, fontWeight: "800", fontSize: 18, lineHeight: 26 },
  verificationCopy: { marginBottom: 24 },
});
