import {
  login,
  signUp,
} from "@/assets/authentication-storage/authenticationLogic";
import { getToken } from "@/assets/authentication-storage/authStorage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

//Initialisation----------------------------------------------------------------------------------
//State--------------------------------------------------------------------------------------------
export default function Login() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [mobile, setMobile] = useState<string>("");
  const router = useRouter();
  useEffect(() => {
    const redirectIfAuthenticated = async () => {
      const token = await getToken();
      if (token) {
        router.replace("/(tabs)/scanQR");
      }
    };
    redirectIfAuthenticated();
  }, []);
  const [isSignUp, setIsSignUp] = useState<boolean>(false);

  const toggleForm = () => {
    setIsSignUp((prev) => !prev);
  };

  //Handlers-----------------------------------------------------------------------------------------

  const handleLogin = async () => {
    const result = await login({ email, password });
    if (result) {
      router.replace("/(tabs)/scanQR");
    }
  };
  const handleSignUp = async () => {
    const result = await signUp({ name, email, password, mobile });
    if (result) {
      toggleForm();
    }
  };

  const handleReset = () => {
    router.push("/resetPassword");
  };
  //View---------------------------------------------------------------------------------------------
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title} variant="headlineMedium">
          {isSignUp ? "Create Account" : "Welcome Back"}
        </Text>
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="example@gmail.com"
          autoCapitalize="none"
          keyboardType="email-address"
          mode="outlined"
          outlineColor="#201e23ff"
          style={styles.input}
        />
        {isSignUp && (
          <>
            <TextInput
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="John Doe"
              autoCapitalize="words"
              keyboardType="default"
              mode="outlined"
              outlineColor="#201e23ff"
              style={styles.input}
            />
            <TextInput
              label="Mobile"
              value={mobile}
              onChangeText={setMobile}
              placeholder="07712345678"
              autoCapitalize="none"
              keyboardType="phone-pad"
              mode="outlined"
              outlineColor="#201e23ff"
              style={styles.input}
            />
          </>
        )}
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          secureTextEntry={true}
          mode="outlined"
          outlineColor="#201e23ff"
          style={styles.input}
        />
        <Button
          mode="contained"
          style={styles.button}
          onPress={isSignUp ? handleSignUp : handleLogin}
        >
          {isSignUp ? "Sign Up" : "Login"}
        </Button>
        <Button
          mode="text"
          onPress={toggleForm}
          style={styles.toggleButton}
          theme={{ colors: { primary: "#201e23ff" } }}
        >
          {isSignUp
            ? "Already have an account? Sign In"
            : "Don't have an account? Sign Up"}
        </Button>
        <Button
          mode="text"
          onPress={handleReset}
          theme={{ colors: { primary: "#201e23ff" } }}
        >
          Forgot Password
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

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
