import { updatePassword } from "@/assets/authentication-storage/authenticationLogic";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
//State--------------------------------------------------------------------------------------------
export default function NewPassword() {
  //Initialisation----------------------------------------------------------------------------------
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const { phone } = useLocalSearchParams();
  const router = useRouter();
  const handlePasswordChange = (text: string) => {
    setPassword(text);
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
  };
  const handleSetNewPassword = async () => {
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    } else if (password.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    } else {
      const result = await updatePassword(password, phone as string);
      if (result) {
        setIsSuccess(true);
      }
    }
  };
  useEffect(() => {
    if (isSuccess) {
      router.replace("/(tabs)/scanQR");
    }
  }, [isSuccess]);

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
          onChangeText={handlePasswordChange}
          outlineColor="#201e23ff"
          activeOutlineColor="#201e23ff"
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />
        <TextInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          outlineColor="#201e23ff"
          activeOutlineColor="#201e23ff"
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />
        <Button
          mode="contained"
          onPress={handleSetNewPassword}
          style={styles.button}
        >
          Set New Password
        </Button>
      </View>
    </KeyboardAvoidingView>
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
