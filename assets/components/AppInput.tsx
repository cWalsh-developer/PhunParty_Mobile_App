import React, { useState } from "react";
import {
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { inputStyles } from "../theme";
import { partyColors } from "../theme/party";

interface AppInputProps extends Omit<TextInputProps, "style"> {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  error?: string;
  horizontalScrollEnabled?: boolean; // New prop for horizontal scrolling
  maxWidth?: number; // Optional max width for the input
  maxLength?: number;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
  textContentType,
  editable = true,
  style,
  inputStyle,
  error,
  horizontalScrollEnabled = false,
  maxWidth,
  maxLength,
  accessibilityLabel,
  autoCorrect = false,
  onFocus,
  onBlur,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getInputStyle = () => {
    const baseStyles = [];

    if (error) baseStyles.push(inputStyles.container, inputStyles.error);
    else if (isFocused)
      baseStyles.push(inputStyles.container, inputStyles.focused);
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
        {...textInputProps}
        style={[getInputStyle(), inputStyle]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel || label || placeholder}
        accessibilityState={{ disabled: !editable }}
        placeholderTextColor={partyColors.muted}
        selectionColor={partyColors.purple}
        autoCorrect={autoCorrect}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        textContentType={textContentType}
        editable={editable}
        maxLength={maxLength}
        onFocus={(event) => { setIsFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setIsFocused(false); onBlur?.(event); }}
        scrollEnabled={horizontalScrollEnabled} // Enable horizontal scrolling
        multiline={false} // Ensure single line for horizontal scrolling
      />
      {error && (
        <Text accessibilityRole="alert" style={[inputStyles.label, { color: partyColors.danger, marginTop: 6 }]}>
          {error}
        </Text>
      )}
    </View>
  );
};
