import { partyColors } from "@/assets/theme/party";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

interface PartyButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "text";
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}

export function PartyButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  style,
  icon,
}: PartyButtonProps) {
  const unavailable = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondary,
        variant === "text" && styles.textButton,
        unavailable && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, variant === "text" && styles.textLabel]}>{title}</Text>
      {loading ? (
        <ActivityIndicator color={partyColors.ink} accessibilityLabel="Loading" />
      ) : icon ? (
        <View accessible={false}>{icon}</View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: partyColors.border,
    borderRadius: 12,
    backgroundColor: partyColors.lime,
  },
  secondary: { backgroundColor: partyColors.white },
  textButton: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderBottomWidth: 0,
    justifyContent: "center",
    minHeight: 48,
  },
  disabled: { backgroundColor: partyColors.lavender, opacity: 0.65 },
  pressed: { opacity: 0.8, transform: [{ translateY: 1 }] },
  label: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: "800", color: partyColors.ink },
  textLabel: { color: partyColors.purple },
});
