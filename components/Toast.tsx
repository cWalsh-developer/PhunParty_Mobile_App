import { partyColors, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useState } from "react";
import { Animated, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ToastProps {
  visible: boolean;
  message: string;
  type?: "success" | "error" | "info" | "warning";
  duration?: number;
  onHide: () => void;
}

const appearances = {
  success: { backgroundColor: partyColors.success, color: partyColors.ink, icon: "check-circle" },
  error: { backgroundColor: partyColors.dangerSoft, color: partyColors.danger, icon: "error" },
  warning: { backgroundColor: partyColors.pink, color: partyColors.ink, icon: "warning" },
  info: { backgroundColor: partyColors.lavender, color: partyColors.ink, icon: "info" },
} as const;

export default function Toast({ visible, message, type = "info", duration = 3000, onHide }: ToastProps) {
  const insets = useSafeAreaInsets();
  const [translateY] = useState(() => new Animated.Value(-100));
  const [opacity] = useState(() => new Animated.Value(0));
  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -100, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) onHide(); });
  }, [onHide, opacity, translateY]);

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(hideToast, duration);
    return () => { clearTimeout(timer); translateY.stopAnimation(); opacity.stopAnimation(); };
  }, [visible, message, duration, hideToast, opacity, translateY]);

  if (!visible) return null;
  const appearance = appearances[type];
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute", top: insets.top + 16, left: 16, right: 16,
        maxWidth: 560, alignSelf: "center", zIndex: 9999,
        transform: [{ translateY }], opacity,
      }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={message + ". Dismiss notification"}
        activeOpacity={0.9}
        onPress={hideToast}
        style={{
          backgroundColor: appearance.backgroundColor,
          borderRadius: 14, borderWidth: 2, borderBottomWidth: 5,
          borderColor: partyColors.border, minHeight: 54,
          paddingHorizontal: 16, paddingVertical: 14,
          flexDirection: "row", alignItems: "center", gap: 12,
        }}
      >
        <MaterialIcons name={appearance.icon} size={24} color={appearance.color} />
        <Text style={[typography.small, { color: appearance.color, flex: 1, fontWeight: "700" }]}>{message}</Text>
        <MaterialIcons name="close" size={20} color={appearance.color} />
      </TouchableOpacity>
    </Animated.View>
  );
}
