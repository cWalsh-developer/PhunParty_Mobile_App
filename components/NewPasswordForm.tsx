import { AppButton, AppCard, AppInput } from "@/assets/components";
import { colors, layoutStyles, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DismissKeyboardWrapper from "./DismissKeyboardWrapper";
import Selector from "./Selector";

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
    <DismissKeyboardWrapper
      style={[layoutStyles.screen, layoutStyles.container]}
    >
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
              <MaterialIcons
                name="lock-reset"
                size={48}
                color={colors.tea[400]}
              />
              <Text style={[typography.h1, styles.title]}>
                Set New Password
              </Text>
            </View>

            {/* Form Card */}
            <AppCard style={styles.formCard}>
              <AppInput
                label="New Password"
                value={password}
                onChangeText={onPasswordChange}
                placeholder="Enter your new password"
                secureTextEntry
                style={styles.input}
                inputStyle={styles.inputField}
              />

              <AppInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={onConfirmPasswordChange}
                placeholder="Confirm your new password"
                secureTextEntry
                style={styles.input}
                inputStyle={styles.inputField}
              />

              <Selector onPress={onSubmit}>
                <AppButton
                  title="Set New Password"
                  onPress={() => {}}
                  variant="primary"
                  disabled={
                    !(
                      password &&
                      confirmPassword &&
                      password === confirmPassword
                    )
                  }
                  style={styles.button}
                  icon={
                    <MaterialIcons
                      name="lock-reset"
                      size={20}
                      color={
                        password &&
                        confirmPassword &&
                        password === confirmPassword
                          ? colors.ink[900]
                          : colors.stone[400]
                      }
                    />
                  }
                  iconPosition="left"
                />
              </Selector>
            </AppCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </DismissKeyboardWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    textAlign: "center",
    marginTop: 16,
    color: colors.tea[400], // PhunParty tea green theme color
  },
  formCard: {
    padding: 24,
  },
  input: {
    marginBottom: 16,
  },
  inputField: {
    backgroundColor: colors.ink[800], // Matches EditProfileModal
    borderColor: colors.tea[400], // Tea green border
    borderWidth: 1,
    color: colors.stone[100], // Bright text
  },
  button: {
    marginTop: 16,
  },
});
