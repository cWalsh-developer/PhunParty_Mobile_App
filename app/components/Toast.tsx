import { colors, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef } from "react";
import { Animated, Dimensions, Text, TouchableOpacity } from "react-native";

export interface ToastProps {
  visible: boolean;
  message: string;
  type?: "success" | "error" | "info" | "warning";
  duration?: number;
  onHide: () => void;
}

const { width } = Dimensions.get("window");

export default function Toast({
  visible,
  message,
  type = "info",
  duration = 3000,
  onHide,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  const getToastColors = () => {
    switch (type) {
      case "success":
        return {
          backgroundColor: colors.tea[400],
          iconColor: colors.ink[900],
          textColor: colors.ink[900],
          icon: "check-circle" as keyof typeof MaterialIcons.glyphMap,
        };
      case "error":
        return {
          backgroundColor: colors.red[500],
          iconColor: colors.stone[100],
          textColor: colors.stone[100],
          icon: "error" as keyof typeof MaterialIcons.glyphMap,
        };
      case "warning":
        return {
          backgroundColor: colors.peach[400],
          iconColor: colors.ink[900],
          textColor: colors.ink[900],
          icon: "warning" as keyof typeof MaterialIcons.glyphMap,
        };
      default:
        return {
          backgroundColor: colors.ink[700],
          iconColor: colors.tea[400],
          textColor: colors.stone[100],
          icon: "info" as keyof typeof MaterialIcons.glyphMap,
        };
    }
  };

  const toastColors = getToastColors();

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 60,
        left: 16,
        right: 16,
        zIndex: 9999,
        transform: [{ translateY }],
        opacity,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={hideToast}
        style={{
          backgroundColor: toastColors.backgroundColor,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
          borderWidth: 1,
          borderColor: type === "info" ? colors.tea[400] + "40" : "transparent",
        }}
      >
        <MaterialIcons
          name={toastColors.icon}
          size={20}
          color={toastColors.iconColor}
          style={{ marginRight: 12 }}
        />
        <Text
          style={[
            typography.body,
            {
              color: toastColors.textColor,
              flex: 1,
              fontSize: 14,
              fontWeight: "500",
            },
          ]}
          numberOfLines={2}
        >
          {message}
        </Text>
        <MaterialIcons
          name="close"
          size={16}
          color={toastColors.iconColor}
          style={{ marginLeft: 8, opacity: 0.7 }}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}
