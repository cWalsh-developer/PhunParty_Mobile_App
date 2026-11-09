import { AppInput } from "@/assets/components";
import { partyColors } from "@/assets/theme/party";
import { AuthNotice, AuthScreen, authStyles } from "@/components/party/auth-screen";
import { PartyButton } from "@/components/party/party-button";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Text, View } from "react-native";

interface NewPasswordFormProps {
  password: string;
  confirmPassword: string;
  onPasswordChange: (text: string) => void;
  onConfirmPasswordChange: (text: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
}

export default function NewPasswordForm({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  loading = false,
  error,
  disabled = false,
}: NewPasswordFormProps) {
  const matches = password === confirmPassword;
  const canSubmit = password.length >= 6 && !!confirmPassword && matches && !disabled && !loading;
  const submit = () => {
    if (canSubmit) onSubmit();
  };

  return (
    <AuthScreen
      title={"A fresh\nstart."}
      description="Choose a new password, then get back to the party."
      tone="lime"
      onBack={() => router.replace("/resetPassword")}
      backLabel="Back to password reset"
      busy={loading}
    >
      <Text style={[authStyles.helper, { marginTop: 0 }]}>3 of 3 · Choose a password</Text>
      <Text accessibilityRole="header" style={authStyles.sectionTitle}>New password</Text>
      <AppInput
        label="New password"
        value={password}
        onChangeText={onPasswordChange}
        placeholder="Enter a new password"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        autoComplete="new-password"
        editable={!loading && !disabled}
        style={authStyles.field}
      />
      <Text style={authStyles.helper}>Use at least 6 characters.</Text>
      <AppInput
        label="Confirm new password"
        value={confirmPassword}
        onChangeText={onConfirmPasswordChange}
        placeholder="Enter it once more"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        autoComplete="new-password"
        editable={!loading && !disabled}
        returnKeyType="go"
        onSubmitEditing={submit}
        error={confirmPassword && !matches ? "Your passwords don’t match yet." : undefined}
        style={authStyles.field}
      />
      <AuthNotice message={error} />
      <PartyButton
        title={loading ? "Saving your password…" : "Save password & sign in"}
        onPress={submit}
        loading={loading}
        disabled={!canSubmit}
        style={authStyles.primary}
        icon={<Ionicons name="lock-closed-outline" size={20} color={partyColors.ink} />}
      />
      <View style={authStyles.switchArea}>
        <Text style={authStyles.switchPrompt}>Need to start again?</Text>
        <PartyButton title="Request a new reset code" variant="secondary" disabled={loading} onPress={() => router.replace("/resetPassword")} />
      </View>
    </AuthScreen>
  );
}
