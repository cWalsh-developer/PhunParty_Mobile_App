import React from "react";
import { StyleSheet } from "react-native";
import { Button } from "react-native-paper";

interface AppButtonProps {
  mode?: "text" | "outlined" | "contained";
  onPress: () => void;
  style?: object;
  children: React.ReactNode;
  color?: string;
  disabled?: boolean;
  noMargin?: boolean;
}

export default function AppButton({
  mode = "contained",
  onPress,
  style,
  children,
  color = "#201e23ff",
  disabled = false,
  noMargin = false,
}: AppButtonProps) {
  const buttonStyle = noMargin
    ? [styles.buttonNoMargin, disabled && styles.buttonDisabled, style]
    : [styles.button, disabled && styles.buttonDisabled, style];
  return (
    <Button
      mode={mode}
      onPress={onPress}
      style={buttonStyle}
      theme={{ colors: { primary: color } }}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    marginVertical: 8,
    borderRadius: 28,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  buttonNoMargin: {
    borderRadius: 28,
    paddingHorizontal: 12,
  },
  buttonDisabled: {
    backgroundColor: "#cccccc",
    // Optionally, you can add color: '#888' for text if needed
  },
});
