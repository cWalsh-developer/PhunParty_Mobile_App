import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Dimensions,
  Modal,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { AuthenticatedImage } from "./AuthenticatedImage";

interface PhotoViewerModalProps {
  visible: boolean;
  photoUri: string;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  visible,
  photoUri,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.9)" barStyle="light-content" />
      <View style={styles.modalContainer}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>

        {/* Photo */}
        <View style={styles.photoContainer}>
          <AuthenticatedImage
            photoUrl={photoUri}
            style={styles.photo}
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
    backgroundColor: "rgba(0, 0, 0, 0.9)",
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
    top: 50,
    right: 20,
    zIndex: 3,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 8,
  },
  photoContainer: {
    zIndex: 2,
    maxWidth: screenWidth * 0.9,
    maxHeight: screenHeight * 0.8,
  },
  photo: {
    width: screenWidth * 0.8,
    height: screenWidth * 0.8, // Square aspect ratio
    borderRadius: (screenWidth * 0.8) / 2, // Make it circular
  },
});

export default PhotoViewerModal;
