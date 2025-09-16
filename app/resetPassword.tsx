import {
  resetPassword,
  verifyResetCode,
} from "@/assets/authentication-storage/authenticationLogic";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import ResetPasswordForm from "./components/ResetPasswordForm";

//State--------------------------------------------------------------------------------------------
export default function ResetPassword() {
  //Initialisation----------------------------------------------------------------------------------
  const [phone, setPhone] = useState<string>("");
  const [isPressed, setIsPressed] = useState<boolean>(false);
  const [code, setCode] = useState<string>("");

  const handlePhoneChange = (text: string) => setPhone(text);
  const handleCodeChange = (text: string) => setCode(text);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const router = useRouter();

  const handleReset = async () => {
    // Implement password reset logic here
    if (!isPressed) {
      // Send reset code to the phone number
      const result = await resetPassword(phone);
      if (result) {
        setIsPressed(true);
      }
    }
  };

  const handleVerifyCode = async () => {
    const result = await verifyResetCode(phone, code);
    if (result) {
      setIsSuccess(true);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      router.replace({ pathname: "/newPassword", params: { phone } });
    }
  }, [isSuccess]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <ResetPasswordForm
          phone={phone}
          setPhone={handlePhoneChange}
          code={code}
          setCode={handleCodeChange}
          isPressed={isPressed}
          onReset={handleReset}
          onVerify={handleVerifyCode}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
//Styles-------------------------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: { flex: 1, justifyContent: "center", padding: 16 },
  title: { textAlign: "center", marginBottom: 16 },
  input: { marginBottom: 16 },
  button: { marginTop: 8, backgroundColor: "#201e23ff" },
  toggleButton: { marginTop: 16, alignSelf: "center" },
  resetHeading: { textAlign: "center", marginBottom: 16 },
});
