import React from "react";
import { View, ViewStyle } from "react-native";
import { cardStyles } from "../theme";

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const AppCard: React.FC<AppCardProps> = ({ children, style }) => {
  return <View style={[cardStyles.container, style]}>{children}</View>;
};
