import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { cardStyles } from "../theme";

interface AppCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const AppCard: React.FC<AppCardProps> = ({ children, style }) => {
  return <View style={[cardStyles.container, style]}>{children}</View>;
};
