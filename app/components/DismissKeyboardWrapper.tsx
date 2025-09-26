import React from 'react';
import {
  Keyboard,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';

interface DismissKeyboardWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wrapper component that dismisses the keyboard when tapped outside input fields
 * Improves UX by allowing users to easily dismiss the keyboard
 */
const DismissKeyboardWrapper: React.FC<DismissKeyboardWrapperProps> = ({
  children,
  style,
}) => {
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={style}>
        {children}
      </View>
    </TouchableWithoutFeedback>
  );
};

export default DismissKeyboardWrapper;