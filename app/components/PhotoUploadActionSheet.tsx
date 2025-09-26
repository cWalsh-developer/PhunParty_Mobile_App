import { colors, typography } from "@/assets/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { DebugService } from "../../assets/api/debugService";
import { AvatarOption, PhotoService } from "../../assets/api/photoService";
import { UserContext } from "../../assets/authentication-storage/authContext";
import { useToast } from "../../assets/components/ToastContext";
import AuthenticatedImage from "./AuthenticatedImage";

interface PhotoUploadActionSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onImageSelected: (imageUri: string) => void;
  onDeletePhoto?: () => void;
  hasCurrentPhoto?: boolean;
  title?: string;
}

const { width } = Dimensions.get("window");

export default function PhotoUploadActionSheet({
  isVisible,
  onClose,
  onImageSelected,
  onDeletePhoto,
  hasCurrentPhoto = false,
  title = "Choose Profile Photo",
}: PhotoUploadActionSheetProps) {
  const [showAvatars, setShowAvatars] = useState(false);
  const [availableAvatars, setAvailableAvatars] = useState<AvatarOption[]>([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const userContext = useContext(UserContext);
  const { showToast } = useToast();

  const user = userContext?.user;

  useEffect(() => {
    if (isVisible && showAvatars && availableAvatars.length === 0) {
      loadAvatars();
    }

    // Debug endpoints when modal opens
    if (isVisible && user?.player_id) {
      console.log(
        "PhotoUploadActionSheet: Modal opened, running debug checks..."
      );
      DebugService.logConfig();
      DebugService.testAvatarEndpoint();
      DebugService.testUploadEndpointExists(user.player_id);
    }
  }, [isVisible, showAvatars, user?.player_id]);

  const loadAvatars = async () => {
    console.log("PhotoUploadActionSheet: Loading avatars...");
    setIsLoadingAvatars(true);
    try {
      const avatars = await PhotoService.getAvailableAvatars();
      console.log(
        "PhotoUploadActionSheet: Loaded avatars:",
        avatars.length,
        "avatars"
      );
      setAvailableAvatars(avatars);
    } catch (error) {
      console.error("PhotoUploadActionSheet: Error loading avatars:", error);
      showToast("Failed to load avatars", "error");
    }
    setIsLoadingAvatars(false);
  };

  const takePhoto = async () => {
    if (!user?.player_id) {
      showToast("User not found", "error");
      return;
    }

    console.log(
      "PhotoUploadActionSheet: Taking photo for user:",
      user.player_id
    );
    setIsUploading(true);
    try {
      const imageUri = await PhotoService.launchCamera();
      console.log("PhotoUploadActionSheet: Camera returned URI:", imageUri);

      if (imageUri) {
        console.log("PhotoUploadActionSheet: Starting photo upload...");
        const result = await PhotoService.uploadPhoto(user.player_id, imageUri);
        console.log("PhotoUploadActionSheet: Upload result:", result);

        if (result) {
          showToast("Photo uploaded successfully!", "success");
          onImageSelected(result.photo_url);
          onClose();
        } else {
          showToast("Failed to upload photo", "error");
        }
      } else {
        console.log(
          "PhotoUploadActionSheet: No image URI returned from camera"
        );
      }
    } catch (error) {
      console.error("PhotoUploadActionSheet: Error with camera:", error);
      showToast("Camera error occurred", "error");
    }
    setIsUploading(false);
  };

  const selectFromGallery = async () => {
    if (!user?.player_id) {
      showToast("User not found", "error");
      return;
    }

    console.log(
      "PhotoUploadActionSheet: Selecting from gallery for user:",
      user.player_id
    );
    setIsUploading(true);
    try {
      const imageUri = await PhotoService.launchImageLibrary();
      console.log("PhotoUploadActionSheet: Gallery returned URI:", imageUri);

      if (imageUri) {
        console.log("PhotoUploadActionSheet: Starting photo upload...");
        const result = await PhotoService.uploadPhoto(user.player_id, imageUri);
        console.log("PhotoUploadActionSheet: Upload result:", result);

        if (result) {
          showToast("Photo uploaded successfully!", "success");
          onImageSelected(result.photo_url);
          onClose();
        } else {
          showToast("Failed to upload photo", "error");
        }
      } else {
        console.log(
          "PhotoUploadActionSheet: No image URI returned from gallery"
        );
      }
    } catch (error) {
      console.error("PhotoUploadActionSheet: Error with gallery:", error);
      showToast("Gallery error occurred", "error");
    }
    setIsUploading(false);
  };

  const deletePhoto = () => {
    if (onDeletePhoto) {
      onDeletePhoto();
      onClose();
    }
  };

  const selectAvatar = async (avatar: AvatarOption) => {
    if (!user?.player_id) {
      showToast("User not found", "error");
      return;
    }

    setIsUploading(true);
    try {
      console.log("PhotoUploadActionSheet: Selecting avatar:", avatar.name);

      // Use the avatar endpoint with the full avatar object
      const result = await PhotoService.setAvatar(user.player_id, avatar);
      if (result) {
        showToast(`Avatar "${avatar.style}" set successfully!`, "success");
        onImageSelected(result.photo_url);
        onClose();
      } else {
        showToast("Failed to set avatar", "error");
      }
    } catch (error) {
      console.error("Error setting avatar:", error);
      showToast("Failed to set avatar", "error");
    }
    setIsUploading(false);
  };

  const ActionButton = ({
    icon,
    title,
    onPress,
    color = colors.tea[500],
    disabled = false,
  }: {
    icon: keyof typeof MaterialIcons.glyphMap;
    title: string;
    onPress: () => void;
    color?: string;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: disabled ? colors.ink[700] : colors.ink[800],
        marginBottom: 12,
        opacity: disabled ? 0.6 : 1,
      }}
      onPress={onPress}
      disabled={disabled}
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
        {disabled && isUploading ? (
          <ActivityIndicator size="small" color={colors.ink[900]} />
        ) : (
          <MaterialIcons name={icon} size={20} color={colors.ink[900]} />
        )}
      </View>
      <Text style={[typography.body, { color: colors.stone[100], flex: 1 }]}>
        {title}
      </Text>
      <MaterialIcons name="chevron-right" size={20} color={colors.stone[400]} />
    </TouchableOpacity>
  );

  const AvatarOption = ({ avatar }: { avatar: AvatarOption }) => (
    <TouchableOpacity
      style={{
        width: (width - 80) / 3,
        aspectRatio: 1,
        marginBottom: 12,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: colors.ink[800],
        opacity: isUploading ? 0.6 : 1,
      }}
      onPress={() => selectAvatar(avatar)}
      disabled={isUploading}
    >
      <AuthenticatedImage
        photoUrl={avatar.url}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
      />
      <View
        style={{
          position: "absolute",
          bottom: 4,
          left: 4,
          right: 4,
          backgroundColor: "rgba(0,0,0,0.7)",
          borderRadius: 4,
          paddingHorizontal: 4,
          paddingVertical: 2,
        }}
      >
        <Text
          style={[
            typography.caption,
            { color: colors.stone[100], textAlign: "center", fontSize: 10 },
          ]}
          numberOfLines={1}
        >
          {avatar.name}
        </Text>
      </View>
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
            <TouchableOpacity onPress={onClose} disabled={isUploading}>
              <MaterialIcons
                name="close"
                size={24}
                color={isUploading ? colors.stone[950] : colors.stone[400]}
              />
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
                disabled={isUploading}
              />

              <ActionButton
                icon="photo-library"
                title="Choose from Gallery"
                onPress={selectFromGallery}
                color={colors.peach[500]}
                disabled={isUploading}
              />

              <ActionButton
                icon="face"
                title="Choose Avatar"
                onPress={() => setShowAvatars(true)}
                color={colors.tea[400]}
                disabled={isUploading}
              />

              {hasCurrentPhoto && (
                <ActionButton
                  icon="delete"
                  title="Delete Photo"
                  onPress={deletePhoto}
                  color={colors.red[500]}
                  disabled={isUploading}
                />
              )}

              {isUploading && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingTop: 16,
                  }}
                >
                  <ActivityIndicator size="small" color={colors.tea[500]} />
                  <Text
                    style={[
                      typography.small,
                      { color: colors.stone[400], marginLeft: 8 },
                    ]}
                  >
                    Uploading...
                  </Text>
                </View>
              )}
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
                disabled={isUploading}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={20}
                  color={isUploading ? colors.stone[950] : colors.stone[400]}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    typography.small,
                    {
                      color: isUploading
                        ? colors.stone[950]
                        : colors.stone[400],
                    },
                  ]}
                >
                  Back to options
                </Text>
              </TouchableOpacity>

              {isLoadingAvatars ? (
                <View
                  style={{
                    paddingVertical: 40,
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="large" color={colors.tea[500]} />
                  <Text
                    style={[
                      typography.body,
                      { color: colors.stone[400], marginTop: 16 },
                    ]}
                  >
                    Loading avatars...
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={availableAvatars}
                  renderItem={({ item }) => <AvatarOption avatar={item} />}
                  keyExtractor={(item) => item.name}
                  numColumns={3}
                  columnWrapperStyle={{ justifyContent: "space-between" }}
                  showsVerticalScrollIndicator={false}
                />
              )}

              {isUploading && (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.7)",
                    justifyContent: "center",
                    alignItems: "center",
                    borderRadius: 12,
                  }}
                >
                  <ActivityIndicator size="large" color={colors.tea[500]} />
                  <Text
                    style={[
                      typography.body,
                      { color: colors.stone[100], marginTop: 16 },
                    ]}
                  >
                    Setting avatar...
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
