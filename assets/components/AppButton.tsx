import React from "react";
import {
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { buttonStyles } from "../theme";

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "accent" | "delete";
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  style,
  textStyle,
  icon,
  iconPosition = "left",
}) => {
  const getButtonStyle = () => {
    if (disabled) return buttonStyles.disabled;
    switch (variant) {
      case "secondary":
        return buttonStyles.secondary;
      case "accent":
        return buttonStyles.accent;
      case "delete":
        return buttonStyles.delete;
      default:
        return buttonStyles.primary;
    }
  };

  const getTextStyle = () => {
    if (disabled) return buttonStyles.disabledText;
    switch (variant) {
      case "secondary":
        return buttonStyles.secondaryText;
      case "accent":
        return buttonStyles.accentText;
      case "delete":
        return buttonStyles.deleteText;
      default:
        return buttonStyles.primaryText;
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {icon ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {iconPosition === "left" && icon}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
          {iconPosition === "right" && icon}
        </View>
      ) : (
        <Text style={[getTextStyle(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};
