import { Ionicons } from "@expo/vector-icons";
import { partyColors } from "@/assets/theme/party";
import React from "react";
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { AuthenticatedImage } from "./AuthenticatedImage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PhotoViewerModalProps {
  visible: boolean;
  photoUri: string;
  onClose: () => void;
}

const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  visible,
  photoUri,
  onClose,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const photoSize = Math.min(width - 40, height - insets.top - insets.bottom - 120, 600);
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Close button */}
        <TouchableOpacity style={[styles.closeButton, { top: insets.top + 16 }]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close profile photo">
          <Ionicons name="close" size={26} color={partyColors.ink} />
        </TouchableOpacity>

        {/* Photo */}
        <View style={styles.photoContainer}>
          <AuthenticatedImage
            photoUrl={photoUri}
            style={[styles.photo, { width: photoSize, height: photoSize }]}
            resizeMode="contain"
          />
        </View>

        {/* Tap to close overlay */}
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: partyColors.cream,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  closeButton: {
    position: "absolute",
    right: 20,
    zIndex: 3,
    backgroundColor: partyColors.lime,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: partyColors.border,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  photoContainer: {
    zIndex: 2,
  },
  photo: {
    borderRadius: 24,
  },
});

export default PhotoViewerModal;
