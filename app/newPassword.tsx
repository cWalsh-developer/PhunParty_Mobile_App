import { updatePassword } from "@/assets/authentication-storage/authenticationLogic";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import NewPasswordForm from "./components/NewPasswordForm";
//State--------------------------------------------------------------------------------------------
export default function NewPassword() {
  //Initialisation----------------------------------------------------------------------------------
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const { phone } = useLocalSearchParams();
  const router = useRouter();
  const handlePasswordChange = (text: string) => setPassword(text);
  const handleConfirmPasswordChange = (text: string) =>
    setConfirmPassword(text);
  const handleSetNewPassword = async () => {
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    } else if (password.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    } else {
      const result = await updatePassword(password, phone as string);
      if (result) setIsSuccess(true);
    }
  };
  useEffect(() => {
    if (isSuccess) {
      router.replace("/(tabs)/scanQR");
    }
  }, [isSuccess]);

  return (
    <NewPasswordForm
      password={password}
      confirmPassword={confirmPassword}
      onPasswordChange={handlePasswordChange}
      onConfirmPasswordChange={handleConfirmPasswordChange}
      onSubmit={handleSetNewPassword}
    />
  );
}

//Styles--------------------------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: { flex: 1, justifyContent: "center", padding: 16 },
  title: { textAlign: "center", marginBottom: 16 },
  input: { marginBottom: 16 },
  button: { marginTop: 8, backgroundColor: "#201e23ff" },
  toggleButton: { marginTop: 16, alignSelf: "center" },
});
