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
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getInputStyle = () => {
    if (error) return [inputStyles.container, inputStyles.error];
    if (isFocused) return [inputStyles.container, inputStyles.focused];
    return inputStyles.container;
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
      />
      {error && (
        <Text style={[inputStyles.label, { color: "#ef4444", marginTop: 4 }]}>
          {error}
        </Text>
      )}
    </View>
  );
};
