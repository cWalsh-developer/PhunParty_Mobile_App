import { colors, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface PhotoUploadActionSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onImageSelected: (imageUri: string) => void;
  title?: string;
}

// Pre-defined avatar options
const AVATAR_OPTIONS = [
  {
    id: "1",
    uri: "https://ui-avatars.com/api/?name=User&background=7ac9a1&color=0a0a0a&size=200",
  },
  {
    id: "2",
    uri: "https://ui-avatars.com/api/?name=Player&background=ffad80&color=0a0a0a&size=200",
  },
  {
    id: "3",
    uri: "https://ui-avatars.com/api/?name=Gamer&background=b8e1c6&color=0a0a0a&size=200",
  },
  {
    id: "4",
    uri: "https://ui-avatars.com/api/?name=Pro&background=ffd2b3&color=0a0a0a&size=200",
  },
  {
    id: "5",
    uri: "https://ui-avatars.com/api/?name=Star&background=9bd4b3&color=0a0a0a&size=200",
  },
  {
    id: "6",
    uri: "https://ui-avatars.com/api/?name=Hero&background=ffbf99&color=0a0a0a&size=200",
  },
];

const { width } = Dimensions.get("window");

export default function PhotoUploadActionSheet({
  isVisible,
  onClose,
  onImageSelected,
  title = "Choose Profile Photo",
}: PhotoUploadActionSheetProps) {
  const [showAvatars, setShowAvatars] = useState(false);

  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || mediaStatus !== "granted") {
      Alert.alert(
        "Permissions Required",
        "Please grant camera and photo library permissions to upload photos.",
        [{ text: "OK" }]
      );
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri);
        onClose();
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const selectFromGallery = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri);
        onClose();
      }
    } catch (error) {
      console.error("Gallery error:", error);
      Alert.alert("Error", "Failed to select photo. Please try again.");
    }
  };

  const selectAvatar = (avatarUri: string) => {
    onImageSelected(avatarUri);
    onClose();
  };

  const ActionButton = ({
    icon,
    title,
    onPress,
    color = colors.tea[500],
  }: {
    icon: keyof typeof MaterialIcons.glyphMap;
    title: string;
    onPress: () => void;
    color?: string;
  }) => (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: colors.ink[800],
        marginBottom: 12,
      }}
      onPress={onPress}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: color,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 16,
        }}
      >
        <MaterialIcons name={icon} size={20} color={colors.ink[900]} />
      </View>
      <Text style={[typography.body, { color: colors.stone[100], flex: 1 }]}>
        {title}
      </Text>
      <MaterialIcons name="chevron-right" size={20} color={colors.stone[400]} />
    </TouchableOpacity>
  );

  const AvatarOption = ({ avatar }: { avatar: (typeof AVATAR_OPTIONS)[0] }) => (
    <TouchableOpacity
      style={{
        width: (width - 80) / 3,
        aspectRatio: 1,
        marginBottom: 12,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: colors.ink[800],
      }}
      onPress={() => selectAvatar(avatar.uri)}
    >
      <Image
        source={{ uri: avatar.uri }}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View
          style={{
            backgroundColor: colors.ink[900],
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 20,
            paddingBottom: 40,
            paddingHorizontal: 20,
            maxHeight: "80%",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
            }}
          >
            <Text style={[typography.h2, { color: colors.stone[100] }]}>
              {showAvatars ? "Choose Avatar" : title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={colors.stone[400]} />
            </TouchableOpacity>
          </View>

          {!showAvatars ? (
            /* Main Options */
            <View>
              <ActionButton
                icon="camera-alt"
                title="Take Photo"
                onPress={takePhoto}
                color={colors.tea[500]}
              />

              <ActionButton
                icon="photo-library"
                title="Choose from Gallery"
                onPress={selectFromGallery}
                color={colors.peach[500]}
              />

              <ActionButton
                icon="face"
                title="Choose Avatar"
                onPress={() => setShowAvatars(true)}
                color={colors.tea[400]}
              />
            </View>
          ) : (
            /* Avatar Selection */
            <View>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 20,
                }}
                onPress={() => setShowAvatars(false)}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={20}
                  color={colors.stone[400]}
                  style={{ marginRight: 8 }}
                />
                <Text style={[typography.small, { color: colors.stone[400] }]}>
                  Back to options
                </Text>
              </TouchableOpacity>

              <FlatList
                data={AVATAR_OPTIONS}
                renderItem={({ item }) => <AvatarOption avatar={item} />}
                keyExtractor={(item) => item.id}
                numColumns={3}
                columnWrapperStyle={{ justifyContent: "space-between" }}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
