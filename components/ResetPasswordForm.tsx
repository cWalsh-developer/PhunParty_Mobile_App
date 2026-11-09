import { AppInput } from "@/assets/components";
import { partyColors } from "@/assets/theme/party";
import { AuthNotice, AuthScreen, authStyles } from "@/components/party/auth-screen";
import { PartyButton } from "@/components/party/party-button";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

interface ResetPasswordFormProps {
  phone: string;
  setPhone: (phone: string) => void;
  code: string;
  setCode: (code: string) => void;
  isPressed: boolean;
  onReset: () => void;
  onVerify: () => void;
  loading?: boolean;
  error?: string | null;
  onChangePhone?: () => void;
}

export default function ResetPasswordForm({
  phone,
  setPhone,
  code,
  setCode,
  isPressed,
  onReset,
  onVerify,
  loading = false,
  error,
  onChangePhone,
}: ResetPasswordFormProps) {
  const canSubmit = isPressed ? /^\d{6}$/.test(code) : phone.trim().length >= 11;
  const submit = () => {
    if (!canSubmit || loading) return;
    if (isPressed) onVerify();
    else onReset();
  };

  return (
    <AuthScreen
      title={isPressed ? "Check your\nmessages." : "Let’s get\nyou back in."}
      description={isPressed ? "Enter the six-digit code we sent to your phone." : "We’ll send a reset code to the mobile number on your account."}
      tone="lavender"
      onBack={() => router.replace("/login")}
      busy={loading}
    >
      <View style={styles.stepRow}>
        <Text style={styles.stepLabel}>{isPressed ? "2 of 3 · Verify your number" : "1 of 3 · Find your account"}</Text>
        <Ionicons name={isPressed ? "chatbubble-ellipses-outline" : "key-outline"} size={23} color={partyColors.purple} />
      </View>
      <Text accessibilityRole="header" style={authStyles.sectionTitle}>{isPressed ? "Your reset code" : "Reset password"}</Text>
      {isPressed ? (
        <>
          <View style={styles.destination}>
            <Ionicons name="phone-portrait-outline" size={22} color={partyColors.ink} />
            <Text style={styles.destinationText}>Sent to the number ending in {phone.slice(-3)}.</Text>
          </View>
          <AppInput
            label="Six-digit code"
            value={code}
            onChangeText={(value) => setCode(value.replace(/[^0-9]/g, "").slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoCorrect={false}
            maxLength={6}
            editable={!loading}
            placeholder="000000"
            returnKeyType="done"
            onSubmitEditing={submit}
            inputStyle={styles.codeInput}
            style={authStyles.field}
          />
          <Text style={authStyles.helper}>Keep this code private. Enter all six digits to continue.</Text>
        </>
      ) : (
        <AppInput
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          placeholder="The number on your account"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          editable={!loading}
          returnKeyType="go"
          onSubmitEditing={submit}
          style={authStyles.field}
        />
      )}
      <AuthNotice message={error} />
      <PartyButton
        title={loading ? (isPressed ? "Checking your code…" : "Sending reset code…") : isPressed ? "Verify code" : "Send reset code"}
        onPress={submit}
        loading={loading}
        disabled={loading || !canSubmit}
        icon={<Ionicons name="arrow-forward" size={21} color={partyColors.ink} />}
        style={authStyles.primary}
      />
      {isPressed && onChangePhone ? (
        <PartyButton title="Use a different number" onPress={onChangePhone} variant="text" disabled={loading} />
      ) : null}
      <View style={authStyles.switchArea}>
        <Text style={authStyles.switchPrompt}>Remembered your password?</Text>
        <PartyButton title="Back to sign in" onPress={() => router.replace("/login")} variant="secondary" disabled={loading} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  stepLabel: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "700", color: partyColors.purple },
  destination: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: partyColors.white, borderWidth: 1.5, borderColor: partyColors.border, borderRadius: 12, padding: 15, marginBottom: 22 },
  destinationText: { flex: 1, color: partyColors.ink, fontSize: 14, lineHeight: 21 },
  codeInput: { fontSize: 25, lineHeight: 32, letterSpacing: 8, fontWeight: "800", textAlign: "center", fontVariant: ["tabular-nums"] },
});
