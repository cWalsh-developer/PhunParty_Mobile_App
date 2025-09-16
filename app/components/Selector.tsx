import React from "react";
import { Vibration } from "react-native";

interface SelectorProps {
  children: React.ReactElement<any>;
  onPress: () => void;
  label?: string;
}

const Selector = ({ children, onPress, label }: SelectorProps) => {
  const handlePress = () => {
    if (label === "Logout") {
      Vibration.vibrate(400);
    } else {
      Vibration.vibrate(25);
    }
    onPress && onPress();
  };
  return React.cloneElement(children, { onPress: handlePress });
};

export default Selector;
