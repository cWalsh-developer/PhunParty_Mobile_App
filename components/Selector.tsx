import React from "react";
import { Platform, Vibration } from "react-native";

interface SelectorProps {
  children: React.ReactElement<any>;
  onPress: () => void;
  label?: string;
}

const Selector = ({ children, onPress, label }: SelectorProps) => {
  const handlePress = () => {
    if (label === "Logout" || label === "Delete Account") {
      Vibration.vibrate(400);
    } else if (Platform.OS === "ios") {
      null;
    } else if (Platform.OS === "android") {
      Vibration.vibrate(25);
    }
    onPress && onPress();
  };
  return React.cloneElement(children, { onPress: handlePress });
};

export default Selector;
