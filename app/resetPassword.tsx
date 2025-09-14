import {
  resetPassword,
  verifyResetCode,
} from "@/assets/authentication-storage/authenticationLogic";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

//State--------------------------------------------------------------------------------------------
export default function ResetPassword() {
  //Initialisation----------------------------------------------------------------------------------
  const [phone, setPhone] = useState<string>("");
  const [isPressed, setIsPressed] = useState<boolean>(false);
  const [code, setCode] = useState<string>("");

  const handlePhoneChange = (text: string) => {
    setPhone(text);
  };

  const handleCodeChange = (text: string) => {
    setCode(text);
  };
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const router = useRouter();

  const handleReset = async () => {
    // Implement password reset logic here
    setIsPressed(true);
    if (!isPressed) {
      // Send reset code to the phone number
      const result = await resetPassword(phone);
      if (result) {
        alert("Reset code sent to " + phone);
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
      router.replace("/(tabs)");
    }
  }, [isSuccess]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
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
          />
        ) : (
          <View>
            <Text style={styles.resetHeading} variant="bodyMedium">
              Please enter the reset code that has been sent to your phone
              number ending in {phone.slice(-3)}.
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              {[...Array(6)].map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: 40,
                    height: 50,
                    borderWidth: 2,
                    borderColor: "#201e23ff",
                    marginHorizontal: 4,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{code[i] || ""}</Text>
                </View>
              ))}
              <TextInput
                value={code}
                onChangeText={(text) =>
                  handleCodeChange(text.replace(/[^0-9]/g, "").slice(0, 6))
                }
                keyboardType="number-pad"
                maxLength={6}
                style={{
                  position: "absolute",
                  opacity: 0,
                  width: 1,
                  height: 1,
                }}
                autoFocus
              />
            </View>
          </View>
        )}
        <Button
          mode="contained"
          onPress={isPressed ? handleVerifyCode : handleReset}
          style={styles.button}
        >
          {isPressed ? "Verify Reset Code" : "Send Reset Code"}
        </Button>
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
