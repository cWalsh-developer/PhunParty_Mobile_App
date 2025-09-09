import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);

  const toggleForm = () => {
    setIsSignUp((prev) => !prev);
  };
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
          placeholder="example@gmail.com"
          autoCapitalize="none"
          keyboardType="email-address"
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Password"
          secureTextEntry={true}
          mode="outlined"
          style={styles.input}
        />
        <Button mode="contained" style={styles.button}>
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
