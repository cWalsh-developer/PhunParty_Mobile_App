import React, { useState } from "react";
import {
  KeyboardTypeOptions,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { inputStyles } from "../theme";

interface AppInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  editable?: boolean;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  error?: string;
  horizontalScrollEnabled?: boolean; // New prop for horizontal scrolling
  maxWidth?: number; // Optional max width for the input
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
  editable = true,
  style,
  inputStyle,
  error,
  horizontalScrollEnabled = false,
  maxWidth,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getInputStyle = () => {
    const baseStyles = [];
    
    if (error) baseStyles.push(inputStyles.container, inputStyles.error);
    else if (isFocused) baseStyles.push(inputStyles.container, inputStyles.focused);
    else baseStyles.push(inputStyles.container);

    // Add horizontal scrolling styles if enabled
    if (horizontalScrollEnabled) {
      baseStyles.push({
        width: maxWidth || 250, // Set a fixed width to enable horizontal scrolling
        textAlign: "left" as const,
      });
    }

    return baseStyles;
  };

  return (
    <View style={style}>
      {label && <Text style={inputStyles.label}>{label}</Text>}
      <TextInput
        style={[getInputStyle(), inputStyle]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a8a29e"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        scrollEnabled={horizontalScrollEnabled} // Enable horizontal scrolling
        multiline={false} // Ensure single line for horizontal scrolling
      />
      {error && (
        <Text style={[inputStyles.label, { color: "#ef4444", marginTop: 4 }]}>
          {error}
        </Text>
      )}
    </View>
  );
};
